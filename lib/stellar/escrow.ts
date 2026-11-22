import { Asset, Keypair, Memo, Operation, TransactionBuilder, type xdr } from "@stellar/stellar-sdk";
import { commissionFor } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOrganizerAccount, getHorizonServer } from "./accounts";
import { bsToXlm, ESCROW_RESERVE_XLM, PLATFORM_PUBLIC_KEY, STELLAR_NETWORK } from "./config";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * Escrow de cada evento de pago en Stellar Testnet.
 *
 * Cada evento tiene su propia cuenta de escrow, que controla TILCA (la llave vive cifrada
 * en `event_escrow_secrets`, que solo lee el servidor):
 *
 *   Depósito  organizador -> escrow    (al publicar; y depósitos adicionales)
 *   Comisión  escrow -> TILCA          (al cerrar: entradas confirmadas × precio × 5%)
 *   Devolución escrow -> organizador   (al cerrar: el resto, y la cuenta se cierra)
 *
 * Antes de tocar Stellar, el evento se "reserva" cambiando su estado de forma atómica
 * (un solo proceso a la vez). Si Stellar falla, el estado queda pendiente para reintentar
 * y el organizador nunca queda bloqueado. Cada transacción confirmada se registra con
 * `record_escrow_tx`, así un reintento no repite lo que ya salió.
 */

export type EscrowOutcome =
  | { ok: true; hashes: string[] }
  | { ok: false; reason: "en_curso" | "estado" | "no_alcanza" | "stellar"; message: string; missingBs?: number };

const STALE_MS = 2 * 60_000;

type Db = ReturnType<typeof createAdminClient>;

/**
 * Pasa el evento de su estado actual (si está en `from`) a `to`, si nadie más lo tomó
 * (o si quien lo tomó lleva más de 2 minutos). Devuelve el evento y el estado anterior.
 */
async function claim(db: Db, eventId: string, organizerId: string, from: string[], to: string) {
  const { data: current } = await db.from("events").select("escrow_status").eq("id", eventId).maybeSingle();
  const previous = current?.escrow_status as string | undefined;
  if (!previous || (!from.includes(previous) && previous !== to)) return null;
  const restore = previous === to ? from[0] : previous;
  const stale = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await db
    .from("events")
    .update({ escrow_status: to, escrow_attempted_at: new Date().toISOString(), escrow_error: null })
    .eq("id", eventId)
    .eq("organizer_id", organizerId)
    .or(`escrow_status.eq.${previous === to ? "__" : previous},and(escrow_status.eq.${to},escrow_attempted_at.lt.${stale})`)
    .select("id, title, price, promo_budget_bs, escrow_balance_bs, escrow_account")
    .maybeSingle();
  return data ? { ...data, restore } : null;
}

async function release(db: Db, eventId: string, status: string, error?: string) {
  await db
    .from("events")
    .update({ escrow_status: status, escrow_error: error ? error.slice(0, 500) : null })
    .eq("id", eventId);
}

function stellarError(err: unknown) {
  const e = err as { response?: { data?: { extras?: { result_codes?: unknown } } }; message?: string };
  const codes = e?.response?.data?.extras?.result_codes;
  return codes ? `Stellar: ${JSON.stringify(codes)}` : (e?.message ?? "Stellar no respondió");
}

async function submit(sourceSecret: string, ops: xdr.Operation[], memo: string) {
  const server = getHorizonServer();
  const kp = Keypair.fromSecret(sourceSecret);
  const account = await server.loadAccount(kp.publicKey());
  const fee = await server.fetchBaseFee();
  const builder = new TransactionBuilder(account, { fee: String(fee), networkPassphrase: STELLAR_NETWORK });
  for (const op of ops) builder.addOperation(op);
  const tx = builder.addMemo(Memo.text(memo.slice(0, 28))).setTimeout(60).build();
  tx.sign(kp);
  const res = await server.submitTransaction(tx);
  return res.hash;
}

