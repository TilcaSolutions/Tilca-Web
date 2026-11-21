"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/organizer";
import { cobrarCanje, reintentarCobro } from "@/lib/stellar/payment";

/** "Destacar en la cartelera": crea una solicitud que el equipo revisa a mano. */
export async function requestFeature(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  const { supabase, organizer } = await requireOrganizer();
  const { data: existing } = await supabase
    .from("feature_requests")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "pendiente")
    .maybeSingle();
  if (!existing) {
    await supabase.from("feature_requests").insert({ event_id: eventId, organizer_id: organizer.id });
  }
  revalidatePath("/panel", "layout");
}

export interface RedeemState {
  message?: string;
  tone?: "ok" | "error";
  txHash?: string;
}

const REDEEM_MESSAGES: Record<string, string> = {
  ok: "Código canjeado.",
  no_existe: "Ese código no existe. Revisa que esté bien escrito.",
  otro_organizador: "Ese código es de un evento de otro organizador.",
  ya_canjeado: "Ese código ya estaba canjeado.",
};

export async function redeemCode(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const code = String(formData.get("code") ?? "").trim();
  const isNew = formData.get("is_new") === "on";
  if (!code) return { message: "Escribe un código.", tone: "error" };
  const { supabase, organizer } = await requireOrganizer();
  const { data, error } = await supabase.rpc("redeem_code", { p_code: code, p_new_audience: isNew });
  if (error) return { message: "No pudimos canjear el código. Inténtalo de nuevo.", tone: "error" };

  let txHash: string | undefined;
  let chargeNote = "";

  // Canje hecho: cobramos en Stellar Testnet. Si falla, el canje igual vale y el cobro queda pendiente.
  if (data === "ok" && isNew) {
    const clickId = await clickIdForCode(supabase, code);
    if (clickId !== null) {
      const charge = await cobrarCanje({ clickId, organizerId: organizer.id });
      txHash = charge.txHash;
      if (charge.status === "pendiente") chargeNote = " El cobro en Stellar quedó pendiente; puedes reintentarlo en Presupuesto.";
    }
  }

  revalidatePath("/panel", "layout");
  return {
    message: (REDEEM_MESSAGES[data as string] ?? "Listo.") + chargeNote,
    tone: data === "ok" ? "ok" : "error",
    txHash,
  };
}

export async function unredeemCode(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const { supabase } = await requireOrganizer();
  await supabase.rpc("unredeem_code", { p_code: code });
  revalidatePath("/panel", "layout");
}

/** El código normalizado como lo guarda `record_click` ("tilca-8kdd" -> "TILCA-8KDD"). */
function normalizeCode(code: string) {
  const norm = code.toUpperCase().replace(/\s/g, "");
  return norm.startsWith("TILCA-") ? norm : `TILCA-${norm}`;
}

async function clickIdForCode(supabase: Awaited<ReturnType<typeof requireOrganizer>>["supabase"], code: string) {
  const { data } = await supabase.from("clicks").select("id").eq("code", normalizeCode(code)).maybeSingle();
  return data ? Number(data.id) : null;
}

export interface CsvState {
  message?: string;
  tone?: "ok" | "error";
}

/**
 * CSV con los códigos usados. Acepta una columna con el código y, opcional,
 * una columna "nuevo" (sí/no, 1/0, true/false). Separador coma o punto y coma.
 */
