/**
 * Datos del modo jurado: cobros reales en Stellar Testnet para la cuenta de ejemplo.
 *
 *   npm run seed && npm run seed:jurado
 *
 * Correr después de `npm run seed` (que deja los depósitos pendientes). Hace, con
 * transacciones reales en Testnet:
 *   - "El último tren" (ya pasó): depósito, cierre, comisión a TILCA y devolución.
 *   - "La casa de los espejos" y "Monólogos de medianoche": depósito activo en su escrow.
 * Así el panel del jurado muestra cobros con comprobantes verificables en Stellar Expert.
 */
import { createClient } from "@supabase/supabase-js";
import { closeEscrow, depositToEscrow } from "../lib/stellar/escrow";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: org } = await db
    .from("organizers")
    .select("id, name")
    .eq("is_sample", true)
    .not("owner_id", "is", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!org) throw new Error("No hay cuenta de ejemplo: corre npm run seed primero.");

  const { data: events } = await db
    .from("events")
    .select("id, title, escrow_status")
    .eq("organizer_id", org.id)
    .in("title", ["El último tren", "La casa de los espejos", "Monólogos de medianoche"]);

  for (const e of events ?? []) {
    if (e.escrow_status === "deposito_pendiente") {
      const dep = await depositToEscrow({ eventId: e.id, organizerId: org.id, initial: true });
      console.log(`${e.title}: depósito ${dep.ok ? "hecho" : `falló (${dep.message})`}`);
      if (!dep.ok) continue;
    }
    if (e.title === "El último tren") {
      const close = await closeEscrow({ eventId: e.id, organizerId: org.id });
      console.log(`${e.title}: cierre ${close.ok ? "hecho" : `falló (${close.message})`}`);
    }
  }
  console.log("Listo: el panel del jurado ya tiene cobros con comprobantes en Stellar Testnet.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
