/**
 * Stateless HMAC-signed invite tokens.
 *
 * Payload: `{workspaceId}:{email}:{role}:{expiresAt}` — HMAC-SHA256 signed
 * with INVITE_SECRET (falls back to a dev key so flows work with zero config).
 * The whole thing is base64url-encoded so it's URL-safe without percent-encoding.
 *
 * No DB column needed: the token carries its own payload and the signature
 * proves it was minted by this server. consumeInviteToken() is idempotent —
 * repeated calls with the same valid token are fine until it expires.
 */
import crypto from "node:crypto";

const SECRET = process.env.INVITE_SECRET ?? "dev-invite-secret-change-in-prod";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createInviteToken(workspaceId: string, email: string, role: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${workspaceId}:${email}:${role}:${expiresAt}`;
  const sig = sign(payload);
  // encode payload + sig as a single base64url string
  const raw = JSON.stringify({ p: payload, s: sig });
  return Buffer.from(raw).toString("base64url");
}

export interface InvitePayload {
  workspaceId: string;
  email: string;
  role: string;
}

/** Returns the decoded payload or null if the token is invalid / expired. */
export function verifyInviteToken(token: string): InvitePayload | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const obj = JSON.parse(raw) as { p: string; s: string };
    if (!obj.p || !obj.s) return null;
    // Constant-time comparison to prevent timing attacks
    const expected = sign(obj.p);
    const a = Buffer.from(expected, "base64url");
    const b = Buffer.from(obj.s, "base64url");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parts = obj.p.split(":");
    if (parts.length !== 4) return null;
    const [workspaceId, email, role, expiresAtStr] = parts as [string, string, string, string];
    if (Date.now() > Number(expiresAtStr)) return null;
    return { workspaceId, email, role };
  } catch {
    return null;
  }
}