export async function importCsv(_prev: CsvState, formData: FormData): Promise<CsvState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Elige un archivo CSV.", tone: "error" };
  if (file.size > 1_000_000) return { message: "El archivo es muy grande (máximo 1 MB).", tone: "error" };

  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = lines.map((l) => l.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, "")));
  const header = rows[0]?.map((h) => h.toLowerCase()) ?? [];
  const hasHeader = header.some((h) => /codigo|código|code|nuevo|new/.test(h));
  const codeIdx = hasHeader ? Math.max(0, header.findIndex((h) => /codigo|código|code/.test(h))) : 0;
  const newIdx = hasHeader ? header.findIndex((h) => /nuevo|new/.test(h)) : rows[0]?.length > 1 ? 1 : -1;
  const body = hasHeader ? rows.slice(1) : rows;

  const { supabase, organizer } = await requireOrganizer();
  const counts: Record<string, number> = {};
  const toCharge: number[] = [];
  for (const r of body.slice(0, 2000)) {
    const code = r[codeIdx];
    if (!code) continue;
    const isNew = newIdx >= 0 && /^(s[ií]|si|1|true|x|nuevo|yes)$/i.test(r[newIdx] ?? "");
    const { data } = await supabase.rpc("redeem_code", { p_code: code, p_new_audience: isNew });
    const key = (data as string) ?? "error";
    counts[key] = (counts[key] ?? 0) + 1;

    if (data === "ok" && isNew) {
      const clickId = await clickIdForCode(supabase, code);
      if (clickId !== null) toCharge.push(clickId);
    }
  }

  // Cobros uno por uno: en paralelo, las transacciones de la misma cuenta chocan por el número de secuencia.
  let pending = 0;
  for (const clickId of toCharge) {
    const charge = await cobrarCanje({ clickId, organizerId: organizer.id });
    if (charge.status === "pendiente") pending++;
  }
  revalidatePath("/panel", "layout");

  const parts = [`${counts.ok ?? 0} canjeados`];
  if (counts.ya_canjeado) parts.push(`${counts.ya_canjeado} ya estaban canjeados`);
  if (counts.no_existe) parts.push(`${counts.no_existe} no existen`);
  if (counts.otro_organizador) parts.push(`${counts.otro_organizador} son de otro organizador`);
  if (pending) parts.push(`${pending} cobros en Stellar quedaron pendientes`);
  return { message: `${parts.join(", ")}.`, tone: counts.ok ? "ok" : "error" };
}

/** Total de entradas vendidas que reporta el organizador (incluye las que no vinieron de TILCA). */
export async function updateTicketsSold(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  const sold = Math.max(0, Math.floor(Number(formData.get("tickets_sold") ?? 0)));
  const { supabase } = await requireOrganizer();
  await supabase.from("events").update({ tickets_sold: sold }).eq("id", eventId);
  revalidatePath("/panel", "layout");
}

/** Reintenta un cobro fallido o pendiente en Stellar Testnet */
export async function retryStellarCharge(formData: FormData) {
  const clickId = String(formData.get("click_id") ?? "");
  const { organizer } = await requireOrganizer();
  await reintentarCobro(clickId, organizer.id);
  revalidatePath("/panel", "layout");
}

/** Agrega más presupuesto de promoción a un evento */
export async function addEventBudget(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  const amountBs = Math.max(0, Number(formData.get("amount_bs") ?? 0));
  if (amountBs <= 0) return;

  const { supabase } = await requireOrganizer();
  const { data: event } = await supabase
    .from("events")
    .select("promo_budget_bs, escrow_balance_bs")
    .eq("id", eventId)
    .maybeSingle();

  if (event) {
    const newBudget = (event.promo_budget_bs ?? 0) + amountBs;
    const newBalance = (event.escrow_balance_bs ?? 0) + amountBs;
    await supabase
      .from("events")
      .update({
        promo_budget_bs: newBudget,
        escrow_balance_bs: newBalance,
        escrow_status: "activo",
      })
      .eq("id", eventId);
  }
  revalidatePath("/panel", "layout");
}

/** Cierra el evento y reembolsa el saldo no usado de Stellar Escrow al organizador */
export async function closeEventAndRefund(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  const { supabase } = await requireOrganizer();

  await supabase
    .from("events")
    .update({
      escrow_status: "reembolsado",
      escrow_balance_bs: 0,
    })
    .eq("id", eventId);

  revalidatePath("/panel", "layout");
}
