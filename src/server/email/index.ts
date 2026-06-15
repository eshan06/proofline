import { logger } from "@/server/logger";

/**
 * Transactional email. The UI/handlers depend only on EmailProvider; the dev
 * transport logs (so flows are observable with zero setup), and a real provider
 * (Resend/Postmark/SES) slots in behind EMAIL_PROVIDER + an API key.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<void> {
    logger.info("email.send", { to: msg.to, subject: msg.subject });
    // The body is intentionally not logged in full (may contain tokens).
  }
}

/** Real transactional email via Resend's HTTP API (no SDK — a single fetch). */
class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private from: string) {}
  async send(msg: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    logger.info("email.sent", { to: msg.to, subject: msg.subject, provider: "resend" });
  }
}

let cached: EmailProvider | null = null;

export function email(): EmailProvider {
  if (cached) return cached;
  const kind = process.env.EMAIL_PROVIDER ?? "console";
  switch (kind) {
    case "resend": {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!key || !from) {
        logger.warn("email.resend_unconfigured", { reason: "missing RESEND_API_KEY / EMAIL_FROM" });
        cached = new ConsoleEmailProvider();
        return cached;
      }
      cached = new ResendEmailProvider(key, from);
      return cached;
    }
    case "postmark":
    case "ses":
      // TODO(real-email): Postmark/SES transports follow the same one-fetch shape.
      logger.warn("email.provider_unwired", { requested: kind });
      cached = new ConsoleEmailProvider();
      return cached;
    default:
      cached = new ConsoleEmailProvider();
      return cached;
  }
}

/**
 * Fire-and-forget send that REPORTS failures instead of swallowing them — use
 * this for transactional emails (welcome, verification, reset, invite) so a
 * real provider outage is alerted, not silently dropped.
 */
export function sendEmailSafe(msg: EmailMessage, context: string): void {
  void email()
    .send(msg)
    .catch((err) => logger.reportError("email.send_failed", err, { to: msg.to, context }));
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/* templates --------------------------------------------------------------- */

export function welcomeEmail(to: string, name: string): EmailMessage {
  return {
    to,
    subject: "Welcome to Proofline",
    text: `Hi ${name}, your Proofline workspace is ready. Sign in at ${APP_URL}/signin`,
    html: `<p>Hi ${escape(name)},</p><p>Your Proofline workspace is ready — support that shows its work.</p><p><a href="${APP_URL}/signin">Open your inbox</a></p>`,
  };
}

export function inviteEmail(to: string, workspaceName: string, role: string, inviteToken: string): EmailMessage {
  const link = `${APP_URL}/accept-invite?token=${encodeURIComponent(inviteToken)}`;
  return {
    to,
    subject: `You've been invited to ${workspaceName} on Proofline`,
    text: `You've been invited to ${workspaceName} as ${role}. Accept your invite (valid 7 days): ${link}`,
    html: `<p>You've been invited to <strong>${escape(workspaceName)}</strong> on Proofline as <strong>${escape(role)}</strong>.</p><p><a href="${link}">Accept the invite</a> — this link is valid for 7 days.</p><p>If you didn't expect this invitation, you can safely ignore this email.</p>`,
  };
}

export function passwordResetEmail(to: string, token: string): EmailMessage {
  const link = `${APP_URL}/reset?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Reset your Proofline password",
    text: `Reset your password: ${link} (valid for 1 hour)`,
    html: `<p>Click to reset your Proofline password (valid for 1 hour):</p><p><a href="${link}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  };
}

export function verifyEmail(to: string, token: string): EmailMessage {
  const link = `${APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Verify your email for Proofline",
    text: `Confirm your email to finish setting up Proofline: ${link} (valid for 24 hours)`,
    html: `<p>Confirm your email to finish setting up Proofline (valid for 24 hours):</p><p><a href="${link}">Verify email</a></p><p>If you didn't create this account, you can ignore this email.</p>`,
  };
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
