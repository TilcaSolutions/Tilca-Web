-- TILCA: esquema inicial del prototipo
-- Tablas, seguridad (RLS), funciones de medición y almacenamiento de afiches.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfiles y organizadores
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'publico' check (role in ('publico', 'organizador')),
  display_name text,
  created_at timestamptz not null default now()
);

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  title text not null,
  category text not null check (category in ('teatro', 'musica', 'danza', 'standup', 'arte')),
  subcategory text,                       -- ej. "comedia", "exposición"
  status text not null default 'borrador' check (status in ('borrador', 'publicado')),
  starts_at timestamptz,                  -- null solo en borradores
  ends_at timestamptz,                    -- para exposiciones o temporadas
  duration_min integer check (duration_min > 0),
  venue_name text,
  venue_address text,
  venue_zone text,                        -- barrio: Centro, Sopocachi...
  lat double precision,
  lng double precision,
  price numeric(8, 2) check (price >= 0), -- 0 = gratis
  presale_price numeric(8, 2) check (presale_price >= 0),
  presale_until timestamptz,
  capacity integer check (capacity > 0),
  tickets_sold integer not null default 0 check (tickets_sold >= 0), -- total que reporta el organizador
  description text,
  poster_url text,
  ticket_url text,
  trailer_url text,
  published_at timestamptz,
  sample_saves integer not null default 0, -- solo para datos de ejemplo
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_events_are_complete check (
    status = 'borrador' or (
      starts_at is not null and lat is not null and lng is not null
      and venue_name is not null and price is not null
    )
  )
);

create index events_public_idx on public.events (status, starts_at);
create index events_organizer_idx on public.events (organizer_id);

create table public.saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---------------------------------------------------------------------------
-- Medición: vistas, clics en comprar (con código TILCA) y solicitudes
-- ---------------------------------------------------------------------------

