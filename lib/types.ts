import type { Category, SalesChannel } from "./constants";

export type EventStatus = "borrador" | "publicado";
export type EscrowStatus =
  | "sin_escrow"
  | "deposito_pendiente"
  | "depositando"
  | "activo"
  | "cerrando"
  | "cierre_pendiente"
  | "cerrado"
  | "agotado" // modelo anterior
  | "reembolsado"; // modelo anterior

export interface TilcaEvent {
  id: string;
  organizer_id: string;
  title: string;
  category: Category;
  subcategory: string | null;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  duration_min: number | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_zone: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  presale_price: number | null;
  presale_until: string | null;
  capacity: number | null;
  tickets_sold: number;
  description: string | null;
  poster_url: string | null;
  ticket_url: string | null;
  trailer_url: string | null;
  published_at: string | null;
  /** Código de descuento que el organizador creó en su ticketera (ej. TILCA10). */
  discount_code: string | null;
  discount_amount: number | null;
  discount_unit: "bs" | "pct" | null;
  sales_channels: SalesChannel[];
  expected_sales: number | null;
  /** Depósito en el escrow (lo planeado al publicar más los depósitos adicionales). */
  promo_budget_bs?: number;
  escrow_status?: EscrowStatus;
  /** Lo que hay hoy en el escrow. */
  escrow_balance_bs?: number;
  escrow_account?: string | null;
  commission_bs?: number | null;
  refund_bs?: number | null;
  escrow_error?: string | null;
  closed_at?: string | null;
  is_sample: boolean;
  /** Ticketera de la que se importó ('superticket'); null si lo publicó un organizador. */
  source?: string | null;
  created_at: string;
  organizers?: {
    name: string;
    stellar_public_key?: string | null;
  } | null;
}

/** Evento publicado, listo para el mapa (con coordenadas y fecha). */
export type PublicEvent = TilcaEvent & {
  starts_at: string;
  lat: number;
  lng: number;
  venue_name: string;
  price: number;
};

/** Columnas públicas base (compatibles con cualquier versión del esquema) */
export const EVENT_COLUMNS =
  "id, organizer_id, title, category, subcategory, status, starts_at, ends_at, duration_min, venue_name, venue_address, venue_zone, lat, lng, price, presale_price, presale_until, capacity, tickets_sold, description, poster_url, ticket_url, trailer_url, published_at, discount_code, discount_amount, discount_unit, sales_channels, expected_sales, is_sample, source, created_at, organizers(name)";

/** Columnas completas con integración de Stellar Escrow para el panel */
export const EVENT_PANEL_COLUMNS =
  "id, organizer_id, title, category, subcategory, status, starts_at, ends_at, duration_min, venue_name, venue_address, venue_zone, lat, lng, price, presale_price, presale_until, capacity, tickets_sold, description, poster_url, ticket_url, trailer_url, published_at, discount_code, discount_amount, discount_unit, sales_channels, expected_sales, promo_budget_bs, escrow_status, escrow_balance_bs, escrow_account, commission_bs, refund_bs, escrow_error, closed_at, is_sample, source, created_at, organizers(name, stellar_public_key)";
