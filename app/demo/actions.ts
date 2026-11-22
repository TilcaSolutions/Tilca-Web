"use server";

import { getAccountBalances, type AccountBalance } from "@/lib/stellar/accounts";
import { PLATFORM_PUBLIC_KEY } from "@/lib/stellar/config";
import { closeEscrow, depositToEscrow } from "@/lib/stellar/escrow";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recorrido de la demo para el jurado, con transacciones reales en Stellar Testnet:
 *   1. Publicar un evento de Bs 80 con 30 ventas esperadas y depositar Bs 120 (30 × 80 × 5%).
 *   2. Confirmar 12 ventas (10 por ticketera, 2 en puerta).
 *   3. Cerrar: Bs 48 a TILCA (12 × 80 × 5%) y Bs 72 de vuelta al organizador.
 * Usa la cuenta del organizador de ejemplo. El evento queda como borrador de ejemplo
 * (no aparece en el mapa) y cada corrida borra el de la anterior.
 */

const DEMO_TITLE = "Demo TILCA · Noche de prueba";
const DEMO = { price: 80, expected: 30, deposit: 120, ticketera: 10, puerta: 2 };

export interface DemoBalances {
  platform: { publicKey: string; balances: AccountBalance[] | null };
  organizer: { publicKey: string | null; balances: AccountBalance[] | null };
}

async function demoOrganizer() {
  // El organizador de la cuenta demo (Teatro de Altura): el único de ejemplo con usuario.
  const { data } = await createAdminClient()
    .from("organizers")
    .select("id, stellar_public_key")
    .eq("is_sample", true)
    .not("owner_id", "is", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getDemoBalances(): Promise<DemoBalances> {
  const org = await demoOrganizer();
  const orgKey = org?.stellar_public_key ?? null;
  const [platform, organizer] = await Promise.all([
    getAccountBalances(PLATFORM_PUBLIC_KEY),
    orgKey ? getAccountBalances(orgKey) : Promise.resolve(null),
  ]);
  return {
    platform: { publicKey: PLATFORM_PUBLIC_KEY, balances: platform },
    organizer: { publicKey: orgKey, balances: organizer },
  };
}

export type DemoStep =
  | { ok: true; eventId: string; hashes: string[]; escrowAccount?: string | null; detail: string }
  | { ok: false; error: string };

/** El evento de la demo, si es de verdad un evento de demo (la página es pública). */
async function demoEvent(eventId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const { data } = await createAdminClient()
    .from("events")
    .select("id, organizer_id, escrow_account")
    .eq("id", eventId)
    .eq("is_sample", true)
    .eq("title", DEMO_TITLE)
    .maybeSingle();
  return data;
}

/** Paso 1: publicar el evento y depositar Bs 120 en su escrow. */
export async function demoPublish(): Promise<DemoStep> {
  const db = createAdminClient();
  const org = await demoOrganizer();
  if (!org) return { ok: false, error: "No hay organizador de ejemplo. Corre npm run seed." };

  // Las corridas anteriores ya cerraron su escrow; se borran para no llenar el panel.
  await db.from("events").delete().eq("organizer_id", org.id).eq("is_sample", true).eq("title", DEMO_TITLE).eq("escrow_status", "cerrado");

  const { data: event, error } = await db
    .from("events")
    .insert({
      organizer_id: org.id,
      title: DEMO_TITLE,
      category: "musica",
      status: "borrador",
      price: DEMO.price,
      discount_code: "TILCA10",
      discount_amount: 5,
      discount_unit: "bs",
      sales_channels: ["ticketera", "puerta"],
      expected_sales: DEMO.expected,
      ticket_url: "https://superticket.bo/",
      promo_budget_bs: DEMO.deposit,
      escrow_status: "deposito_pendiente",
      is_sample: true,
    })
    .select("id")
    .single();
  if (error || !event) return { ok: false, error: "No se pudo crear el evento de la demo." };

  const outcome = await depositToEscrow({ eventId: event.id, organizerId: org.id, initial: true });
  if (!outcome.ok) return { ok: false, error: `El depósito no llegó a Stellar: ${outcome.message}` };
  const { data: after } = await db.from("events").select("escrow_account").eq("id", event.id).maybeSingle();
  return {
    ok: true,
    eventId: event.id,
    hashes: outcome.hashes,
    escrowAccount: after?.escrow_account ?? null,
    detail: `Evento de Bs ${DEMO.price} con código TILCA10 y ${DEMO.expected} ventas esperadas. Depósito: ${DEMO.expected} × Bs ${DEMO.price} × 5% = Bs ${DEMO.deposit}.`,
  };
}

/** Paso 2: el organizador confirma 10 ventas por ticketera y marca 2 en puerta. */
export async function demoConfirm(eventId: string): Promise<DemoStep> {
  const event = await demoEvent(eventId);
  if (!event) return { ok: false, error: "No encontramos el evento de la demo." };
  const { error } = await createAdminClient()
    .from("sales_confirmations")
    .insert([
      { event_id: eventId, source: "ticketera", quantity: DEMO.ticketera, is_sample: true },
      { event_id: eventId, source: "puerta", quantity: 1, is_sample: true },
      { event_id: eventId, source: "puerta", quantity: 1, is_sample: true },
    ]);
  if (error) return { ok: false, error: "No se pudieron confirmar las ventas." };
  const total = DEMO.ticketera + DEMO.puerta;
  return {
    ok: true,
    eventId,
    hashes: [],
    detail: `${DEMO.ticketera} ventas por ticketera y ${DEMO.puerta} en puerta: ${total} entradas con el código TILCA10.`,
  };
}

/** Paso 3: cerrar el evento. El escrow paga la comisión a TILCA y devuelve el resto. */
export async function demoClose(eventId: string): Promise<DemoStep> {
  const event = await demoEvent(eventId);
  if (!event) return { ok: false, error: "No encontramos el evento de la demo." };
  const outcome = await closeEscrow({ eventId, organizerId: event.organizer_id });
  if (!outcome.ok) return { ok: false, error: outcome.message };
  const { data: after } = await createAdminClient().from("events").select("commission_bs, refund_bs").eq("id", eventId).maybeSingle();
  const total = DEMO.ticketera + DEMO.puerta;
  return {
    ok: true,
    eventId,
    hashes: outcome.hashes,
    detail: `${total} × Bs ${DEMO.price} × 5% = Bs ${Number(after?.commission_bs ?? 0)} a TILCA. Vuelven Bs ${Number(after?.refund_bs ?? 0)} al organizador.`,
  };
}