create table public.views (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  anon_id text,
  channel text check (channel in ('whatsapp', 'mapa', 'amigo', 'busqueda')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index views_event_idx on public.views (event_id, created_at);

create table public.clicks (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  anon_id text,
  channel text check (channel in ('whatsapp', 'mapa', 'amigo', 'busqueda')),
  code text not null unique,
  redeemed_at timestamptz,
  is_new_audience boolean,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index clicks_event_idx on public.clicks (event_id, created_at);
create index clicks_redeemed_idx on public.clicks (event_id, redeemed_at);

create table public.feature_requests (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ayudantes
-- ---------------------------------------------------------------------------

create or replace function public.owns_organizer(p_organizer uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from organizers where id = p_organizer and owner_id = auth.uid());
$$;

create or replace function public.owns_event(p_event uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e join organizers o on o.id = e.organizer_id
    where e.id = p_event and o.owner_id = auth.uid()
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'publicado' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger events_touch before insert or update on public.events
for each row execute function public.touch_updated_at();

-- Crea el perfil (y el organizador, si corresponde) al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'publico');
  v_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'org_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );
begin
  if v_role not in ('publico', 'organizador') then
    v_role := 'publico';
  end if;
  insert into profiles (id, role, display_name) values (new.id, v_role, v_name)
  on conflict (id) do nothing;
  if v_role = 'organizador' then
    insert into organizers (owner_id, name) values (new.id, v_name)
    on conflict (owner_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Convierte la cuenta actual en organizador (usado tras entrar con Google).
create or replace function public.become_organizer(p_name text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'no autenticado';
  end if;
  insert into profiles (id, role) values (v_uid, 'organizador')
  on conflict (id) do update set role = 'organizador';
  select id into v_org from organizers where owner_id = v_uid;
  if v_org is null then
    insert into organizers (owner_id, name)
    values (
      v_uid,
      coalesce(nullif(p_name, ''), (select coalesce(display_name, 'Mi compañía') from profiles where id = v_uid))
    )
    returning id into v_org;
  end if;
  return v_org;
end;
$$;

-- Registra una vista de la ficha. Funciona sin cuenta (anon_id).
create or replace function public.record_view(p_event uuid, p_channel text, p_anon text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from events where id = p_event and status = 'publicado') then
    return;
  end if;
  insert into views (event_id, user_id, anon_id, channel)
  values (
    p_event,
    auth.uid(),
    left(p_anon, 64),
    case when p_channel in ('whatsapp', 'mapa', 'amigo', 'busqueda') then p_channel end
  );
end;
$$;

-- Registra un clic en comprar y genera un código TILCA-XXXX único.
create or replace function public.record_click(p_event uuid, p_channel text, p_anon text)
returns table (code text, ticket_url text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_url text;
  i int;
begin
  select e.ticket_url into v_url from events e where e.id = p_event and e.status = 'publicado';
  if not found then
    return;
  end if;
  loop
    v_code := 'TILCA-';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into clicks (event_id, user_id, anon_id, channel, code)
      values (
        p_event,
        auth.uid(),
        left(p_anon, 64),
        case when p_channel in ('whatsapp', 'mapa', 'amigo', 'busqueda') then p_channel end,
        v_code
      );
      exit;
    exception when unique_violation then
      -- código repetido: probar otro
    end;
  end loop;
  return query select v_code, v_url;
end;
$$;

-- Marca un código como canjeado. Solo el dueño del evento puede hacerlo.
create or replace function public.redeem_code(p_code text, p_new_audience boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_click clicks%rowtype;
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if v_norm !~ '^TILCA-' then
    v_norm := 'TILCA-' || v_norm;
  end if;
  select * into v_click from clicks where code = v_norm;
  if not found then
    return 'no_existe';
  end if;
  if not owns_event(v_click.event_id) then
    return 'otro_organizador';
  end if;
  if v_click.redeemed_at is not null then
    return 'ya_canjeado';
  end if;
  update clicks set redeemed_at = now(), is_new_audience = coalesce(p_new_audience, false)
  where id = v_click.id;
  return 'ok';
end;
$$;

-- Deshace un canje (por si el organizador se equivocó).
create or replace function public.unredeem_code(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_click clicks%rowtype;
begin
  select * into v_click from clicks where code = upper(p_code);
  if not found then
    return 'no_existe';
  end if;
  if not owns_event(v_click.event_id) then
    return 'otro_organizador';
  end if;
  update clicks set redeemed_at = null, is_new_audience = null where id = v_click.id;
  return 'ok';
end;
$$;

-- Cuántas personas guardaron un evento (público, sin revelar quiénes).
create or replace function public.event_save_count(p_event uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select (select count(*) from saves where event_id = p_event)::int
       + coalesce((select sample_saves from events where id = p_event), 0);
$$;

-- ---------------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.saves enable row level security;
alter table public.views enable row level security;
alter table public.clicks enable row level security;
alter table public.feature_requests enable row level security;

create policy "perfil propio: leer" on public.profiles for select using (id = auth.uid());
create policy "perfil propio: editar" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "organizadores: lectura pública" on public.organizers for select using (true);
create policy "organizador propio: editar" on public.organizers for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "eventos: publicados o propios" on public.events for select
  using (status = 'publicado' or public.owns_organizer(organizer_id));
create policy "eventos propios: crear" on public.events for insert
  with check (public.owns_organizer(organizer_id));
create policy "eventos propios: editar" on public.events for update
  using (public.owns_organizer(organizer_id)) with check (public.owns_organizer(organizer_id));
create policy "eventos propios: borrar" on public.events for delete
  using (public.owns_organizer(organizer_id));

create policy "guardados propios: leer" on public.saves for select using (user_id = auth.uid());
create policy "guardados propios: crear" on public.saves for insert with check (user_id = auth.uid());
create policy "guardados propios: borrar" on public.saves for delete using (user_id = auth.uid());

-- Vistas y clics: se escriben solo con record_view / record_click.
create policy "vistas: dueño del evento" on public.views for select using (public.owns_event(event_id));
create policy "clics: dueño del evento" on public.clicks for select using (public.owns_event(event_id));

create policy "solicitudes propias: leer" on public.feature_requests for select
  using (public.owns_organizer(organizer_id));
create policy "solicitudes propias: crear" on public.feature_requests for insert
  with check (public.owns_organizer(organizer_id) and public.owns_event(event_id));

grant execute on function public.record_view(uuid, text, text) to anon, authenticated;
grant execute on function public.record_click(uuid, text, text) to anon, authenticated;
grant execute on function public.event_save_count(uuid) to anon, authenticated;
grant execute on function public.redeem_code(text, boolean) to authenticated;
grant execute on function public.unredeem_code(text) to authenticated;
grant execute on function public.become_organizer(text) to authenticated;
-- Postgres da permiso de ejecutar a PUBLIC por defecto: lo quitamos en las funciones de organizador.
revoke execute on function public.redeem_code(text, boolean) from public, anon;
revoke execute on function public.unredeem_code(text) from public, anon;
revoke execute on function public.become_organizer(text) from public, anon;

-- ---------------------------------------------------------------------------
-- Almacenamiento de afiches (bucket público, cada usuario sube a su carpeta)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('afiches', 'afiches', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "afiches: lectura pública" on storage.objects for select
  using (bucket_id = 'afiches');
create policy "afiches: subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'afiches' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "afiches: reemplazar en mi carpeta" on storage.objects for update to authenticated
  using (bucket_id = 'afiches' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "afiches: borrar de mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'afiches' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Simulador para probar el panel (solo el dueño del evento; filas marcadas is_sample)
-- ---------------------------------------------------------------------------

create or replace function public.simulate_activity(p_event uuid, p_kind text, p_n int, p_channel text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_channel text := case when p_channel in ('whatsapp', 'mapa', 'amigo', 'busqueda') then p_channel end;
  v_done int := 0;
  v_code text;
  v_id bigint;
  i int;
  j int;
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
    for i in 1..p_n loop
      loop
        v_code := 'TILCA-';
        for j in 1..4 loop
          v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
        end loop;
        begin
          insert into clicks (event_id, anon_id, channel, code, is_sample)
          values (p_event, 'simulado', v_channel, v_code, true);
          exit;
        exception when unique_violation then
        end;
      end loop;
      v_done := v_done + 1;
    end loop;
    return v_done;
  elsif p_kind = 'canjes' then
    for i in 1..p_n loop
      select id into v_id from clicks
      where event_id = p_event and redeemed_at is null
      order by created_at desc limit 1;
      exit when v_id is null;
      update clicks set redeemed_at = now(), is_new_audience = random() < 0.7 where id = v_id;
      v_done := v_done + 1;
      v_id := null;
    end loop;
    return v_done;
  end if;
  raise exception 'tipo desconocido: %', p_kind;
end;
$$;

grant execute on function public.simulate_activity(uuid, text, int, text) to authenticated;
revoke execute on function public.simulate_activity(uuid, text, int, text) from public, anon;
