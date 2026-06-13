import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const N = 16384; // CPU/memory cost — OWASP-aligned for scrypt

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N }, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

/**
 * Password hashing with node's built-in scrypt — no native dependency, no
 * compile step (important on this filesystem). Format: `scrypt$<saltHex>$<hashHex>`.
 * A real deployment can swap to argon2id behind the same two functions.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const actual = await scryptAsync(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// A well-formed hash to verify against when no account exists, so the
// no-such-user path performs the same scrypt work as a real check. Without
// this, login response time leaks whether an email is registered (enumeration).
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(KEYLEN)}`;

/** Run a throwaway verification to equalize timing on the no-such-user path. */
export async function dummyVerify(password: string): Promise<void> {
  try {
    await verifyPassword(password, DUMMY_HASH);
  } catch {
    /* timing only — result discarded */
  }
}
