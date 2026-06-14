import crypto from "node:crypto";
import { logger } from "@/server/logger";

/**
 * Slack channel provider. Like the Gmail / LLM / billing seams, the app depends
 * only on the SlackProvider interface; a real Slack transport (OAuth install,
 * chat.postMessage, Events API signature verification) slots in behind
 * SLACK_SIGNING_SECRET (+ SLACK_CLIENT_ID/SECRET for the install flow), and a
 * DISABLED no-op is used otherwise so the app runs with the channel dormant.
 *
 * Inbound (Slack message -> ticket) and outbound (agent reply -> chat.postMessage)
 * are wired; the Slack calls are isolated here. Ticket ingestion / threading lives
 * in provider-agnostic, unit-tested code — see repository/slack-ticket.ts.
 */

const OAUTH_AUTHORIZE = "https://slack.com/oauth/v2/authorize";
const OAUTH_ACCESS = "https://slack.com/api/oauth.v2.access";
const POST_MESSAGE = "https://slack.com/api/chat.postMessage";
const USERS_INFO = "https://slack.com/api/users.info";

/** Bot-token scopes needed to read channel history, post replies, and resolve names. */
export const SLACK_SCOPES = ["channels:history", "groups:history", "im:history", "chat:write", "users:read"];

/** Reject Events API requests whose timestamp is older than this (replay guard). */
const MAX_SKEW_SEC = 5 * 60;

export interface SlackAccount {
  botToken: string;
  teamId: string;
  teamName: string;
}

export interface InboundSlackMessage {
  /** Channel id the message arrived in. */
  channel: string;
  /** Root thread ts — groups a conversation into one ticket. */
  threadTs: string;
  /** This message's ts — unique per message, used to dedupe. */
  ts: string;
  userId: string;
  userName: string;
  text: string;
}

export interface SlackProvider {
  /** True when SLACK_SIGNING_SECRET is set — the minimum to receive verified events. */
  readonly enabled: boolean;
  /** True when OAuth client credentials are set — the install/connect flow works. */
  readonly canInstall: boolean;
  getInstallUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<SlackAccount>;
  postReply(input: { botToken: string; channel: string; threadTs: string; text: string }): Promise<{ ts: string }>;
  /** Verify an Events API request's signature + freshness. */
  verifyRequest(rawBody: string, timestamp: string | null, signature: string | null): boolean;
  resolveUserName(botToken: string, userId: string): Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  Pure signature verification (unit-tested)                          */
/* ------------------------------------------------------------------ */

/**
 * Verify a Slack request signature per the v0 scheme: the signature is
 * `v0=` + HMAC-SHA256(signingSecret, `v0:{timestamp}:{rawBody}`). Constant-time
 * compared; requests with a timestamp outside the skew window are rejected
 * (replay protection). Returns false on any malformed/missing input.
 */
export function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!signingSecret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > MAX_SKEW_SEC) return false;
  const expected = "v0=" + crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/*  Disabled (no signing secret) — the dormant default                 */
/* ------------------------------------------------------------------ */

class DisabledSlackProvider implements SlackProvider {
  readonly enabled = false;
  readonly canInstall = false;
  private off(): never {
    throw new Error("Slack channel is not configured (set SLACK_SIGNING_SECRET / SLACK_CLIENT_ID / SLACK_CLIENT_SECRET).");
  }
  getInstallUrl(): string {
    return this.off();
  }
  async exchangeCode(): Promise<SlackAccount> {
    return this.off();
  }
  async postReply(): Promise<{ ts: string }> {
    return this.off();
  }
  verifyRequest(): boolean {
    return false;
  }
  async resolveUserName(_botToken: string, userId: string): Promise<string> {
    return userId; // graceful fallback, consistent with the real provider
  }
}

/* ------------------------------------------------------------------ */
/*  Real Slack transport                                               */
/* ------------------------------------------------------------------ */

class RealSlackProvider implements SlackProvider {
  constructor(
    private signingSecret: string | undefined,
    private clientId: string | undefined,
    private clientSecret: string | undefined,
  ) {}
  get enabled(): boolean {
    return !!this.signingSecret;
  }
  get canInstall(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getInstallUrl(state: string, redirectUri: string): string {
    if (!this.clientId) throw new Error("SLACK_CLIENT_ID is not set.");
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: SLACK_SCOPES.join(","),
      redirect_uri: redirectUri,
      state,
    });
    return `${OAUTH_AUTHORIZE}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<SlackAccount> {
    if (!this.clientId || !this.clientSecret) throw new Error("Slack OAuth client credentials are not set.");
    const res = await fetch(OAUTH_ACCESS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: redirectUri }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
      team?: { id: string; name: string };
    };
    if (!data.ok || !data.access_token) throw new Error(`Slack oauth.v2.access failed: ${data.error ?? "unknown"}`);
    // Fail loud rather than store an empty teamId — that would silently break
    // resolveSlackWorkspace() and drop every inbound event for this install.
    if (!data.team?.id) throw new Error("Slack oauth.v2.access returned no team id.");
    return { botToken: data.access_token, teamId: data.team.id, teamName: data.team.name ?? "" };
  }

  async postReply(input: { botToken: string; channel: string; threadTs: string; text: string }): Promise<{ ts: string }> {
    const res = await fetch(POST_MESSAGE, {
      method: "POST",
      headers: { authorization: `Bearer ${input.botToken}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: input.channel, thread_ts: input.threadTs, text: input.text }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; ts?: string };
    if (!data.ok || !data.ts) throw new Error(`Slack chat.postMessage failed: ${data.error ?? "no ts"}`);
    logger.info("slack.sent", { channel: input.channel, threadTs: input.threadTs });
    return { ts: data.ts };
  }

  verifyRequest(rawBody: string, timestamp: string | null, signature: string | null): boolean {
    if (!this.signingSecret) return false;
    return verifySlackSignature(this.signingSecret, rawBody, timestamp, signature);
  }

  async resolveUserName(botToken: string, userId: string): Promise<string> {
    try {
      const res = await fetch(`${USERS_INFO}?user=${encodeURIComponent(userId)}`, {
        headers: { authorization: `Bearer ${botToken}` },
      });
      const data = (await res.json()) as { ok: boolean; user?: { real_name?: string; name?: string } };
      if (!data.ok) return userId;
      return data.user?.real_name || data.user?.name || userId;
    } catch {
      return userId;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Selection                                                          */
/* ------------------------------------------------------------------ */

let cached: SlackProvider | null = null;

export function slackRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return process.env.SLACK_REDIRECT_URI ?? `${base}/api/integrations/slack/callback`;
}

export function slack(): SlackProvider {
  if (cached) return cached;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!signingSecret && !(clientId && clientSecret)) {
    cached = new DisabledSlackProvider();
    return cached;
  }
  cached = new RealSlackProvider(signingSecret, clientId, clientSecret);
  return cached;
}

/** Test-only: reset the cached provider so env changes take effect. */
export function resetSlackProvider(): void {
  cached = null;
}
