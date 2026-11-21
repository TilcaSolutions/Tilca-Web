import { Asset, Keypair, Memo, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { getHorizonServer } from "./accounts";
import { PLATFORM_PUBLIC_KEY, STELLAR_NETWORK } from "./config";

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Plan B: Pago directo desde la cuenta del organizador a TILCA en Stellar Testnet.
 * Incluye el código de canje en el Memo de la transacción (verificable en Stellar Expert).
 */
export async function executeDirectPayment({
  senderSecret,
  recipientPublicKey = PLATFORM_PUBLIC_KEY,
  amountXlm = "0.72", // Testnet usa XLM; 0.72 XLM es solo una cifra simbólica por los Bs 5
  memoText,
}: {
  senderSecret: string;
  recipientPublicKey?: string;
  amountXlm?: string;
  memoText: string;
}): Promise<PaymentResult> {
  try {
    if (!recipientPublicKey) throw new Error("Falta NEXT_PUBLIC_STELLAR_PLATFORM_PUBLIC_KEY en .env.local.");
    const server = getHorizonServer();
    const sourceKeypair = Keypair.fromSecret(senderSecret);

    // Cargar cuenta origen para obtener el número de secuencia
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
    const fee = await server.fetchBaseFee();

    const memoClean = memoText.slice(0, 28); // Stellar text memo max 28 bytes
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: fee.toString(),
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: recipientPublicKey,
          asset: Asset.native(), // XLM de testnet disponible directamente
          amount: amountXlm,
        }),
      )
      .addMemo(Memo.text(memoClean))
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      txHash: result.hash,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error desconocido al procesar pago en Stellar";
    return {
      success: false,
      error: message,
    };
  }
}
