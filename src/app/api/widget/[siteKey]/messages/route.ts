import { NextResponse } from "next/server";
import { widgetMessageSchema } from "@/lib/schemas";
import { repo } from "@/server/repository";
import { clientKey, rateLimit, LIMITS } from "@/server/rate-limit";
import { widgetCorsOrigin, corsHeaders } from "@/server/widget-cors";
import { logger } from "@/server/logger";

/**
 * Public, unauthenticated website-chat intake. Inbound visitor messages create
 * or append to a ticket; the visitor polls here for agent replies. Authorized
 * by the public site key (which tenant) + an unguessable per-visitor
 * conversation token (which conversation) — never a session cookie.
 */

export const dynamic = "force-dynamic";

type Resolved =
  | { ok: true; workspaceId: string; allowOrigin: string }
  | { ok: false; status: number; error: string; allowOrigin: string };

async function resolve(siteKey: string, origin: string | null): Promise<Resolved> {
  const site = await repo().resolveSiteKey(siteKey);
  if (!site) return { ok: false, status: 404, error: "Unknown or disabled widget.", allowOrigin: "*" };
  const allowOrigin = widgetCorsOrigin(origin, site.allowedOrigins);
  if (allowOrigin === null) return { ok: false, status: 403, error: "Origin not allowed.", allowOrigin: "*" };
  return { ok: true, workspaceId: site.workspaceId, allowOrigin };
}

export async function OPTIONS(req: Request, ctx: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await ctx.params;
  const r = await resolve(siteKey, req.headers.get("origin"));
  return new NextResponse(null, { status: 204, headers: corsHeaders(r.allowOrigin) });
}

export async function POST(req: Request, ctx: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await ctx.params;
  const r = await resolve(siteKey, req.headers.get("origin"));
  const headers = corsHeaders(r.allowOrigin);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers });

  const rl = rateLimit(clientKey(req, "widget"), LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many messages — slow down." }, { status: 429, headers });
  }

  let body;
  try {
    body = widgetMessageSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Expected { text, conversationId? }." }, { status: 400, headers });
  }

  const repoI = repo();
  let token = body.conversationId;
  if (token) {
    const ok = await repoI.appendWidgetMessage(r.workspaceId, token, body.text);
    if (!ok) return NextResponse.json({ error: "Unknown conversation." }, { status: 404, headers });
  } else {
    const started = await repoI.startWidgetConversation(r.workspaceId, body.visitor ?? {}, body.text);
    token = started.token;
    logger.event("widget.conversation_started", { workspaceId: r.workspaceId, ticketId: started.ticketId });
  }
  const messages = (await repoI.getWidgetTranscript(r.workspaceId, token)) ?? [];
  return NextResponse.json({ conversationId: token, messages }, { headers });
}

export async function GET(req: Request, ctx: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await ctx.params;
  const r = await resolve(siteKey, req.headers.get("origin"));
  const headers = corsHeaders(r.allowOrigin);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers });

  const token = new URL(req.url).searchParams.get("conversationId");
  if (!token) return NextResponse.json({ error: "conversationId required." }, { status: 400, headers });
  const messages = await repo().getWidgetTranscript(r.workspaceId, token);
  if (messages === null) return NextResponse.json({ error: "Unknown conversation." }, { status: 404, headers });
  return NextResponse.json({ conversationId: token, messages }, { headers });
}
