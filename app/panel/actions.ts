"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/organizer";
import { formatBs } from "@/lib/format";
import { closeEscrow, depositToEscrow } from "@/lib/stellar/escrow";

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

/** Total de entradas vendidas que reporta el organizador (incluye las que no vinieron de TILCA). */
export async function updateTicketsSold(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  const sold = Math.max(0, Math.floor(Number(formData.get("tickets_sold") ?? 0)));
  const { supabase } = await requireOrganizer();
  await supabase.from("events").update({ tickets_sold: sold }).eq("id", eventId);
  revalidatePath("/panel", "layout");
}

// --- Confirmar ventas y cerrar el evento ------------------------------------

export interface SalesState {
  message?: string;
  tone?: "ok" | "error";
  missingBs?: number;
}

const ID = /^[0-9a-f-]{36}$/i;

/** El evento del organizador actual (o null). */
async function ownEvent(eventId: string) {
  const ctx = await requireOrganizer();
  if (!ID.test(eventId)) return { ...ctx, event: null };
  const { data: event } = await ctx.supabase
    .from("events")
    .select("id, price, escrow_status")
    .eq("id", eventId)
    .eq("organizer_id", ctx.organizer.id)
    .maybeSingle();
  return { ...ctx, event };
}

function refresh(eventId: string) {
  revalidatePath(`/panel/evento/${eventId}`, "layout");
  revalidatePath("/panel", "layout");
}

/** Ventas por ticketera: cuántas entradas se vendieron con el código (con respaldo opcional). */
export async function confirmTicketSales(_prev: SalesState, fd: FormData): Promise<SalesState> {
  const eventId = String(fd.get("event_id") ?? "");
  const quantity = Math.floor(Number(String(fd.get("quantity") ?? "").replace(",", ".")));
  const evidence = String(fd.get("evidence_path") ?? "") || null;
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100000) {
    return { message: "Escribe cuántas entradas se vendieron con el código.", tone: "error" };
  }
  const { supabase, user, event } = await ownEvent(eventId);
  if (!event) return { message: "No encontramos ese evento.", tone: "error" };
  // El respaldo tiene que estar en la carpeta del usuario (el bucket ya lo exige al subir).
  if (evidence && !evidence.startsWith(`${user.id}/`)) return { message: "El respaldo no es válido.", tone: "error" };
  const { error } = await supabase
    .from("sales_confirmations")
    .insert({ event_id: eventId, source: "ticketera", quantity, evidence_path: evidence });
  if (error) return { message: "No pudimos guardar la confirmación. ¿El evento ya está cerrado?", tone: "error" };
  refresh(eventId);
  return { message: `Listo: ${quantity} ${quantity === 1 ? "entrada confirmada" : "entradas confirmadas"}.`, tone: "ok" };
}

/** "+1 vino por TILCA": una venta por QR o en puerta. */
export async function addDoorSale(fd: FormData) {
  const eventId = String(fd.get("event_id") ?? "");
  const { supabase, event } = await ownEvent(eventId);
  if (!event) return;
  await supabase.from("sales_confirmations").insert({ event_id: eventId, source: "puerta", quantity: 1 });
  refresh(eventId);
}

/** Borra una confirmación (para corregir antes del cierre). */
export async function deleteSale(fd: FormData) {
  const eventId = String(fd.get("event_id") ?? "");
  const saleId = Number(fd.get("sale_id"));
  const { supabase, event } = await ownEvent(eventId);
  if (!event || !Number.isInteger(saleId)) return;
  const { data: row } = await supabase
    .from("sales_confirmations")
    .delete()
    .eq("id", saleId)
    .eq("event_id", eventId)
    .select("evidence_path")
    .maybeSingle();
  if (row?.evidence_path) await supabase.storage.from("respaldos").remove([row.evidence_path]);
  refresh(eventId);
}

/** Cierra el evento: paga la comisión a TILCA y devuelve el resto del depósito. */
export async function closeEvent(_prev: SalesState, fd: FormData): Promise<SalesState> {
  const eventId = String(fd.get("event_id") ?? "");
  const { organizer, event } = await ownEvent(eventId);
  if (!event) return { message: "No encontramos ese evento.", tone: "error" };
  const outcome = await closeEscrow({ eventId, organizerId: organizer.id });
  refresh(eventId);
  if (outcome.ok) return { message: "Evento cerrado. Los comprobantes ya están en Stellar.", tone: "ok" };
  if (outcome.reason === "no_alcanza") {
    return { message: `Tu depósito no alcanza: faltan ${formatBs(outcome.missingBs)}.`, tone: "error", missingBs: outcome.missingBs };
  }
  if (outcome.reason === "stellar") {
    return { message: "Stellar no respondió. El cierre quedó pendiente de cobro: puedes reintentarlo.", tone: "error" };
  }
  return { message: outcome.message, tone: "error" };
}

/** Depósito adicional (o el primero, si el evento no tenía). */
export async function addDeposit(_prev: SalesState, fd: FormData): Promise<SalesState> {
  const eventId = String(fd.get("event_id") ?? "");
  const amount = Math.round(Number(String(fd.get("amount_bs") ?? "").replace(",", ".")) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return { message: "Escribe un monto válido.", tone: "error" };
  const { organizer, event } = await ownEvent(eventId);
  if (!event) return { message: "No encontramos ese evento.", tone: "error" };
  const outcome = await depositToEscrow({ eventId, organizerId: organizer.id, amountBs: amount, initial: false });
  refresh(eventId);
  if (outcome.ok) return { message: `Depositaste ${formatBs(amount)} en el escrow.`, tone: "ok" };
  return {
    message: outcome.reason === "stellar" ? "Stellar no respondió. Intenta el depósito de nuevo en un momento." : outcome.message,
    tone: "error",
  };
}

/** Reintenta el depósito de la publicación que no llegó a Stellar. */
export async function retryDeposit(fd: FormData) {
  const eventId = String(fd.get("event_id") ?? "");
  const { organizer, event } = await ownEvent(eventId);
  if (!event) return;
  await depositToEscrow({ eventId, organizerId: organizer.id, initial: true });
  refresh(eventId);
}
