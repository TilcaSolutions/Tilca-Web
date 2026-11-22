/**
 * Ticketera de prueba: plano de butacas y precios. Solo para probar el flujo con
 * NEXT_PUBLIC_ENABLE_SIMULATOR=true (no es una ticketera real ni cobra nada).
 */
import { commissionFor } from "./constants";

export const TEST_TICKETING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SIMULATOR === "true";

export const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const SEATS_PER_ROW = 14;
export const MAX_SEATS = 8;

export function allSeats() {
  return ROWS.flatMap((r) => Array.from({ length: SEATS_PER_ROW }, (_, i) => `${r}${i + 1}`));
}

/** Butacas que "ya vendió" la ticketera por otros canales: fijas para cada evento (~30%). */
export function soldElsewhere(eventId: string) {
  let h = 0;
  for (const c of eventId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = new Set<string>();
  for (const seat of allSeats()) {
    h = (h * 1664525 + 1013904223) >>> 0;
    if (h / 4294967296 < 0.3) out.add(seat);
  }
  return out;
}

export interface Pricing {
  unitPrice: number;
  codeValid: boolean;
  discountPerTicket: number;
  subtotal: number;
  discount: number;
  total: number;
  /** Lo que TILCA cobra por estas entradas si el organizador las confirma (5% del precio). */
  tilcaCommission: number;
}

/** Precio de la compra. El descuento lo da el organizador; la comisión de TILCA va sobre el precio normal. */
export function pricing(
  event: { price: number | null; discount_code: string | null; discount_amount: number | null; discount_unit: "bs" | "pct" | null },
  quantity: number,
  code: string,
): Pricing {
  const unitPrice = Number(event.price ?? 0);
  const codeValid = !!event.discount_code && code.trim().toUpperCase() === event.discount_code.toUpperCase();
  const amount = Number(event.discount_amount ?? 0);
  const discountPerTicket = !codeValid ? 0 : event.discount_unit === "pct" ? Math.round(unitPrice * amount) / 100 : Math.min(unitPrice, amount);
  const subtotal = unitPrice * quantity;
  const discount = Math.round(discountPerTicket * quantity * 100) / 100;
  return {
    unitPrice,
    codeValid,
    discountPerTicket,
    subtotal,
    discount,
    total: Math.max(0, Math.round((subtotal - discount) * 100) / 100),
    tilcaCommission: codeValid ? commissionFor(quantity, unitPrice) : 0,
  };
}
