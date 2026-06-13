import type { KbDoc, PlaygroundResult, Ticket, Tone } from "@/lib/schemas";
import { MOCK_LATENCY, type DraftProvider, type DraftResult } from "./provider";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fixture-backed provider. Drafts and their alternates come from the seed
 * data; the playground routes by keyword exactly as the prototype does:
 * refund/charge → 0.89 · invite/team → 0.96 · slack → 0.58 ·
 * sso/saml/okta → refusal · default → 0.74.
 *
 * The mock honors the design's latency contract so the UI exercises its real
 * loading states (regenerating veil, "Searching 7 sources…").
 */
export class MockDraftProvider implements DraftProvider {
  constructor(private latency: typeof MOCK_LATENCY = MOCK_LATENCY) {}

  async regenerate(ticket: Ticket): Promise<DraftResult> {
    await sleep(this.latency.regenerate);
    if (!ticket.draft) {
      return { draft: null, failureReason: ticket.aiFailureReason ?? "No grounded source found." };
    }
    // Alternate between the base and "regen" variants, dropping any manual edits.
    const variant = ticket.draft.variant === "regen" ? "base" : "regen";
    return {
      draft: { ...ticket.draft, variant, text: ticket.draft.alternates[variant] },
    };
  }

  async rewrite(ticket: Ticket, tone: Tone): Promise<DraftResult> {
    await sleep(this.latency.tone);
    if (!ticket.draft) {
      return { draft: null, failureReason: ticket.aiFailureReason ?? "No grounded source found." };
    }
    return {
      draft: { ...ticket.draft, variant: tone, text: ticket.draft.alternates[tone] },
    };
  }

  async answer(question: string, kb: KbDoc[]): Promise<PlaygroundResult> {
    await sleep(this.latency.playground);
    return mockAnswer(question, kb);
  }
}

/**
 * Pure keyword router — exported separately so it is unit-testable without the
 * latency. The SSO refusal only applies while the SSO guide is failed; it is
 * driven by the knowledge base, not the keyword alone.
 */
export function mockAnswer(question: string, kb: KbDoc[]): PlaygroundResult {
  const q = question.trim().toLowerCase();
  if (q.includes("refund") || q.includes("charge")) {
    return {
      conf: 0.89,
      text: "Hi — sorry about the duplicate charge! I’ve confirmed it on our side and issued a full refund to your original payment method. It typically appears within 5–10 business days, and a credit note is on its way to your email.",
      cites: ["Refund policy → Duplicate charges", "Billing operations → Retried payment jobs"],
    };
  }
  if (q.includes("invite") || q.includes("teammate") || q.includes("team")) {
    return {
      conf: 0.96,
      text: "Welcome aboard! You can invite teammates from Settings → Team → Invite member. Enter their emails, pick a role (Admin, Agent, or Viewer), and they’ll receive invite links valid for 7 days.",
      cites: ["Getting started → Inviting your team"],
    };
  }
  if (q.includes("sso") || q.includes("saml") || q.includes("okta")) {
    const ssoIndexed = kb.some(
      (d) => d.name.toLowerCase().includes("sso") && d.status === "indexed",
    );
    if (!ssoIndexed) {
      return { conf: null, text: "", cites: [] };
    }
    return {
      conf: 0.91,
      text: "You can configure SAML SSO from Settings → Workspace → Authentication. Use the metadata URL https://app.proofline.com/saml/acme/metadata and map email → NameID; the guide covers Okta attribute mapping step by step.",
      cites: ["SSO configuration guide → Okta setup"],
    };
  }
  if (q.includes("slack")) {
    return {
      conf: 0.58,
      text: "Thanks for the details — since other channels still work, the likeliest cause is that the Slack app lost membership of that specific channel. Try /invite @Proofline in the affected channel; if alerts don’t resume, we’ll escalate to integrations.",
      cites: ["Slack integration guide → Missing notifications"],
    };
  }
  return {
    conf: 0.74,
    text: "Thanks for reaching out! Based on your question, here’s what our docs recommend — and if this doesn’t resolve it, reply here and a teammate will take a closer look right away.",
    cites: ["Getting started.md", "Billing & Plans.md"],
  };
}

/** The mock singleton. Provider selection happens in ./index.ts. */
export const mockDraftProvider: DraftProvider = new MockDraftProvider();
