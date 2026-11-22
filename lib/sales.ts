import type { SupabaseClient } from "@supabase/supabase-js";
import { commissionFor } from "./constants";
import type { SaleRow } from "./stats";
import type { TilcaEvent } from "./types";

export interface EscrowTx {
  id: number;
  kind: "deposito" | "deposito_adicional" | "comision" | "devolucion";
  amount_bs: number;
  tx_hash: string;
  created_at: string;
}

export const TX_LABELS: Record<EscrowTx["kind"], string> = {
  deposito: "Depósito",
  deposito_adicional: "Depósito adicional",
  comision: "Comisión a TILCA",
  devolucion: "Devolución al organizador",
};

export interface SalesSummary {
  sales: SaleRow[];
  txs: EscrowTx[];
  ticketera: number;
  puerta: number;
  /** Entradas confirmadas con el código. */
  total: number;
  /** Comisión de TILCA sobre lo confirmado (precio normal × 5%). */
  commission: number;
  /** Depositado en el escrow (según los comprobantes). */
  deposited: number;
  /** Lo que hay hoy en el escrow. */
  balance: number;
  /** Lo que volvería al organizador si cierra ahora. */
  refund: number;
  /** Lo que falta depositar para cubrir la comisión. */
  missing: number;
  /** Cobrado y devuelto al cerrar. */
  paidCommission: number;
  refunded: number;
}

/** Ventas confirmadas, comprobantes y montos del escrow de un evento (con el cliente del organizador). */
export async function loadSalesSummary(supabase: SupabaseClient, event: TilcaEvent): Promise<SalesSummary> {
  const [salesRes, txRes] = await Promise.all([
    supabase
      .from("sales_confirmations")
      .select("id, source, quantity, evidence_path, is_sample, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
    supabase.from("escrow_transactions").select("id, kind, amount_bs, tx_hash, created_at").eq("event_id", event.id).order("created_at"),
  ]);
  const sales = (salesRes.data ?? []) as SaleRow[];
  const txs = (txRes.data ?? []) as EscrowTx[];
  const sum = (kinds: EscrowTx["kind"][]) => txs.filter((t) => kinds.includes(t.kind)).reduce((s, t) => s + Number(t.amount_bs), 0);

  const ticketera = sales.filter((s) => s.source === "ticketera").reduce((n, s) => n + Number(s.quantity), 0);
  const puerta = sales.filter((s) => s.source === "puerta").reduce((n, s) => n + Number(s.quantity), 0);
  const total = ticketera + puerta;
  const commission = commissionFor(total, Number(event.price ?? 0));
  const paidCommission = sum(["comision"]);
  const balance = Number(event.escrow_balance_bs ?? 0);
  const owed = Math.max(0, commission - paidCommission);
  return {
    sales,
    txs,
    ticketera,
    puerta,
    total,
    commission,
    deposited: sum(["deposito", "deposito_adicional"]),
    balance,
    refund: Math.max(0, Math.round((balance - owed) * 100) / 100),
    missing: Math.max(0, Math.round((owed - balance) * 100) / 100),
    paidCommission,
    refunded: sum(["devolucion"]),
  };
}
