// App-level encryption for sensitive credentials (BYOC API keys, etc.).
// AES-256-GCM with a master key from MESSAGING_SECRET (32-byte hex). Stored
// values are tagged with `enc:v1:` so we can transparently roll keys / formats
// later, and so legacy plaintext rows continue to read.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer | null {
  const raw = process.env.MESSAGING_SECRET;
  if (!raw) return null;
  // Accept hex (64 chars) or base64 (44 chars). Reject anything else so a typo
  // surfaces immediately instead of producing a weak key.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* fall through */
  }
  throw new Error("MESSAGING_SECRET must be 32 bytes (64 hex chars or 44-char base64).");
}

export function isEncryptionAvailable(): boolean {
  try {
    return getKey() !== null;
  } catch {
    return false;
  }
}

export function encryptString(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  const key = getKey();
  if (!key) return plaintext; // no master key configured — store as plaintext
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ciphertext]).toString("base64");
  return `${PREFIX}${packed}`;
}

export function decryptString(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext
  const key = getKey();
  if (!key) {
    // Encrypted value but no key available — caller will see null and the
    // sender will report "messaging not configured" rather than leaking a stub.
    return null;
  }
  try {
    const packed = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = packed.subarray(0, IV_LEN);
    const tag = packed.subarray(IV_LEN, IV_LEN + 16);
    const ciphertext = packed.subarray(IV_LEN + 16);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return plain;
  } catch {
    return null;
  }
}
