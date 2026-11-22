-- TILCA: nuevo modelo de cobro.
--
-- Antes: cada clic en "Comprar" generaba un código TILCA-XXXX único, el organizador lo
-- canjeaba en la puerta y se cobraban Bs 5 por asistente nuevo.
--
-- Ahora: el organizador crea un código de descuento en su ticketera (ej. TILCA10). Al
-- publicar deposita en un escrow de Stellar las ventas que espera × precio × 5%. Durante
-- la venta confirma cuántas entradas se vendieron con el código y, al cerrar el evento,
-- el escrow le paga a TILCA el 5% de esas ventas y le devuelve el resto.
--
-- Los datos del modelo anterior (códigos, canjes, cobros en `clicks`) se conservan.

-- 1. Datos de venta del evento ----------------------------------------------------

alter table public.events
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric(8, 2) check (discount_amount > 0),
  add column if not exists discount_unit text check (discount_unit in ('bs', 'pct')),
  add column if not exists sales_channels text[] not null default '{}'
    check (sales_channels <@ array['ticketera', 'qr', 'puerta']::text[]),
  add column if not exists expected_sales integer check (expected_sales >= 0),
  -- Escrow del evento: una cuenta de Stellar Testnet propia de cada evento, que controla TILCA.
  add column if not exists escrow_account text,
  add column if not exists commission_bs numeric(10, 2),
  add column if not exists refund_bs numeric(10, 2),
  add column if not exists escrow_attempted_at timestamptz, -- inicio del depósito o cierre en curso
  add column if not exists escrow_error text,               -- último error de Stellar, para mostrarlo
  add column if not exists closed_at timestamptz;

-- Estados del escrow:
--   sin_escrow          evento gratis o sin depósito
--   deposito_pendiente  el depósito no llegó a Stellar; se reintenta desde el panel
--   depositando         un depósito está en curso (reservado para un solo proceso)
--   activo              el depósito está en el escrow
--   cerrando            el cierre está en curso (reservado para un solo proceso)
--   cierre_pendiente    el cierre falló en Stellar; se reintenta desde el panel
--   cerrado             comisión pagada a TILCA y saldo devuelto
--   agotado/reembolsado estados del modelo anterior, se conservan
alter table public.events drop constraint if exists events_escrow_status_check;
alter table public.events
  add constraint events_escrow_status_check check (escrow_status in (
    'sin_escrow', 'deposito_pendiente', 'depositando', 'activo', 'cerrando', 'cierre_pendiente', 'cerrado', 'agotado', 'reembolsado'
  ));

-- Los ids "TW-ESCROW-..." del modelo anterior no existían en ninguna red.
update public.events set stellar_escrow_id = null where stellar_escrow_id like 'TW-ESCROW-%';

-- 2. Llaves de las cuentas de escrow (solo el servidor) ----------------------------

create table if not exists public.event_escrow_secrets (
  event_id uuid primary key references public.events (id) on delete cascade,
  public_key text not null,
  secret_encrypted text not null,
  created_at timestamptz not null default now()
);
alter table public.event_escrow_secrets enable row level security;
revoke all on public.event_escrow_secrets from public, anon, authenticated;
grant all on public.event_escrow_secrets to service_role;

-- 3. Ventas confirmadas por el organizador ----------------------------------------

