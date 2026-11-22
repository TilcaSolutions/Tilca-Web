-- TILCA: ticketera de prueba (solo para probar el flujo de punta a punta).
--
-- Simula una ticketera externa: el público elige butacas, usa el código de descuento
-- TILCA del evento y "paga" (no se cobra nada). El organizador ve el reporte de estas
-- ventas, como vería el de su ticketera real, y las confirma en "Confirmar ventas".
-- La app solo la usa con NEXT_PUBLIC_ENABLE_SIMULATOR=true.

create table if not exists public.test_ticket_sales (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  seats text[] not null check (cardinality(seats) between 1 and 8),
  quantity integer not null check (quantity between 1 and 8),
  unit_price numeric(8, 2) not null check (unit_price >= 0),
  discount_code text,            -- el código que usó (null = compró sin código TILCA)
  discount_bs numeric(10, 2) not null default 0 check (discount_bs >= 0),
  total_bs numeric(10, 2) not null check (total_bs >= 0),
  buyer_name text not null,
  payment_method text not null check (payment_method in ('tarjeta', 'qr')),
  confirmed_at timestamptz,      -- cuándo el organizador la confirmó en TILCA desde el reporte
  created_at timestamptz not null default now()
);
create index if not exists test_ticket_sales_event_idx on public.test_ticket_sales (event_id, created_at);
alter table public.test_ticket_sales enable row level security;

-- Las compras las registra el servidor (service role); el organizador lee el reporte de sus eventos.
create policy "ticketera de prueba: reporte del dueño" on public.test_ticket_sales for select
  using (public.owns_event(event_id));
revoke insert, update, delete on public.test_ticket_sales from anon, authenticated;
