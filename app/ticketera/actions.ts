"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { allSeats, MAX_SEATS, pricing, soldElsewhere, TEST_TICKETING_ENABLED } from "@/lib/test-ticketing";

export interface BuyResult {
  ok: boolean;
  saleId?: string;
  message?: string;
  taken?: string[];
}

/** Compra en la ticketera de prueba. Los precios y las butacas se vuelven a validar aquí. */
export async function buyTestTickets(input: {
  eventId: string;
  seats: string[];
  code: string;
  name: string;
  payment: "tarjeta" | "qr";
}): Promise<BuyResult> {
  if (!TEST_TICKETING_ENABLED) return { ok: false, message: "La ticketera de prueba está desactivada." };
  const { eventId } = input;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { ok: false, message: "Evento no válido." };
  const seats = [...new Set(input.seats)].filter((s) => allSeats().includes(s)).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  if (!seats.length || seats.length > MAX_SEATS) return { ok: false, message: `Elige entre 1 y ${MAX_SEATS} butacas.` };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, message: "Escribe tu nombre." };

  const db = createAdminClient();
  const { data: event } = await db
    .from("events")
    .select("id, price, status, discount_code, discount_amount, discount_unit")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.status !== "publicado" || !(Number(event.price) > 0)) return { ok: false, message: "Este evento no vende entradas aquí." };

  const { data: sold } = await db.from("test_ticket_sales").select("seats").eq("event_id", eventId);
  const taken = new Set([...soldElsewhere(eventId), ...(sold ?? []).flatMap((s) => s.seats as string[])]);
  const clash = seats.filter((s) => taken.has(s));
  if (clash.length) return { ok: false, message: "Alguien acaba de comprar alguna de esas butacas.", taken: clash };

  const p = pricing(event, seats.length, input.code);
  const { data: sale, error } = await db
    .from("test_ticket_sales")
    .insert({
      event_id: eventId,
      seats,
      quantity: seats.length,
      unit_price: p.unitPrice,
      discount_code: p.codeValid ? event.discount_code : null,
      discount_bs: p.discount,
      total_bs: p.total,
      buyer_name: name,
      payment_method: input.payment === "qr" ? "qr" : "tarjeta",
    })
    .select("id")
    .single();
  if (error || !sale) return { ok: false, message: "No se pudo completar la compra." };
  revalidatePath(`/ticketera/${eventId}`);
  return { ok: true, saleId: sale.id };
}

/**
 * El organizador confirma en TILCA las ventas con código del reporte de la ticketera de
 * prueba que todavía no confirmó (como haría copiando el número de su reporte real).
 */
export async function confirmFromTestReport(fd: FormData) {
  if (!TEST_TICKETING_ENABLED) return;
  const eventId = String(fd.get("event_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return;
  const { supabase, organizer } = await requireOrganizer();
  const { data: event } = await supabase.from("events").select("id").eq("id", eventId).eq("organizer_id", organizer.id).maybeSingle();
  if (!event) return;

  const db = createAdminClient();
  const { data: pending } = await db
    .from("test_ticket_sales")
    .select("id, quantity")
    .eq("event_id", eventId)
    .not("discount_code", "is", null)
    .is("confirmed_at", null);
  const quantity = (pending ?? []).reduce((n, s) => n + s.quantity, 0);
  if (!quantity) return;
  // Con el cliente del organizador: el RLS exige que el evento sea suyo y siga abierto.
  const { error } = await supabase.from("sales_confirmations").insert({ event_id: eventId, source: "ticketera", quantity });
  if (error) return;
  await db
    .from("test_ticket_sales")
    .update({ confirmed_at: new Date().toISOString() })
    .in("id", (pending ?? []).map((s) => s.id));
  revalidatePath(`/panel/evento/${eventId}`, "layout");
  revalidatePath("/panel", "layout");
}
