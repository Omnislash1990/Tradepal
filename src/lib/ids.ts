import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomString(length: number, alphabet: string): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomString(16, ALPHABET)}`;
}

/** Short customer-facing reference such as TP-7K2M9Q (no 0/O or 1/I confusion). */
export function newReference(prefix: string, length = 6): string {
  return `${prefix}-${randomString(length, REFERENCE_ALPHABET)}`;
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
