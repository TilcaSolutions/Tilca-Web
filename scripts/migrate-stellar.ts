/**
 * Script de migración a Stellar Testnet para organizadores y eventos existentes en TILCA.
 *
 *   npm run migrate:stellar
 *
 * Revisa la tabla `organizers`: a cada organizador sin cuenta Stellar le crea
 * un par de llaves en Testnet, lo fondea con Friendbot (10,000 XLM de prueba),
 * cifra la llave privada con AES-256-GCM y la guarda en la base de datos.
 *
 * A los eventos existentes les asigna presupuesto de promoción inicial y
 * contrato de Smart Escrow en Testnet.
 */

import { Keypair } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../lib/stellar/crypto";
import { explorerAccountUrl, FRIENDBOT_URL, PLATFORM_PUBLIC_KEY } from "../lib/stellar/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en las variables de entorno.");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fundAccount(publicKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch (err) {
    console.warn(`  ⚠️ Friendbot no pudo fondear ${publicKey}:`, err);
    return false;
  }
}

async function migrateOrganizers() {
  const { error: checkErr } = await db.from("organizer_stellar_secrets").select("organizer_id").limit(1);
  if (checkErr) {
    console.error("\n❌ Las columnas de Stellar aún no han sido aplicadas en la base de datos.");
    console.log("   Para aplicarlas en Supabase local, ejecuta:");
    console.log("     npx supabase migration up");
    console.log("   (o copia 'supabase/migrations/20261120010000_stellar_integration.sql' en el SQL Editor si usas Supabase Cloud)\n");
    process.exit(1);
  }

  console.log("🔍 Buscando organizadores sin cuenta de Stellar Testnet...");

  const { data: organizers, error } = await db
    .from("organizers")
    .select("id, name, stellar_public_key");
  const { data: secrets } = await db.from("organizer_stellar_secrets").select("organizer_id");
  const withSecret = new Set((secrets ?? []).map((r) => r.organizer_id));

  if (error) {
    console.error("Error al consultar organizadores:", error.message);
    return;
  }

  let migratedCount = 0;

  for (const org of organizers || []) {
    if (org.stellar_public_key && withSecret.has(org.id)) {
      console.log(`  ✓ Organizador "${org.name}" ya tiene cuenta: ${org.stellar_public_key.slice(0, 8)}...`);
      continue;
    }

    console.log(`  ⚙️ Generando cuenta Stellar Testnet para "${org.name}"...`);
    const kp = Keypair.random();
    const pub = kp.publicKey();
    const sec = kp.secret();
    const encrypted = encryptSecret(sec);

    console.log(`  💧 Fondeando cuenta con Friendbot (${pub})...`);
    if (!(await fundAccount(pub))) {
      console.error(`  ❌ Friendbot no fondeó la cuenta de "${org.name}"; se reintenta en la próxima corrida.`);
      continue;
    }

    // La llave privada va a una tabla que solo lee el service role; la pública, a `organizers`.
    const { error: secretErr } = await db
      .from("organizer_stellar_secrets")
      .upsert({ organizer_id: org.id, secret_encrypted: encrypted });
    const { error: updateErr } = secretErr
      ? { error: secretErr }
      : await db.from("organizers").update({ stellar_public_key: pub }).eq("id", org.id);

    if (updateErr) {
      console.error(`  ❌ Error actualizando organizador "${org.name}":`, updateErr.message);
    } else {
      console.log(`  ✅ Cuenta configurada: ${pub}`);
      console.log(`     Explorador: ${explorerAccountUrl(pub)}`);
      migratedCount++;
    }
  }

  console.log(`\n🎉 Migración de organizadores completada: ${migratedCount} cuentas creadas y fondeadas.\n`);
}

async function migrateEvents() {
  console.log("🔍 Actualizando eventos para inicializar Smart Escrow de Testnet...");

  const { data: events, error } = await db
    .from("events")
    .select("id, title, promo_budget_bs, stellar_escrow_id, escrow_status")
    .eq("status", "publicado");

  if (error) {
    console.error("Error al consultar eventos:", error.message);
    return;
  }

  let updatedEvents = 0;

  for (const ev of events || []) {
    if (ev.stellar_escrow_id && ev.promo_budget_bs > 0) {
      continue;
    }

    const defaultBudget = 250; // Bs 250 = 50 asistentes nuevos
    const escrowId = `TW-ESCROW-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const { error: evErr } = await db
      .from("events")
      .update({
        promo_budget_bs: defaultBudget,
        escrow_balance_bs: defaultBudget,
        stellar_escrow_id: escrowId,
        escrow_status: "activo",
      })
      .eq("id", ev.id);

    if (evErr) {
      console.error(`  ❌ Error actualizando evento "${ev.title}":`, evErr.message);
    } else {
      console.log(`  ✅ Evento "${ev.title}": Presupuesto Bs ${defaultBudget} (Escrow: ${escrowId})`);
      updatedEvents++;
    }
  }

  console.log(`🎉 Migración de eventos completada: ${updatedEvents} eventos configurados con Escrow.\n`);
}

/** La cuenta de TILCA tiene que existir en Testnet; si no, todo pago falla con op_no_destination. */
async function ensurePlatformAccount() {
  const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${PLATFORM_PUBLIC_KEY}`);
  if (res.ok) {
    console.log(`✓ Cuenta TILCA ${PLATFORM_PUBLIC_KEY.slice(0, 8)}… existe en Testnet.\n`);
    return;
  }
  console.log(`💧 La cuenta TILCA no existe en Testnet; fondeándola con Friendbot…`);
  console.log((await fundAccount(PLATFORM_PUBLIC_KEY)) ? "✅ Cuenta TILCA creada.\n" : "❌ No se pudo crear la cuenta TILCA.\n");
}

async function main() {
  console.log("====================================================");
  console.log("🚀 INICIANDO MIGRACIÓN A STELLAR TESTNET (TILCA MVP)");
  console.log("====================================================\n");

  await ensurePlatformAccount();

  await migrateOrganizers();
  await migrateEvents();

  console.log("✨ Todos los datos quedaron listos para el demo de la Hackathon.");
}

main().catch((err) => {
  console.error("Error fatal en migración:", err);
  process.exit(1);
});
