-- TILCA: eventos importados de ticketeras (por ahora Superticket).
--
-- Los importa `npm run import:superticket` bajo el organizador "Cartelera TILCA",
-- que maneja el equipo desde el panel normal. Los que el importador no puede
-- confirmar (lugar sin ubicar, precio por sectores, categoría dudosa) quedan en borrador.

alter table public.events
  add column if not exists source text,          -- 'superticket'
  add column if not exists source_key text,      -- id estable en la fuente (url + fecha)
  add column if not exists source_url text,      -- página del evento en la ticketera
  add column if not exists import_notes text;    -- qué falta revisar antes de publicar

create unique index if not exists events_source_key_idx
  on public.events (source, source_key)
  where source is not null;

-- Borradores importados que el equipo borró: el importador no los vuelve a crear.
create table if not exists public.import_ignored (
  source text not null,
  source_key text not null,
  ignored_at timestamptz not null default now(),
  primary key (source, source_key)
);

alter table public.import_ignored enable row level security;
revoke all on public.import_ignored from public, anon, authenticated;
grant all on public.import_ignored to service_role;
