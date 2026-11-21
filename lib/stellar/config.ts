import { Networks } from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = Networks.TESTNET;
export const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const STELLAR_EXPERT_TX_URL = "https://stellar.expert/explorer/testnet/tx";
export const STELLAR_EXPERT_ACCOUNT_URL = "https://stellar.expert/explorer/testnet/account";

export const BS_PER_ATTENDEE = 5;

// Cuenta TILCA en Testnet: recibe las comisiones. Se configura en .env.local (ver README);
// sin valor por defecto, porque la llave privada de la cuenta de ejemplo anterior quedó publicada.
export const PLATFORM_PUBLIC_KEY = process.env.NEXT_PUBLIC_STELLAR_PLATFORM_PUBLIC_KEY ?? "";

export function getPlatformSecret(): string {
  const secret = process.env.STELLAR_PLATFORM_SECRET;
  if (!secret) throw new Error("Falta STELLAR_PLATFORM_SECRET en .env.local (ver README).");
  return secret;
}

export function explorerTxUrl(txHash: string): string {
  return `${STELLAR_EXPERT_TX_URL}/${txHash}`;
}

export function explorerAccountUrl(publicKey: string): string {
  return `${STELLAR_EXPERT_ACCOUNT_URL}/${publicKey}`;
}
