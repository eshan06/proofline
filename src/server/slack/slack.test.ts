import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { slack, resetSlackProvider, verifySlackSignature, SLACK_SCOPES } from "@/server/slack/slack";

function sign(secret: string, ts: string, body: string): string {
  return "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
}

describe("verifySlackSignature", () => {
  const secret = "shhh-signing-secret";
  const body = JSON.stringify({ type: "event_callback", event: { type: "message", text: "hi" } });
  const now = 1_700_000_000;
  const ts = String(now);

  it("accepts a correctly-signed, fresh request", () => {
    expect(verifySlackSignature(secret, body, ts, sign(secret, ts, body), now)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(verifySlackSignature(secret, body, ts, sign("wrong-secret", ts, body), now)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const sig = sign(secret, ts, body);
    expect(verifySlackSignature(secret, body + "x", ts, sig, now)).toBe(false);
  });

  it("rejects a stale timestamp (replay window)", () => {
    const old = String(now - 6 * 60);
    expect(verifySlackSignature(secret, body, old, sign(secret, old, body), now)).toBe(false);
  });

  it("rejects missing inputs", () => {
    expect(verifySlackSignature(secret, body, null, sign(secret, ts, body), now)).toBe(false);
    expect(verifySlackSignature(secret, body, ts, null, now)).toBe(false);
    expect(verifySlackSignature("", body, ts, sign(secret, ts, body), now)).toBe(false);
  });
});

describe("slack() provider selection", () => {
  const saved = {
    sign: process.env.SLACK_SIGNING_SECRET,
    id: process.env.SLACK_CLIENT_ID,
    secret: process.env.SLACK_CLIENT_SECRET,
  };
  beforeEach(() => resetSlackProvider());
  afterEach(() => {
    process.env.SLACK_SIGNING_SECRET = saved.sign;
    process.env.SLACK_CLIENT_ID = saved.id;
    process.env.SLACK_CLIENT_SECRET = saved.secret;
    resetSlackProvider();
  });

  it("is disabled with no credentials (channel dormant, app still runs)", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
    resetSlackProvider();
    const s = slack();
    expect(s.enabled).toBe(false);
    expect(s.canInstall).toBe(false);
    expect(s.verifyRequest("{}", "1", "v0=x")).toBe(false);
    expect(() => s.getInstallUrl("st", "https://app/cb")).toThrow();
  });

  it("is enabled for events with just a signing secret", () => {
    process.env.SLACK_SIGNING_SECRET = "sec";
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
    resetSlackProvider();
    const s = slack();
    expect(s.enabled).toBe(true);
    expect(s.canInstall).toBe(false); // install needs OAuth client creds
  });

  it("can build an install URL when OAuth client creds are set", () => {
    process.env.SLACK_SIGNING_SECRET = "sec";
    process.env.SLACK_CLIENT_ID = "cid-123";
    process.env.SLACK_CLIENT_SECRET = "csecret";
    resetSlackProvider();
    const s = slack();
    expect(s.canInstall).toBe(true);
    const url = s.getInstallUrl("state-abc", "https://app.example.com/api/integrations/slack/callback");
    expect(url).toContain("client_id=cid-123");
    expect(url).toContain("state=state-abc");
    expect(decodeURIComponent(url)).toContain(SLACK_SCOPES.join(","));
    expect(decodeURIComponent(url)).toContain("https://app.example.com/api/integrations/slack/callback");
  });
});
