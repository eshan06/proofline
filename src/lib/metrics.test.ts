import { describe, it, expect } from "vitest";
import type { Ticket, Message, AIDraft, Workspace } from "@/lib/schemas";
import {
  dashboardMetrics,
  channelHealth,
  channelMix,
  recentActivity,
  attentionTickets,
  confidenceDistribution,
  topTags,
  topCitedDocs,
  leaderboard,
  billingUsage,
  isResolved,
  aiReplySent,
  aiDrafted,
  pct,
  conf2,
} from "@/lib/metrics";

/* ---- factories ---------------------------------------------------- */

function msg(over: Partial<Message> = {}): Message {
  return { id: `m${Math.round(over.text?.length ?? 0)}`, kind: "customer", text: "hi", time: "now", ...over };
}

function draft(over: Partial<AIDraft> = {}): AIDraft {
  return {
    text: "draft",
    confidence: 0.8,
    confMeta: "",
    citations: [],
    reasoning: "",
    actions: [],
    variant: "base",
    alternates: { base: "", regen: "", concise: "", empathetic: "" },
    ...over,
  };
}

let n = 0;
function mk(over: Partial<Ticket> = {}): Ticket {
  n += 1;
  return {
    id: `TKT-${n}`,
    customer: { name: "Ada Lovelace", company: "Analytical", initials: "AL", hue: 200 },
    channel: "web",
    subject: "Subject",
    preview: "preview",
    priority: "medium",
    tags: [],
    status: "open",
    stage: "new",
    assignee: null,
    slaMins: 0,
    slaTotal: 30,
    unread: false,
    time: "2m ago",
    conf: null,
    archived: false,
    messages: [],
    draft: null,
    ...over,
  };
}

/* ---- dashboardMetrics --------------------------------------------- */

describe("dashboardMetrics", () => {
  it("counts open, resolved, urgent, and SLA-risk over the right populations", () => {
    const tickets = [
      mk({ status: "open", priority: "urgent", slaMins: 10 }), // open, urgent, sla-risk
      mk({ status: "open", slaMins: 200 }), // open, not risk
      mk({ status: "waiting", slaMins: 30 }), // open, sla-risk
      mk({ status: "closed" }), // resolved
      mk({ stage: "resolved", status: "open" }), // resolved via stage
      mk({ status: "open", archived: true, slaMins: 5 }), // archived → excluded from live
    ];
    const m = dashboardMetrics(tickets);
    expect(m.total).toBe(6);
    expect(m.open).toBe(3); // 3 live unresolved (archived + resolved excluded)
    expect(m.urgent).toBe(1);
    expect(m.slaRisk).toBe(2); // 10m and 30m (archived 5m excluded as it's archived)
    expect(m.resolved).toBe(2); // closed + stage:resolved
  });

  it("computes acceptance as aiSent/drafted and avg confidence over scored tickets", () => {
    const tickets = [
      mk({ draft: draft(), conf: 0.9, messages: [msg({ kind: "agent", viaAI: true })] }), // drafted + sent
      mk({ draft: draft(), conf: 0.6 }), // drafted, not sent
      mk({ conf: null }), // no confidence
      mk({ conf: 0.3 }), // scored, no draft
    ];
    const m = dashboardMetrics(tickets);
    expect(m.drafted).toBe(2);
    expect(m.aiSent).toBe(1);
    expect(m.acceptance).toBeCloseTo(0.5);
    expect(m.avgConfidence).toBeCloseTo((0.9 + 0.6 + 0.3) / 3);
  });

  it("returns null acceptance/confidence when there is nothing to measure", () => {
    const m = dashboardMetrics([mk(), mk()]);
    expect(m.acceptance).toBeNull();
    expect(m.avgConfidence).toBeNull();
    expect(m.aiReplies).toBe(0);
  });

  it("counts multiple AI replies within a ticket", () => {
    const t = mk({
      draft: draft(),
      messages: [msg({ kind: "agent", viaAI: true }), msg({ kind: "agent", viaAI: true }), msg({ kind: "agent" })],
    });
    expect(dashboardMetrics([t]).aiReplies).toBe(2);
  });

  it("is all-zero / null for an empty workspace", () => {
    const m = dashboardMetrics([]);
    expect(m).toMatchObject({ open: 0, resolved: 0, total: 0, drafted: 0, aiSent: 0, aiReplies: 0 });
    expect(m.acceptance).toBeNull();
    expect(m.avgConfidence).toBeNull();
  });
});

/* ---- predicates --------------------------------------------------- */

