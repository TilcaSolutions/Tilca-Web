-- TILCA: endurecimiento de la integración con Stellar.
--
-- 1. Las llaves privadas de los organizadores salen de `organizers` (que es de
--    lectura pública) y pasan a una tabla que solo el servidor (service role) puede leer.
-- 2. Los cobros se escriben desde el servidor con funciones que solo puede llamar
--    el service role: la app nunca le da al organizador permiso de escribir en `clicks`.
-- 3. Un cobro se "reserva" de forma atómica antes de enviar la transacción, para no
--    pagar dos veces el mismo canje.

-- 1. Llaves privadas fuera de la tabla pública -------------------------------

create table if not exists public.organizer_stellar_secrets (
  organizer_id uuid primary key references public.organizers (id) on delete cascade,
  secret_encrypted text not null,
  created_at timestamptz not null default now()
);

alter table public.organizer_stellar_secrets enable row level security;
-- Sin políticas: anon y authenticated no ven nada. Además quitamos los grants.
revoke all on public.organizer_stellar_secrets from public, anon, authenticated;
grant all on public.organizer_stellar_secrets to service_role;

-- Las llaves que estaban en `organizers` fueron legibles por cualquiera y la clave de
-- cifrado estaba publicada: se consideran comprometidas. No se copian; se borran junto
-- con las claves públicas (varias eran de relleno). `npm run migrate:stellar` crea cuentas nuevas.
alter table public.organizers drop column if exists stellar_secret_encrypted;
update public.organizers set stellar_public_key = null;

-- 2. Estado del cobro ------------------------------------------------------

alter table public.clicks drop constraint if exists clicks_charge_status_check;
alter table public.clicks
  add constraint clicks_charge_status_check
  check (charge_status in ('no_aplica', 'pendiente', 'procesando', 'cobrado', 'fallido'));
alter table public.clicks add column if not exists charge_attempted_at timestamptz;

-- Los hashes del seed anterior eran inventados.
update public.clicks
set stellar_tx_hash = null,
    charge_status = case when is_new_audience then 'pendiente' else 'no_aplica' end,
    charge_error = null
where stellar_tx_hash like 'a1b2c3d4e5f6%';

-- 3. Reserva atómica del cobro -----------------------------------------------

-- Devuelve la fila si este proceso ganó el derecho a cobrar el canje.
-- Solo canjes de público nuevo, ya canjeados y no cobrados. Un 'procesando'
-- de más de 2 minutos se considera abandonado y se puede volver a intentar.
create or replace function public.claim_charge(p_click bigint, p_organizer uuid)
returns table (id bigint, event_id uuid, code text)
language sql
security definer
set search_path = public
as $$
  update public.clicks c
  set charge_status = 'procesando', charge_attempted_at = now(), charge_error = null
  from public.events e
  where c.id = p_click
    and e.id = c.event_id
    and e.organizer_id = p_organizer
    and c.redeemed_at is not null
    and c.is_new_audience
    and c.stellar_tx_hash is null
    and (
      c.charge_status in ('no_aplica', 'pendiente', 'fallido')
      or (c.charge_status = 'procesando' and c.charge_attempted_at < now() - interval '2 minutes')
    )
  returning c.id, c.event_id, c.code;
$$;

-- Marca el cobro como hecho y descuenta del presupuesto en una sola sentencia
-- (sin leer-modificar-escribir desde la app, así dos canjes simultáneos no se pisan).
create or replace function public.complete_charge(p_click bigint, p_tx_hash text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
begin
  update public.clicks
  set charge_status = 'cobrado', stellar_tx_hash = p_tx_hash, charge_error = null
  where id = p_click
  returning event_id into v_event;

  update public.events
  set escrow_balance_bs = greatest(0, escrow_balance_bs - p_amount),
      escrow_status = case
        when escrow_status = 'activo' and escrow_balance_bs - p_amount <= 0 then 'agotado'
        else escrow_status
      end
  where id = v_event and escrow_status in ('activo', 'agotado');
end;
$$;

create or replace function public.fail_charge(p_click bigint, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clicks
  set charge_status = 'pendiente', charge_error = left(p_error, 500)
  where id = p_click and charge_status <> 'cobrado';
$$;

revoke all on function public.claim_charge(bigint, uuid) from public, anon, authenticated;
revoke all on function public.complete_charge(bigint, text, numeric) from public, anon, authenticated;
revoke all on function public.fail_charge(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_charge(bigint, uuid) to service_role;
grant execute on function public.complete_charge(bigint, text, numeric) to service_role;
grant execute on function public.fail_charge(bigint, text) to service_role;
