import { vi, describe, it, expect, beforeEach } from "vitest";
import type { RetrievedChunk } from "./rag";
import { findNeverSayViolation, retrieve, scoreConfidence } from "./rag";

/**
 * The Copilot guardrails (confidence threshold + "never say" policies) are
 * advertised in the UI but only have teeth on the live DB-backed RAG path.
 * These tests pin that enforcement. retrieve/scoreConfidence are mocked (they
 * need pgvector); the rest of the rag module — including findNeverSayViolation —
 * stays real.
 */

const { draftReply } = vi.hoisted(() => ({ draftReply: vi.fn() }));
vi.mock("./llm", () => ({ llm: () => ({ draftReply }) }));
vi.mock("./rag", async (importActual) => {
  const actual = await importActual<typeof import("./rag")>();
  return { ...actual, retrieve: vi.fn(), scoreConfidence: vi.fn() };
});

// Imported after the mocks above are registered.
const { RagDraftProvider } = await import("./rag-provider");

const chunk: RetrievedChunk = {
  docId: "doc-1",
  docTitle: "Refund policy",
  path: "Duplicate charges",
  content: "Duplicate charges are refunded within 5–10 business days to the original method.",
  similarity: 0.82,
};

const ticket = {
  subject: "Billing question",
  customer: { name: "Dana Lee" },
  messages: [{ kind: "customer", text: "Can I get a refund for the duplicate charge?" }],
  draft: null,
} as unknown as Parameters<InstanceType<typeof RagDraftProvider>["regenerate"]>[0];

beforeEach(() => {
  vi.mocked(retrieve).mockResolvedValue([chunk]);
  draftReply.mockReset();
  draftReply.mockResolvedValue("Hi Dana — here is your grounded answer.");
});

describe("RagDraftProvider — confidence (threshold is a client-side flag, not a server refusal)", () => {
  it("returns a below-threshold draft with its real confidence (held-for-review is decided in the UI)", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.6);
    const res = await new RagDraftProvider("ws1").regenerate(ticket, [], { threshold: 0.7, neverSay: [] });
    expect(res.draft).not.toBeNull();
    expect(res.draft?.confidence).toBe(0.6);
  });

  it("returns a draft above the bar with its confidence", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.85);
    const res = await new RagDraftProvider("ws1").regenerate(ticket, [], { threshold: 0.7, neverSay: [] });
    expect(res.draft?.text).toContain("grounded answer");
    expect(res.draft?.confidence).toBe(0.85);
  });

  it("refuses only when no grounded source exists", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(null);
    const res = await new RagDraftProvider("ws1").regenerate(ticket, [], { threshold: 0.5, neverSay: [] });
    expect(res.draft).toBeNull();
    expect(res.failureReason).toMatch(/No grounded source/);
  });

  it("playground returns a low-but-grounded answer with its real confidence", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.5);
    const res = await new RagDraftProvider("ws1").answer("refund?", [], { threshold: 0.8, neverSay: [] });
    expect(res.conf).toBe(0.5);
  });
});

describe("RagDraftProvider — never-say policies", () => {
  it("withholds a draft that contains a banned phrase", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.9);
    draftReply.mockResolvedValue("Sure — we'll issue a full refund right away.");
    const res = await new RagDraftProvider("ws1").regenerate(ticket, [], { threshold: 0.5, neverSay: ["full refund"] });
    expect(res.draft).toBeNull();
    expect(res.failureReason).toMatch(/never say/i);
  });

  it("allows a draft when no banned phrase appears", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.9);
    draftReply.mockResolvedValue("We've corrected the billing issue on your account.");
    const res = await new RagDraftProvider("ws1").regenerate(ticket, [], { threshold: 0.5, neverSay: ["full refund"] });
    expect(res.draft).not.toBeNull();
  });
});

describe("RagDraftProvider — tone rewrite", () => {
  it("threads the tone into the drafter and skips the threshold gate", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.5); // below a high bar...
    draftReply.mockResolvedValue("Concise grounded reply.");
    const res = await new RagDraftProvider("ws1").rewrite(ticket, "concise", { threshold: 0.95, neverSay: [] });
    // ...but rewrite of an accepted ticket is not threshold-gated.
    expect(res.draft?.variant).toBe("concise");
    expect(draftReply).toHaveBeenCalledWith(expect.objectContaining({ tone: "concise" }));
  });

  it("still enforces never-say on a rewrite", async () => {
    vi.mocked(scoreConfidence).mockReturnValue(0.9);
    draftReply.mockResolvedValue("Empathetic note mentioning a chargeback.");
    const res = await new RagDraftProvider("ws1").rewrite(ticket, "empathetic", { threshold: 0.5, neverSay: ["chargeback"] });
    expect(res.draft).toBeNull();
  });
});

describe("findNeverSayViolation", () => {
  it("is case-insensitive and returns the matched phrase", () => {
    expect(findNeverSayViolation("We can offer a REFUND today.", ["refund"])).toBe("refund");
  });
  it("returns null when nothing matches or the list is empty", () => {
    expect(findNeverSayViolation("All good here.", ["refund"])).toBeNull();
    expect(findNeverSayViolation("anything", [])).toBeNull();
    expect(findNeverSayViolation("anything", undefined)).toBeNull();
  });
});