describe("ticket predicates", () => {
  it("isResolved matches closed status or resolved stage", () => {
    expect(isResolved(mk({ status: "closed" }))).toBe(true);
    expect(isResolved(mk({ stage: "resolved" }))).toBe(true);
    expect(isResolved(mk({ status: "open", stage: "new" }))).toBe(false);
  });
  it("aiReplySent / aiDrafted reflect the transcript and draft", () => {
    expect(aiReplySent(mk({ messages: [msg({ kind: "agent", viaAI: true })] }))).toBe(true);
    expect(aiReplySent(mk({ messages: [msg({ kind: "agent" })] }))).toBe(false);
    expect(aiDrafted(mk({ draft: draft() }))).toBe(true);
    expect(aiDrafted(mk({ messages: [msg({ kind: "agent", viaAI: true })] }))).toBe(true);
    expect(aiDrafted(mk())).toBe(false);
  });
});

/* ---- channelHealth ------------------------------------------------ */

describe("channelHealth", () => {
  it("counts live tickets per channel and reflects connection state", () => {
    const ws = {
      tickets: [mk({ channel: "web" }), mk({ channel: "web" }), mk({ channel: "email" }), mk({ channel: "slack", archived: true })],
      integrations: [{ key: "slack", connected: true } as never, { key: "gmail", connected: false } as never],
      widget: { siteKey: "k", enabled: true, allowedOrigins: [] },
    };
    const h = channelHealth(ws);
    const web = h.find((c) => c.channel === "web")!;
    const email = h.find((c) => c.channel === "email")!;
    const slack = h.find((c) => c.channel === "slack")!;
    expect(web.live).toBe(2);
    expect(web.connected).toBe(true); // widget enabled
    expect(email.live).toBe(1);
    expect(email.connected).toBe(false); // gmail not connected
    expect(slack.live).toBe(0); // the only slack ticket is archived
    expect(slack.connected).toBe(true);
  });
});

/* ---- channelMix --------------------------------------------------- */

describe("channelMix", () => {
  it("splits live tickets per channel into AI-drafted vs human-only", () => {
    const tickets = [
      mk({ channel: "web", draft: draft() }), // ai
      mk({ channel: "web" }), // human
      mk({ channel: "email", messages: [msg({ kind: "agent", viaAI: true })] }), // ai (sent)
      mk({ channel: "slack", archived: true, draft: draft() }), // archived → excluded
    ];
    const mix = channelMix(tickets);
    const web = mix.find((c) => c.channel === "web")!;
    expect(web).toMatchObject({ ai: 1, human: 1, total: 2 });
    expect(mix.find((c) => c.channel === "email")!).toMatchObject({ ai: 1, human: 0, total: 1 });
    expect(mix.find((c) => c.channel === "slack")!).toMatchObject({ ai: 0, human: 0, total: 0 });
  });
});

/* ---- recentActivity ----------------------------------------------- */

describe("recentActivity", () => {
  it("maps audit events to initials + text, capped at the limit", () => {
    const audit = [
      { time: "2m ago", user: "Maya Chen", action: "Approved a draft", type: "AI" as const },
      { time: "5m ago", user: "Eshan", action: "Escalated TKT-9", type: "Team" as const },
    ];
    const out = recentActivity(audit, 1);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ init: "MC", text: "Approved a draft", time: "2m ago", type: "AI" });
  });
});

/* ---- attentionTickets --------------------------------------------- */

describe("attentionTickets", () => {
  it("ranks SLA risk first (soonest breach), then low confidence, then no-draft", () => {
    const slaSoon = mk({ subject: "sla-soon", status: "open", slaMins: 5 });
    const slaLate = mk({ subject: "sla-late", status: "open", slaMins: 40 });
    const lowConf = mk({ subject: "low", status: "open", slaMins: 0, conf: 0.4, draft: draft({ confidence: 0.4 }) });
    const noDraft = mk({ subject: "nodraft", status: "open", slaMins: 0 });
    const resolved = mk({ subject: "done", status: "closed", slaMins: 5 }); // excluded
    const order = attentionTickets([noDraft, lowConf, slaLate, slaSoon, resolved]).map((a) => a.subject);
    expect(order).toEqual(["sla-soon", "sla-late", "low", "nodraft"]);
  });

  it("excludes archived and resolved tickets and respects the limit", () => {
    const tickets = [
      mk({ status: "open", slaMins: 5 }),
      mk({ status: "open", slaMins: 6 }),
      mk({ status: "open", slaMins: 7, archived: true }),
    ];
    expect(attentionTickets(tickets, 1)).toHaveLength(1);
  });
});

/* ---- distributions ------------------------------------------------ */

describe("confidenceDistribution", () => {
  it("buckets confidence into the five bands and ignores null scores", () => {
    const tickets = [
      mk({ conf: 0.2 }), // <50
      mk({ conf: 0.55 }), // 50-65
      mk({ conf: 0.72 }), // 65-80
      mk({ conf: 0.85 }), // 80-90
      mk({ conf: 0.95 }), // 90+
      mk({ conf: 0.9 }), // boundary → 90+
      mk({ conf: null }), // ignored
    ];
    expect(confidenceDistribution(tickets)).toEqual([1, 1, 1, 1, 2]);
  });
});

