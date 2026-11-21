"use server";

import { getAccountBalances, type AccountBalance } from "@/lib/stellar/accounts";
import { BS_PER_ATTENDEE, explorerTxUrl, PLATFORM_PUBLIC_KEY } from "@/lib/stellar/config";
import { cobrarCanje } from "@/lib/stellar/payment";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DemoBalances {
  platform: {
    publicKey: string;
    balances: AccountBalance[] | null;
  };
  organizer: {
    publicKey: string | null;
    balances: AccountBalance[] | null;
  };
}

export async function getDemoBalances(): Promise<DemoBalances> {
  // La cuenta del organizador de ejemplo que cobra la simulación (la crea migrate:stellar o el primer cobro).
  const { data: sampleEvent } = await createAdminClient()
    .from("events")
    .select("organizers(stellar_public_key)")
    .eq("status", "publicado")
    .eq("is_sample", true)
    .order("id")
    .limit(1)
    .maybeSingle<{ organizers: { stellar_public_key: string | null } | null }>();
  const orgKey = sampleEvent?.organizers?.stellar_public_key ?? null;

  const [platformBalances, organizerBalances] = await Promise.all([
    getAccountBalances(PLATFORM_PUBLIC_KEY),
    orgKey ? getAccountBalances(orgKey) : Promise.resolve(null),
  ]);

  return {
    platform: {
      publicKey: PLATFORM_PUBLIC_KEY,
      balances: platformBalances,
    },
    organizer: {
      publicKey: orgKey,
      balances: organizerBalances,
    },
  };
}

export interface SimulationResult {
  success: boolean;
  code: string;
  txHash?: string;
  status: "cobrado" | "pendiente" | "fallido";
  message: string;
  explorerUrl?: string;
}

export async function simulateFullRedemption(options?: {
  offlineMode?: boolean;
}): Promise<SimulationResult> {
  const demoCode = `TILCA-${Math.floor(1000 + Math.random() * 9000)}`;

  // Simulación de caída de red: muestra cómo se ve un cobro pendiente, sin tocar Stellar.
  if (options?.offlineMode) {
    return {
      success: true,
      code: demoCode,
      status: "pendiente",
      message:
        "Simulación de caída de red: el canje se aprueba en boletería sin demora y la comisión queda 'pendiente' para reintentarla después.",
    };
  }

  const supabase = createAdminClient();
  // Canje de ejemplo sobre un evento de ejemplo publicado (nunca sobre eventos reales).
  const { data: sampleEvent } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("status", "publicado")
    .eq("is_sample", true)
    .order("id")
    .limit(1)
    .maybeSingle();
  if (!sampleEvent) {
    return { success: false, code: demoCode, status: "fallido", message: "No hay eventos de ejemplo. Corre npm run seed." };
  }

  const { data: click, error } = await supabase
    .from("clicks")
    .insert({
      event_id: sampleEvent.id,
      code: demoCode,
      redeemed_at: new Date().toISOString(),
      is_new_audience: true,
      is_sample: true,
    })
    .select("id")
    .single();
  if (error || !click) {
    return { success: false, code: demoCode, status: "fallido", message: "No se pudo registrar el canje de prueba." };
  }

  const outcome = await cobrarCanje({ clickId: click.id, organizerId: sampleEvent.organizer_id });
  if (outcome.charged && outcome.txHash) {
    return {
      success: true,
      code: demoCode,
      txHash: outcome.txHash,
      status: "cobrado",
      message: `Canje validado. Se liquidaron Bs ${BS_PER_ATTENDEE}.00 en Stellar Testnet.`,
      explorerUrl: explorerTxUrl(outcome.txHash),
    };
  }
  return {
    success: true,
    code: demoCode,
    status: "pendiente",
    message: `El canje fue aprobado en boletería. El cobro en Stellar quedó pendiente${outcome.error ? `: ${outcome.error}` : "."}`,
  };
}
