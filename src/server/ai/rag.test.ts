import { describe, expect, it } from "vitest";
import { chunkText, scoreConfidence, toCitations, filterGrounded, type RetrievedChunk } from "./rag";
import { LocalEmbedder } from "./embeddings";

const chunk = (over: Partial<RetrievedChunk>): RetrievedChunk => ({
  docId: "d1", docTitle: "Doc", path: "Section", content: "content", similarity: 0.5, ...over,
});

describe("chunking", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("a few short words")).toHaveLength(1);
  });
  it("splits long text into overlapping windows", () => {
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, 60, 15);
    expect(chunks.length).toBeGreaterThan(1);
    // overlap: the tail of chunk n reappears at the head of chunk n+1
    const firstWords = chunks[0]!.split(" ");
    const secondWords = chunks[1]!.split(" ");
    expect(secondWords[0]).toBe(firstWords[60 - 15]);
  });
});

describe("confidence scoring (the refusal gate)", () => {
  it("refuses when nothing clears the grounding bar", () => {
    expect(scoreConfidence([chunk({ similarity: 0.05 }), chunk({ similarity: 0.15 })])).toBeNull();
    expect(scoreConfidence([])).toBeNull();
  });
  it("scores higher with a stronger top match", () => {
    const weak = scoreConfidence([chunk({ similarity: 0.25 })])!;
    const strong = scoreConfidence([chunk({ similarity: 0.9 })])!;
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(0.98);
  });
  it("rewards agreement across distinct documents", () => {
    const single = scoreConfidence([chunk({ docId: "d1", similarity: 0.6 })])!;
    const multi = scoreConfidence([chunk({ docId: "d1", similarity: 0.6 }), chunk({ docId: "d2", similarity: 0.55 })])!;
    expect(multi).toBeGreaterThan(single);
  });
});

describe("grounded filtering + citations", () => {
  it("keeps only chunks above the bar", () => {
    const kept = filterGrounded([chunk({ similarity: 0.5 }), chunk({ similarity: 0.05 })]);
    expect(kept).toHaveLength(1);
  });
  it("de-duplicates citations by doc+path and truncates long snippets", () => {
    const long = "x ".repeat(200);
    const cites = toCitations([
      chunk({ docTitle: "A", path: "P", content: long }),
      chunk({ docTitle: "A", path: "P", content: "dup" }),
      chunk({ docTitle: "B", path: "Q", content: "other" }),
    ]);
    expect(cites).toHaveLength(2);
    expect(cites[0]!.snippet.length).toBeLessThanOrEqual(220);
  });
});

describe("local embedder", () => {
  const emb = new LocalEmbedder();
  const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);

  it("produces unit-normalized vectors of the configured dimension", async () => {
    const [v] = await emb.embed(["refund duplicate charge"]);
    expect(v!.length).toBe(emb.dim);
    expect(cos(v!, v!)).toBeCloseTo(1, 4);
  });

  it("ranks similar text above unrelated text (real lexical retrieval)", async () => {
    const [q, related, unrelated] = await emb.embed([
      "how do I get a refund for a duplicate charge",
      "duplicate charges are refunded in full to the original payment method",
      "connect the slack app and re-invite it to the channel",
    ]);
    expect(cos(q!, related!)).toBeGreaterThan(cos(q!, unrelated!));
  });
});