describe("topTags", () => {
  it("tallies tags across live tickets, descending, limited", () => {
    const tickets = [
      mk({ tags: ["billing", "bug"] }),
      mk({ tags: ["billing"] }),
      mk({ tags: ["how-to"] }),
      mk({ tags: ["billing"], archived: true }), // archived excluded
    ];
    expect(topTags(tickets, 2)).toEqual([
      ["billing", 2],
      ["bug", 1],
    ]);
  });
});

describe("topCitedDocs", () => {
  it("sums citation.uses by title across drafts", () => {
    const ws = {
      tickets: [
        mk({ draft: draft({ citations: [{ title: "Refund.md", path: "p", snippet: "s", uses: 3 }] }) }),
        mk({ draft: draft({ citations: [{ title: "Refund.md", path: "p", snippet: "s", uses: 2 }, { title: "SLA.md", path: "p", snippet: "s", uses: 1 }] }) }),
      ],
      kbDocs: [],
    };
    expect(topCitedDocs(ws)).toEqual([
      ["Refund.md", 5],
      ["SLA.md", 1],
    ]);
  });

  it("falls back to KB cited counters when no draft citations exist", () => {
    const ws = {
      tickets: [mk()],
      kbDocs: [
        { id: "1", name: "Guide.md", source: "x", status: "indexed" as const, chunks: "9", cited: "12", synced: "now" },
        { id: "2", name: "Empty.md", source: "x", status: "indexed" as const, chunks: "1", cited: "0", synced: "now" },
      ],
    };
    expect(topCitedDocs(ws)).toEqual([["Guide.md", 12]]);
  });
});

/* ---- leaderboard -------------------------------------------------- */

describe("leaderboard", () => {
  it("computes per-agent resolved/acceptance/confidence and sorts by resolved", () => {
    const tickets = [
      mk({ assignee: "Maya", status: "closed", draft: draft(), conf: 0.9, messages: [msg({ kind: "agent", viaAI: true })] }),
      mk({ assignee: "Maya", status: "closed", conf: 0.8 }),
      mk({ assignee: "Eshan", status: "open", draft: draft(), conf: 0.5 }), // drafted, not sent
      mk({ assignee: null }), // unassigned → ignored
    ];
    const lb = leaderboard(tickets);
    expect(lb.map((a) => a.name)).toEqual(["Maya", "Eshan"]); // Maya 2 resolved > Eshan 0
    const maya = lb[0]!;
    expect(maya.resolved).toBe(2);
    expect(maya.acceptance).toBeCloseTo(1); // 1 drafted, 1 sent
    expect(maya.avgConfidence).toBeCloseTo(0.85);
    const eshan = lb[1]!;
    expect(eshan.acceptance).toBeCloseTo(0); // drafted but not sent
  });

  it("omits agents with no assigned tickets", () => {
    expect(leaderboard([mk({ assignee: "Leo" })]).map((a) => a.name)).toEqual(["Leo"]);
  });
});

/* ---- billingUsage ------------------------------------------------- */

describe("billingUsage", () => {
  it("derives usage from tickets, KB, and subscription seats", () => {
    const ws: Pick<Workspace, "tickets" | "kbDocs" | "subscription"> = {
      tickets: [
        mk({ messages: [msg({ kind: "agent", viaAI: true }), msg({ kind: "agent", viaAI: true })] }),
        mk(),
      ],
      kbDocs: [
        { id: "1", name: "A", source: "x", status: "indexed", chunks: "1", cited: "1", synced: "now" },
        { id: "2", name: "B", source: "x", status: "processing", chunks: "0", cited: "0", synced: "now" },
      ],
      subscription: { plan: "Growth", status: "active", seats: 3, seatLimit: 10, seatsUsed: 3, currentPeriodEnd: "" },
    };
    const u = billingUsage(ws);
    expect(u.find((x) => x.label === "Tickets handled")!.value).toBe("2");
    expect(u.find((x) => x.label === "AI replies sent")!.value).toBe("2");
    expect(u.find((x) => x.label === "Docs indexed")!.value).toBe("1"); // only indexed
    const seats = u.find((x) => x.label === "Team seats")!;
    expect(seats.value).toBe("3 / 10");
    expect(seats.ratio).toBeCloseTo(0.3);
  });
});

/* ---- formatters --------------------------------------------------- */

describe("formatters", () => {
  it("pct and conf2 handle null", () => {
    expect(pct(0.873)).toBe("87%");
    expect(pct(null)).toBe("—");
    expect(conf2(0.844)).toBe("0.84");
    expect(conf2(null)).toBe("—");
  });
});
