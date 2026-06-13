import { describe, expect, it } from "vitest";
import { mockAnswer } from "./mock-provider";
import { seedKbDocs } from "@/data/workspace";

describe("mock provider keyword routing", () => {
  it("routes refund/charge questions to 0.89", () => {
    expect(mockAnswer("I want a refund", seedKbDocs).conf).toBe(0.89);
    expect(mockAnswer("why was I charged twice", seedKbDocs).conf).toBe(0.89);
  });

  it("routes invite/team questions to 0.96", () => {
    expect(mockAnswer("how do I invite teammates", seedKbDocs).conf).toBe(0.96);
  });

  it("routes slack questions to a low 0.58 (drives the low-confidence flow)", () => {
    expect(mockAnswer("my slack notifications stopped", seedKbDocs).conf).toBe(0.58);
  });

  it("falls back to 0.74 for anything unmatched", () => {
    expect(mockAnswer("do you support dark mode", seedKbDocs).conf).toBe(0.74);
  });

  it("attaches citations to every grounded answer", () => {
    expect(mockAnswer("refund please", seedKbDocs).cites.length).toBeGreaterThan(0);
  });
});

describe("the refusal path (AI never guesses)", () => {
  it("refuses SSO/SAML while the SSO guide is failed (conf null, no cites)", () => {
    const res = mockAnswer("walk me through SAML SSO with Okta", seedKbDocs);
    expect(res.conf).toBeNull();
    expect(res.text).toBe("");
    expect(res.cites).toHaveLength(0);
  });

  it("would answer SSO once the guide is indexed — refusal is grounded in the KB, not the keyword", () => {
    const fixedKb = seedKbDocs.map((d) =>
      d.name.toLowerCase().includes("sso") ? { ...d, status: "indexed" as const } : d,
    );
    const res = mockAnswer("how do I set up SAML SSO", fixedKb);
    expect(res.conf).not.toBeNull();
    expect(res.cites.length).toBeGreaterThan(0);
  });
});
