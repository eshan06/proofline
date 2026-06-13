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

let cached: EmailProvider | null = null;

export function email(): EmailProvider {
  if (cached) return cached;
  const kind = process.env.EMAIL_PROVIDER ?? "console";
  switch (kind) {
    case "resend":
    case "postmark":
    case "ses":
      // TODO(real-email): construct the API-backed transport here.
      logger.warn("email.provider_unwired", { requested: kind });
      cached = new ConsoleEmailProvider();
      return cached;
    default:
      cached = new ConsoleEmailProvider();
      return cached;
  }
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

export function inviteEmail(to: string, workspaceName: string, role: string): EmailMessage {
  return {
    to,
    subject: `You've been invited to ${workspaceName} on Proofline`,
    text: `You've been invited to ${workspaceName} as ${role}. Accept at ${APP_URL}/signin`,
    html: `<p>You've been invited to <strong>${escape(workspaceName)}</strong> on Proofline as <strong>${escape(role)}</strong>.</p><p><a href="${APP_URL}/signin">Accept the invite</a> — this link is valid for 7 days.</p>`,
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

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
