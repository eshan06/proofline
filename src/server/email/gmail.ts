import { logger } from "@/server/logger";

/**
 * Gmail channel provider. Like the LLM / billing / transactional-email seams,
 * the app depends only on the GmailProvider interface; a real Google OAuth +
 * Gmail API transport slots in behind GMAIL_CLIENT_ID/SECRET, and a DISABLED
 * no-op is used otherwise so the app runs fine with the channel dormant.
 *
 * Inbound (email -> ticket) and outbound (agent reply -> email) are wired; the
 * Google calls are isolated in GoogleGmailProvider. Everything that touches our
 * own data (ticket ingestion, threading) lives in provider-agnostic, unit-tested
 * code — see repository/email-ticket.ts.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Scopes: send mail, read inbound, and the connected account's address. */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface GmailTokens {
  refreshToken: string;
  /** The connected mailbox address (support inbox). */
  email: string;
}

export interface InboundEmail {
  /** RFC822 Message-ID header — used to dedupe and to set In-Reply-To on replies. */
  messageId: string;
  /** Gmail thread id — keeps a conversation's tickets together. */
  threadId: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
}

export interface OutboundReply {
  refreshToken: string;
  fromAddress: string;
  to: string;
  subject: string;
  body: string;
  /** Keep the reply in the same Gmail thread. */
  threadId?: string;
  /** Set In-Reply-To / References so mail clients thread it. */
  inReplyTo?: string;
}

export interface GmailProvider {
  /** False when no OAuth credentials are configured (channel dormant). */
  readonly enabled: boolean;
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<GmailTokens>;
  sendReply(input: OutboundReply): Promise<{ messageId: string; threadId: string }>;
  listInbound(tokens: { refreshToken: string }): Promise<InboundEmail[]>;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (unit-tested)                                         */
/* ------------------------------------------------------------------ */

/** URL-safe base64 with padding stripped (Gmail API `raw` format, RFC 4648 §5). */
export function base64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 2047 encoded-word for a header value, only when it contains non-ASCII. */
function encodeHeader(value: string): string {
  // ASCII-only → safe as-is; otherwise MIME encoded-word.
  if (!/[^ -~]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export interface RawMessageOpts {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}

/**
 * Build a base64url-encoded RFC 2822 message for the Gmail send API. Threading
 * headers (In-Reply-To/References) are set so replies land in the same thread.
 */
export function buildRawMessage(opts: RawMessageOpts): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }
  // The body is base64 (CTE) so arbitrary UTF-8 / long lines are safe.
  const body = Buffer.from(opts.body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const mime = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return base64Url(mime);
}

/** Parse a "Display Name <addr@host>" From header into its parts. */
export function parseFromHeader(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1]!.trim(), email: m[2]!.trim().toLowerCase() };
  const addr = raw.trim().toLowerCase();
  return { name: addr.split("@")[0] ?? addr, email: addr };
}

/* ------------------------------------------------------------------ */
/*  Disabled (no credentials) — the dormant default                    */
/* ------------------------------------------------------------------ */

