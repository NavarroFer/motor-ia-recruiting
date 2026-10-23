import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Clave derivada del SESSION_SECRET para la demo. En producción: una clave por cliente en AWS KMS.
function key(): Buffer {
  return createHash("sha256").update(`pii:${secret()}`).digest();
}

export function secret(): string {
  return process.env.SESSION_SECRET || "dev-secret-cambiar-en-env-local";
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptJson<T>(payload: string): T {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
}

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Hash para deduplicar por email/teléfono sin guardarlos en claro. */
export function lookupHash(value: string): string {
  return sha256(`${secret()}:${value.trim().toLowerCase()}`);
}