async function accountExists(publicKey: string) {
  try {
    await getHorizonServer().loadAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

/** Llave de la cuenta de escrow del evento; la crea (solo en la base) si no existe. */
async function escrowKeypair(db: Db, eventId: string) {
  const { data } = await db.from("event_escrow_secrets").select("public_key, secret_encrypted").eq("event_id", eventId).maybeSingle();
  if (data) {
    const kp = Keypair.fromSecret(decryptSecret(data.secret_encrypted));
    if (kp.publicKey() !== data.public_key) throw new Error("La llave del escrow no corresponde a su cuenta.");
    return kp;
  }
  // Se guarda antes de crear la cuenta en Stellar: así nunca hay fondos en una cuenta sin llave.
  const kp = Keypair.random();
  const { error } = await db
    .from("event_escrow_secrets")
    .insert({ event_id: eventId, public_key: kp.publicKey(), secret_encrypted: encryptSecret(kp.secret()) });
  if (error) throw new Error(`No se pudo guardar la llave del escrow: ${error.message}`);
  return kp;
}

/**
 * Depósito en el escrow del evento. `initial`: el depósito de la publicación (el monto
 * es `promo_budget_bs`); si no, un depósito adicional de `amountBs`.
 */
export async function depositToEscrow({
  eventId,
  organizerId,
  amountBs,
  initial,
}: {
  eventId: string;
  organizerId: string;
  amountBs?: number;
  initial: boolean;
}): Promise<EscrowOutcome> {
  const db = createAdminClient();
  // Sin depósito previo (o si el primero falló), un "depósito adicional" hace de primer depósito.
  const event = await claim(db, eventId, organizerId, initial ? ["deposito_pendiente"] : ["activo", "sin_escrow", "deposito_pendiente"], "depositando");
  if (!event) return { ok: false, reason: "en_curso", message: "Ya hay un depósito o un cierre en curso para este evento." };
  const before = event.restore;
  const first = before !== "activo";

  const amount = initial ? Number(event.promo_budget_bs) : Number(amountBs ?? 0);
  if (!(amount > 0)) {
    await release(db, eventId, before);
    return { ok: false, reason: "estado", message: "El monto del depósito debe ser mayor a cero." };
  }

  try {
    const organizer = await ensureOrganizerAccount(organizerId);
    const escrow = await escrowKeypair(db, eventId);
    const ops: xdr.Operation[] = [];
    if (!(await accountExists(escrow.publicKey()))) {
      ops.push(Operation.createAccount({ destination: escrow.publicKey(), startingBalance: ESCROW_RESERVE_XLM }));
    }
    ops.push(Operation.payment({ destination: escrow.publicKey(), asset: Asset.native(), amount: bsToXlm(amount) }));
    const hash = await submit(organizer.secretKey, ops, first ? "TILCA deposito" : "TILCA deposito adicional");

    const { error } = await db.rpc("record_escrow_tx", {
      p_event: eventId,
      p_kind: first ? "deposito" : "deposito_adicional",
      p_amount: amount,
      p_hash: hash,
      p_account: escrow.publicKey(),
    });
    if (error) console.error(`Depósito ${hash} hecho pero no registrado:`, error.message);
    return { ok: true, hashes: [hash] };
  } catch (err) {
    const message = stellarError(err);
    await release(db, eventId, before, message);
    return { ok: false, reason: "stellar", message };
  }
}

/** Entradas confirmadas con el código TILCA (ticketera + puerta). */
export async function confirmedSales(db: Db, eventId: string) {
  const { data } = await db.from("sales_confirmations").select("quantity").eq("event_id", eventId);
  return (data ?? []).reduce((s, r) => s + Number(r.quantity), 0);
}

/**
 * Cierra el evento: paga a TILCA la comisión (entradas confirmadas × precio × 5%) y
 * devuelve el resto al organizador. Si el depósito no alcanza, no toca nada.
 */
export async function closeEscrow({ eventId, organizerId }: { eventId: string; organizerId: string }): Promise<EscrowOutcome> {
  const db = createAdminClient();
  const event = await claim(db, eventId, organizerId, ["activo", "cierre_pendiente", "sin_escrow", "deposito_pendiente"], "cerrando");
  if (!event) return { ok: false, reason: "en_curso", message: "Este evento ya se está cerrando o ya se cerró." };

  const sales = await confirmedSales(db, eventId);
  const commission = commissionFor(sales, Number(event.price ?? 0));
  const { data: done } = await db.from("escrow_transactions").select("kind, amount_bs, tx_hash").eq("event_id", eventId);
  const paid = (done ?? []).find((t) => t.kind === "comision");
  const refunded = (done ?? []).find((t) => t.kind === "devolucion");

  // Lo que queda por pagar sale del saldo actual (si la comisión ya salió, ya se descontó).
  const balance = Number(event.escrow_balance_bs);
  if (!paid && commission > balance) {
    await release(db, eventId, event.restore === "cierre_pendiente" ? "activo" : event.restore);
    const missingBs = Math.round((commission - balance) * 100) / 100;
    return { ok: false, reason: "no_alcanza", message: "Tu depósito no alcanza.", missingBs };
  }

  const hashes: string[] = [];
  try {
    // Sin escrow (evento sin depósito y sin ventas): no hay nada que mover en Stellar.
    const escrow = event.escrow_account ? await escrowKeypair(db, eventId) : null;
    const organizer = escrow ? await ensureOrganizerAccount(organizerId) : null;
    if (escrow && !PLATFORM_PUBLIC_KEY) throw new Error("Falta NEXT_PUBLIC_STELLAR_PLATFORM_PUBLIC_KEY en .env.local.");

    if (escrow && !paid && commission > 0) {
      const hash = await submit(
        escrow.secret(),
        [Operation.payment({ destination: PLATFORM_PUBLIC_KEY, asset: Asset.native(), amount: bsToXlm(commission) })],
        `TILCA comision ${sales} entradas`,
      );
      await db.rpc("record_escrow_tx", { p_event: eventId, p_kind: "comision", p_amount: commission, p_hash: hash, p_account: null });
      hashes.push(hash);
    }

    const refund = Math.max(0, Math.round((balance - (paid ? 0 : commission)) * 100) / 100);
    if (escrow && organizer && !refunded) {
      // La devolución exacta y, en la misma transacción, el cierre de la cuenta de escrow
      // (accountMerge devuelve al organizador la reserva que puso al abrirla).
      const ops: xdr.Operation[] = [];
      if (refund > 0) ops.push(Operation.payment({ destination: organizer.publicKey, asset: Asset.native(), amount: bsToXlm(refund) }));
      ops.push(Operation.accountMerge({ destination: organizer.publicKey }));
      const hash = await submit(escrow.secret(), ops, "TILCA devolucion");
      await db.rpc("record_escrow_tx", { p_event: eventId, p_kind: "devolucion", p_amount: refund, p_hash: hash, p_account: null });
      hashes.push(hash);
    }

    const { data: txs } = await db.from("escrow_transactions").select("kind, amount_bs").eq("event_id", eventId);
    const sum = (k: string) => (txs ?? []).filter((t) => t.kind === k).reduce((s, t) => s + Number(t.amount_bs), 0);
    await db
      .from("events")
      .update({
        escrow_status: "cerrado",
        commission_bs: sum("comision"),
        refund_bs: sum("devolucion"),
        closed_at: new Date().toISOString(),
        escrow_error: null,
      })
      .eq("id", eventId);
    return { ok: true, hashes };
  } catch (err) {
    const message = stellarError(err);
    await release(db, eventId, "cierre_pendiente", message);
    return { ok: false, reason: "stellar", message };
  }
}
