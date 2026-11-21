import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.STELLAR_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("Falta STELLAR_ENCRYPTION_KEY (mínimo 32 caracteres). Genérala con: openssl rand -hex 32");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/** Cifra una clave secreta de Stellar (S...) para guardarla en la base de datos. */
export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Descifra la clave secreta de Stellar. */
export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !tagHex || !encryptedHex) throw new Error("Payload de clave cifrada inválido");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}
