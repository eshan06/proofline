import crypto from "node:crypto";

/**
 * Application-level encryption for long-lived third-party secrets stored at rest
 * (Gmail refresh tokens, Slack bot tokens). A DB dump or read-only leak should
 * not hand an attacker live tenant credentials.
 *
 * Keyed by TOKEN_ENC_KEY (32 bytes, as 64 hex chars or base64). Encryption is
 * transparent and backward-compatible:
 *   - encryptSecret is a no-op passthrough when no key is configured (dev / not
 *     yet migrated), so the app keeps working with zero setup.
 *   - decryptSecret returns non-prefixed values unchanged, so tokens written
 *     before a key was set still read fine after one is added.
 * Ciphertext is tagged with a version prefix so the format can evolve.
 */

const PREFIX = "enc:v1:";

function loadKey(): Buffer | null {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must be 32 bytes (64 hex chars or base64). Generate with `openssl rand -hex 32`.");
  }
  return buf;
}

/** True once a token encryption key is configured. */
export function tokenEncryptionEnabled(): boolean {
  return !!process.env.TOKEN_ENC_KEY;
}

/**
 * Encrypt a secret for at-rest storage (AES-256-GCM, random IV, auth tag).
 * Returns the plaintext unchanged when no key is configured.
 */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const key = loadKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypt a stored secret. Values without the version prefix are treated as
 * legacy plaintext and returned unchanged.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const key = loadKey();
  if (!key) {
    throw new Error("A stored secret is encrypted but TOKEN_ENC_KEY is not set — cannot decrypt.");
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