create table if not exists public.sales_confirmations (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  source text not null check (source in ('ticketera', 'puerta')),
  quantity integer not null check (quantity > 0 and quantity <= 100000),
  evidence_path text,        -- captura o CSV en el bucket privado "respaldos"
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sales_confirmations_event_idx on public.sales_confirmations (event_id, created_at);
alter table public.sales_confirmations enable row level security;

-- Se puede confirmar (y corregir) mientras el evento no esté cerrado.
create or replace function public.event_open_for_sales(p_event uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e
    where e.id = p_event
      and public.owns_organizer(e.organizer_id)
      and e.escrow_status not in ('cerrando', 'cierre_pendiente', 'cerrado')
  );
$$;
revoke all on function public.event_open_for_sales(uuid) from public, anon;
grant execute on function public.event_open_for_sales(uuid) to authenticated;

create policy "ventas: dueño lee" on public.sales_confirmations for select
  using (public.owns_event(event_id));
create policy "ventas: dueño confirma" on public.sales_confirmations for insert to authenticated
  with check (public.event_open_for_sales(event_id) and not is_sample);
create policy "ventas: dueño corrige" on public.sales_confirmations for delete to authenticated
  using (public.event_open_for_sales(event_id));

-- 4. Comprobantes del escrow ------------------------------------------------------

create table if not exists public.escrow_transactions (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('deposito', 'deposito_adicional', 'comision', 'devolucion')),
  amount_bs numeric(10, 2) not null check (amount_bs >= 0),
  tx_hash text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists escrow_transactions_event_idx on public.escrow_transactions (event_id, created_at);
alter table public.escrow_transactions enable row level security;
-- Las escribe solo el servidor (service role) después de cada transacción en Stellar.
create policy "comprobantes: dueño lee" on public.escrow_transactions for select
  using (public.owns_event(event_id));
revoke insert, update, delete on public.escrow_transactions from anon, authenticated;

-- Los montos y el estado del escrow los escribe solo el servidor: el organizador no
-- puede marcar su evento como cerrado ni cambiar lo depositado desde el navegador.
-- (Supabase da UPDATE sobre toda la tabla a `authenticated`, así que un revoke por
-- columna no alcanza: un trigger conserva esos valores.)
create or replace function public.protect_escrow_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.promo_budget_bs := 0;
    new.escrow_balance_bs := 0;
    new.escrow_status := 'sin_escrow';
    new.escrow_account := null;
    new.stellar_escrow_id := null;
    new.commission_bs := null;
    new.refund_bs := null;
    new.escrow_attempted_at := null;
    new.escrow_error := null;
    new.closed_at := null;
  else
    new.promo_budget_bs := old.promo_budget_bs;
    new.escrow_balance_bs := old.escrow_balance_bs;
    new.escrow_status := old.escrow_status;
    new.escrow_account := old.escrow_account;
    new.stellar_escrow_id := old.stellar_escrow_id;
    new.commission_bs := old.commission_bs;
    new.refund_bs := old.refund_bs;
    new.escrow_attempted_at := old.escrow_attempted_at;
    new.escrow_error := old.escrow_error;
    new.closed_at := old.closed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists events_protect_escrow on public.events;
create trigger events_protect_escrow before insert or update on public.events
  for each row execute function public.protect_escrow_columns();

-- Registra una transacción del escrow y actualiza el saldo en una sola sentencia.
-- Solo la llama el servidor (service role) después de que Stellar confirma.
create or replace function public.record_escrow_tx(p_event uuid, p_kind text, p_amount numeric, p_hash text, p_account text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into escrow_transactions (event_id, kind, amount_bs, tx_hash)
  values (p_event, p_kind, p_amount, p_hash)
  on conflict (tx_hash) do nothing;
  if not found then
    return; -- ya registrada
  end if;
  if p_kind in ('deposito', 'deposito_adicional') then
    update events set
      escrow_balance_bs = escrow_balance_bs + p_amount,
      promo_budget_bs = case when p_kind = 'deposito_adicional' then promo_budget_bs + p_amount else greatest(promo_budget_bs, p_amount) end,
      escrow_account = coalesce(p_account, escrow_account),
      escrow_status = 'activo',
      escrow_error = null
    where id = p_event;
  else
    update events set escrow_balance_bs = greatest(0, escrow_balance_bs - p_amount) where id = p_event;
  end if;
end;
$$;
revoke all on function public.record_escrow_tx(uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.record_escrow_tx(uuid, text, numeric, text, text) to service_role;

-- 5. Clics sin código --------------------------------------------------------------

alter table public.clicks alter column code drop not null;

drop function if exists public.record_click(uuid, text, text);
create function public.record_click(p_event uuid, p_channel text, p_anon text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
begin
  select e.ticket_url into v_url from events e where e.id = p_event and e.status = 'publicado';
  if not found then
    return null;
  end if;
  insert into clicks (event_id, user_id, anon_id, channel)
  values (
    p_event,
    auth.uid(),
    left(p_anon, 64),
    case when p_channel in ('whatsapp', 'mapa', 'amigo', 'busqueda') then p_channel end
  );
  return coalesce(v_url, '');
end;
$$;
grant execute on function public.record_click(uuid, text, text) to anon, authenticated;

-- 6. Simulador del panel: ventas en vez de canjes ----------------------------------

create or replace function public.simulate_activity(p_event uuid, p_kind text, p_n int, p_channel text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_channel text := case when p_channel in ('whatsapp', 'mapa', 'amigo', 'busqueda') then p_channel end;
begin
  if not owns_event(p_event) then
    raise exception 'no autorizado';
  end if;
  p_n := least(greatest(coalesce(p_n, 1), 1), 100);

  if p_kind = 'vistas' then
    insert into views (event_id, anon_id, channel, is_sample)
    select p_event, 'simulado', v_channel, true from generate_series(1, p_n);
    return p_n;
  elsif p_kind = 'clics' then
    insert into clicks (event_id, anon_id, channel, is_sample)
    select p_event, 'simulado', v_channel, true from generate_series(1, p_n);
    return p_n;
  elsif p_kind = 'ventas' then
    if not event_open_for_sales(p_event) then
      return 0;
    end if;
    insert into sales_confirmations (event_id, source, quantity, is_sample)
    values (p_event, 'ticketera', p_n, true);
    return p_n;
  end if;
  raise exception 'tipo desconocido: %', p_kind;
end;
$$;

-- 7. Respaldos de ventas (bucket privado, cada usuario sube a su carpeta) -----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('respaldos', 'respaldos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/vnd.ms-excel', 'text/plain'])
on conflict (id) do nothing;

create policy "respaldos: leer los míos" on storage.objects for select to authenticated
  using (bucket_id = 'respaldos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "respaldos: subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'respaldos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "respaldos: borrar los míos" on storage.objects for delete to authenticated
  using (bucket_id = 'respaldos' and (storage.foldername(name))[1] = auth.uid()::text);
