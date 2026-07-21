import { NextResponse } from "next/server";
import { slack } from "@/server/slack/slack";
import { repo } from "@/server/repository";
import { readBodyCapped } from "@/server/api";
import { logger } from "@/server/logger";

/** Generous for Slack Events API payloads; caps a forged pre-verification body. */
const SLACK_MAX_BODY_BYTES = 256 * 1024;

/**
 * Slack Events API webhook. Unauthenticated by session — authorized by the Slack
 * request signature (HMAC over the raw body + timestamp, with replay window).
 * Handles the url_verification handshake, then turns inbound message events into
 * tickets (deduped by event ts). Always answers 200 quickly so Slack doesn't
 * disable the subscription; ingestion failures are logged, not surfaced.
 */
export const dynamic = "force-dynamic";

interface SlackEvent {
  type?: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}

export async function POST(req: Request) {
  // Streamed, byte-capped read — this endpoint is public, so the body must be
  // bounded BEFORE the signature check can reject the request.
  let raw: string;
  try {
    raw = await readBodyCapped(req, SLACK_MAX_BODY_BYTES);
  } catch {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const s = slack();

  if (!s.verifyRequest(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: { type?: string; challenge?: string; team_id?: string; event?: SlackEvent };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }

  // Events API setup handshake.
  if (body.type === "url_verification" && body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type === "event_callback" && body.event) {
    // Best-effort ingest; never block the 200 ack on it.
    void handleEvent(body.team_id, body.event).catch((err) =>
      logger.reportError("slack.event_failed", err, { teamId: body.team_id }),
    );
  }
  return NextResponse.json({ ok: true });
}

async function handleEvent(teamId: string | undefined, event: SlackEvent): Promise<void> {
  if (!teamId || event.type !== "message") return;
  // Ignore the bot's own posts (our outbound replies echo back) and non-plain
  // messages (edits/deletes/joins) to avoid loops and noise.
  if (event.bot_id || event.subtype) return;
  if (!event.user || !event.channel || !event.ts || !event.text?.trim()) return;

  const r = repo();
  const workspaceId = await r.resolveSlackWorkspace(teamId);
  if (!workspaceId) return; // not an installed team

  const account = await r.getSlackAccount(workspaceId);
  const userName = account ? await slack().resolveUserName(account.botToken, event.user) : event.user;

  await r.ingestSlackMessage(workspaceId, {
    channel: event.channel,
    threadTs: event.thread_ts || event.ts,
    ts: event.ts,
    userId: event.user,
    userName,
    text: event.text,
  });
}
