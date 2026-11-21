import { Horizon, Keypair } from "@stellar/stellar-sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { FRIENDBOT_URL, HORIZON_URL } from "./config";
import { decryptSecret, encryptSecret } from "./crypto";

export interface StellarAccountInfo {
  publicKey: string;
  secretKey: string;
}

export interface AccountBalance {
  asset: string;
  balance: string;
}

/** Servidor Horizon de Stellar Testnet */
export function getHorizonServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL);
}

/** Financia una cuenta en Stellar Testnet usando Friendbot (10,000 XLM de prueba). */
export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  } catch (err) {
    console.warn("Fallo temporal en Friendbot:", err);
    return false;
  }
}

/**
 * Saldos actuales de una cuenta en Testnet. `null` si la cuenta no existe
 * o Horizon no responde (para no mostrar un "0.00" que parezca real).
 */
export async function getAccountBalances(publicKey: string): Promise<AccountBalance[] | null> {
  try {
    const account = await getHorizonServer().loadAccount(publicKey);
    return account.balances.map((b) => ({
      asset: b.asset_type === "native" ? "XLM" : (b as { asset_code?: string }).asset_code || "TOKEN",
      balance: Number(b.balance).toFixed(2),
    }));
  } catch {
    return null;
  }
}

/**
 * Garantiza que el organizador tenga cuenta de Stellar en Testnet.
 * La llave privada vive cifrada en `organizer_stellar_secrets`, que solo lee el servidor.
 * Si no tiene cuenta, crea una, la fondea con Friendbot y solo la guarda si quedó fondeada.
 */
export async function ensureOrganizerAccount(organizerId: string): Promise<StellarAccountInfo> {
  const db = createAdminClient();
  const [{ data: org }, { data: secretRow }] = await Promise.all([
    db.from("organizers").select("stellar_public_key").eq("id", organizerId).maybeSingle(),
    db.from("organizer_stellar_secrets").select("secret_encrypted").eq("organizer_id", organizerId).maybeSingle(),
  ]);

  if (org?.stellar_public_key && secretRow?.secret_encrypted) {
    // Si no se puede descifrar, fallamos en vez de crear otra cuenta: reemplazarla
    // en silencio dejaría los fondos de la anterior inaccesibles.
    const secretKey = decryptSecret(secretRow.secret_encrypted);
    if (Keypair.fromSecret(secretKey).publicKey() !== org.stellar_public_key) {
      throw new Error("La llave guardada no corresponde a la cuenta del organizador.");
    }
    return { publicKey: org.stellar_public_key, secretKey };
  }

  const keypair = Keypair.random();
  if (!(await fundWithFriendbot(keypair.publicKey()))) {
    throw new Error("Friendbot no pudo fondear la cuenta nueva del organizador.");
  }

  const { error: secretErr } = await db
    .from("organizer_stellar_secrets")
    .upsert({ organizer_id: organizerId, secret_encrypted: encryptSecret(keypair.secret()) });
  if (secretErr) throw new Error(`No se pudo guardar la llave del organizador: ${secretErr.message}`);
  const { error: orgErr } = await db
    .from("organizers")
    .update({ stellar_public_key: keypair.publicKey() })
    .eq("id", organizerId);
  if (orgErr) throw new Error(`No se pudo guardar la cuenta del organizador: ${orgErr.message}`);

  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}