class DisabledGmailProvider implements GmailProvider {
  readonly enabled = false;
  private off(): never {
    throw new Error("Gmail channel is not configured (set GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET).");
  }
  getAuthUrl(): string {
    return this.off();
  }
  async exchangeCode(): Promise<GmailTokens> {
    return this.off();
  }
  async sendReply(): Promise<{ messageId: string; threadId: string }> {
    return this.off();
  }
  async listInbound(): Promise<InboundEmail[]> {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Google (real) transport                                            */
/* ------------------------------------------------------------------ */

class GoogleGmailProvider implements GmailProvider {
  readonly enabled = true;
  constructor(private clientId: string, private clientSecret: string, private redirectUri: string) {}

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `${OAUTH_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GmailTokens> {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`Gmail token exchange ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const tok = (await res.json()) as { refresh_token?: string; access_token: string };
    if (!tok.refresh_token) {
      // Google only returns a refresh_token on the first consent; prompt=consent forces it.
      throw new Error("Gmail did not return a refresh token — revoke prior access and reconnect.");
    }
    const email = await this.fetchAddress(tok.access_token);
    return { refreshToken: tok.refresh_token, email };
  }

  private async accessToken(refreshToken: string): Promise<string> {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Gmail token refresh ${res.status}`);
    return ((await res.json()) as { access_token: string }).access_token;
  }

  private async fetchAddress(accessToken: string): Promise<string> {
    const res = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return "";
    return (((await res.json()) as { email?: string }).email ?? "").toLowerCase();
  }

  async sendReply(input: OutboundReply): Promise<{ messageId: string; threadId: string }> {
    const accessToken = await this.accessToken(input.refreshToken);
    const raw = buildRawMessage({
      from: input.fromAddress,
      to: input.to,
      subject: input.subject,
      body: input.body,
      inReplyTo: input.inReplyTo,
    });
    const res = await fetch(`${GMAIL_API}/messages/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input.threadId ? { raw, threadId: input.threadId } : { raw }),
    });
    if (!res.ok) throw new Error(`Gmail send ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const sent = (await res.json()) as { id: string; threadId: string };
    logger.info("gmail.sent", { to: input.to, threadId: sent.threadId });
    return { messageId: sent.id, threadId: sent.threadId };
  }

  async listInbound(tokens: { refreshToken: string }): Promise<InboundEmail[]> {
    const accessToken = await this.accessToken(tokens.refreshToken);
    // Unread inbox messages from the last day — a bounded poll window.
    const list = await fetch(`${GMAIL_API}/messages?q=${encodeURIComponent("is:unread in:inbox newer_than:1d")}&maxResults=25`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok) throw new Error(`Gmail list ${list.status}`);
    const ids = (((await list.json()) as { messages?: { id: string }[] }).messages ?? []).map((x) => x.id);
    const out: InboundEmail[] = [];
    for (const id of ids) {
      const msg = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!msg.ok) continue;
      const parsed = parseGmailMessage((await msg.json()) as GmailApiMessage);
      if (parsed) out.push(parsed);
    }
    return out;
  }
}

/* ---- Gmail API message parsing (pure, unit-tested) ----------------- */

export interface GmailApiMessage {
  id: string;
  threadId: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailApiMessage["payload"][];
  };
  snippet?: string;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Find the first text/plain body anywhere in a Gmail payload tree. */
function findPlainBody(payload: GmailApiMessage["payload"]): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts ?? []) {
    const found = findPlainBody(part);
    if (found) return found;
  }
  return "";
}

/** The plain-text body, or — for a single-part message with no explicit
 * text/plain part — its raw body. HTML-only parts are never returned as text. */
function extractPlainBody(payload: GmailApiMessage["payload"]): string {
  const plain = findPlainBody(payload);
  if (plain) return plain;
  if (payload && !payload.parts && payload.mimeType !== "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

export function parseGmailMessage(msg: GmailApiMessage): InboundEmail | null {
  const headers = msg.payload?.headers ?? [];
  const h = (name: string) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const fromRaw = h("From");
  if (!fromRaw) return null;
  const { name, email } = parseFromHeader(fromRaw);
  const body = extractPlainBody(msg.payload).trim() || (msg.snippet ?? "");
  return {
    messageId: h("Message-ID") || msg.id,
    threadId: msg.threadId,
    from: email,
    fromName: name,
    subject: h("Subject") || "(no subject)",
    body,
  };
}

/* ------------------------------------------------------------------ */
/*  Selection                                                          */
/* ------------------------------------------------------------------ */

let cached: GmailProvider | null = null;

/** The redirect URI Google calls back to after consent. */
export function gmailRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return process.env.GMAIL_REDIRECT_URI ?? `${base}/api/integrations/gmail/callback`;
}

export function gmail(): GmailProvider {
  if (cached) return cached;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    cached = new DisabledGmailProvider();
    return cached;
  }
  cached = new GoogleGmailProvider(clientId, clientSecret, gmailRedirectUri());
  return cached;
}

/** Test-only: reset the cached provider so env changes take effect. */
export function resetGmailProvider(): void {
  cached = null;
}
