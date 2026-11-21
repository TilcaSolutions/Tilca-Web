-- TILCA: Integración con Stellar Testnet y Trustless Work (Escrow)

-- 1. Cuentas Stellar de los organizadores (claves de Testnet)
alter table public.organizers
  add column if not exists stellar_public_key text,
  add column if not exists stellar_secret_encrypted text;

-- 2. Presupuesto de promoción y estado del Escrow en eventos
alter table public.events
  add column if not exists promo_budget_bs numeric(8, 2) not null default 0 check (promo_budget_bs >= 0),
  add column if not exists stellar_escrow_id text,
  add column if not exists escrow_status text not null default 'sin_escrow' check (escrow_status in ('sin_escrow', 'activo', 'agotado', 'cerrado', 'reembolsado')),
  add column if not exists escrow_balance_bs numeric(8, 2) not null default 0 check (escrow_balance_bs >= 0);

-- 3. Estado de cobro y hash de transacción Stellar en canjes
alter table public.clicks
  add column if not exists charge_status text default 'no_aplica' check (charge_status in ('no_aplica', 'pendiente', 'cobrado', 'fallido')),
  add column if not exists stellar_tx_hash text,
  add column if not exists charge_error text;

create index if not exists idx_clicks_stellar_tx on public.clicks (stellar_tx_hash);
create index if not exists idx_events_escrow on public.events (stellar_escrow_id);
