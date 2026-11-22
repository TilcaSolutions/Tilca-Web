-- TILCA: perfil público y personalizable de cada organizador (/o/[slug]).
--
-- La configuración es JSON (tema, colores, portada, animación y bloques). Nunca HTML ni
-- CSS: el servidor la valida al guardar y la página la vuelve a validar al mostrarla.
-- El borrador vive en otra tabla porque el RLS filtra filas, no columnas: así nadie
-- más que el dueño puede leerlo.

-- 1. Dirección del perfil ----------------------------------------------------------

alter table public.organizers add column if not exists slug text;

create or replace function public.slugify(p text)
returns text
language sql immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p, ''), 'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙ''’', 'aeiouunaeiouunaeiouaeiou  ')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- Un slug libre a partir del nombre ("teatro-de-altura", "teatro-de-altura-2"...).
create or replace function public.unique_organizer_slug(p_name text, p_id uuid)
returns text
language plpgsql
as $$
declare
  v_base text := left(coalesce(nullif(public.slugify(p_name), ''), 'organizador'), 60);
  v_slug text := v_base;
  v_n int := 1;
begin
  while exists (select 1 from public.organizers where slug = v_slug and id <> p_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

update public.organizers set slug = public.unique_organizer_slug(name, id) where slug is null;
alter table public.organizers alter column slug set not null;
create unique index if not exists organizers_slug_key on public.organizers (slug);

-- El slug se asigna al crear el organizador y no cambia si se renombra (los links siguen andando).
create or replace function public.organizers_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.unique_organizer_slug(new.name, new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists organizers_slug on public.organizers;
create trigger organizers_slug before insert on public.organizers
  for each row execute function public.organizers_set_slug();

-- El slug no se edita desde el navegador.
create or replace function public.organizers_keep_slug()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.slug := old.slug;
  end if;
  return new;
end;
$$;
drop trigger if exists organizers_keep_slug on public.organizers;
create trigger organizers_keep_slug before update on public.organizers
  for each row execute function public.organizers_keep_slug();

-- 2. Perfil publicado (lectura pública) y borrador (solo el dueño) ------------------

create table if not exists public.organizer_profiles (
  organizer_id uuid primary key references public.organizers (id) on delete cascade,
  config jsonb not null,
  published_at timestamptz not null default now()
);
alter table public.organizer_profiles enable row level security;
create policy "perfiles: lectura pública" on public.organizer_profiles for select using (true);
create policy "perfil propio: crear" on public.organizer_profiles for insert to authenticated
  with check (public.owns_organizer(organizer_id));
create policy "perfil propio: editar" on public.organizer_profiles for update to authenticated
  using (public.owns_organizer(organizer_id)) with check (public.owns_organizer(organizer_id));
create policy "perfil propio: borrar" on public.organizer_profiles for delete to authenticated
  using (public.owns_organizer(organizer_id));

create table if not exists public.organizer_profile_drafts (
  organizer_id uuid primary key references public.organizers (id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.organizer_profile_drafts enable row level security;
create policy "borrador propio: leer" on public.organizer_profile_drafts for select to authenticated
  using (public.owns_organizer(organizer_id));
create policy "borrador propio: crear" on public.organizer_profile_drafts for insert to authenticated
  with check (public.owns_organizer(organizer_id));
create policy "borrador propio: editar" on public.organizer_profile_drafts for update to authenticated
  using (public.owns_organizer(organizer_id)) with check (public.owns_organizer(organizer_id));
create policy "borrador propio: borrar" on public.organizer_profile_drafts for delete to authenticated
  using (public.owns_organizer(organizer_id));

-- 3. Archivos del perfil: portada, foto, galería, elenco y animación propia ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfiles', 'perfiles', true, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "perfiles: lectura de archivos" on storage.objects for select
  using (bucket_id = 'perfiles');
create policy "perfiles: subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'perfiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "perfiles: borrar de mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'perfiles' and (storage.foldername(name))[1] = auth.uid()::text);
