import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOrganizerAccount } from "./accounts";
import { BS_PER_ATTENDEE } from "./config";
import { executeDirectPayment } from "./direct-payment";
import { releaseTrustlessMilestone } from "./trustless";

export interface ChargeOutcome {
  charged: boolean;
  status: "cobrado" | "pendiente" | "no_aplica" | "en_curso";
  txHash?: string;
  error?: string;
}

/**
 * Cobra en Stellar Testnet un canje de público nuevo.
 *
 * Quien llama ya verificó la sesión del organizador; aquí se vuelve a comprobar que el
 * canje sea de un evento suyo. Todas las escrituras van por funciones que solo puede
 * llamar el service role, así el organizador nunca tiene permiso de escribir en `clicks`.
 *
 *   1. Reserva el cobro de forma atómica (`claim_charge`): si ya está cobrado o en curso,
 *      no se paga de nuevo.
 *   2. Intenta liberar el hito del escrow de Trustless Work; si no hay escrow real,
 *      pago directo de la cuenta del organizador a TILCA con el código en el memo.
 *   3. Si Stellar falla, queda 'pendiente' para reintentar. El canje en sí ya quedó hecho.
 */
export async function cobrarCanje({
  clickId,
  organizerId,
}: {
  clickId: number | string;
  organizerId: string;
}): Promise<ChargeOutcome> {
  const db = createAdminClient();

  const { data: claimed, error: claimErr } = await db
    .rpc("claim_charge", { p_click: Number(clickId), p_organizer: organizerId })
    .maybeSingle<{ id: number; event_id: string; code: string }>();
  if (claimErr) return { charged: false, status: "pendiente", error: claimErr.message };
  if (!claimed) {
    // No es público nuevo, no es de este organizador, ya está cobrado o lo está cobrando otro proceso.
    return { charged: false, status: "en_curso" };
  }

  try {
    const { data: event } = await db
      .from("events")
      .select("stellar_escrow_id, escrow_status, escrow_balance_bs")
      .eq("id", claimed.event_id)
      .maybeSingle();

    const organizerAccount = await ensureOrganizerAccount(organizerId);
    let txHash: string | undefined;

    if (event?.stellar_escrow_id && event.escrow_status === "activo" && Number(event.escrow_balance_bs) >= BS_PER_ATTENDEE) {
      const releaseRes = await releaseTrustlessMilestone({
        escrowId: event.stellar_escrow_id,
        approverSecret: organizerAccount.secretKey,
        milestoneIndex: 0,
      });
      if (releaseRes.success && releaseRes.txHash) txHash = releaseRes.txHash;
    }

    if (!txHash) {
      const directRes = await executeDirectPayment({
        senderSecret: organizerAccount.secretKey,
        memoText: claimed.code,
      });
      if (!directRes.success || !directRes.txHash) {
        throw new Error(directRes.error || "Fallo en la transacción de Stellar Testnet");
      }
      txHash = directRes.txHash;
    }

    const { error: doneErr } = await db.rpc("complete_charge", {
      p_click: claimed.id,
      p_tx_hash: txHash,
      p_amount: BS_PER_ATTENDEE,
    });
    if (doneErr) {
      // El pago salió pero no pudimos registrarlo: no lo marcamos como pendiente
      // para no pagarlo dos veces; queda 'procesando' con el error para revisarlo.
      console.error(`Cobro ${claimed.code} pagado (${txHash}) pero no registrado:`, doneErr.message);
      return { charged: true, status: "cobrado", txHash, error: doneErr.message };
    }
    return { charged: true, status: "cobrado", txHash };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al conectar con Stellar Testnet";
    await db.rpc("fail_charge", { p_click: claimed.id, p_error: errorMsg });
    return { charged: false, status: "pendiente", error: errorMsg };
  }
}

/** Reintenta un cobro pendiente. `claim_charge` comprueba que el canje sea del organizador. */
export function reintentarCobro(clickId: number | string, organizerId: string): Promise<ChargeOutcome> {
  return cobrarCanje({ clickId, organizerId });
}
