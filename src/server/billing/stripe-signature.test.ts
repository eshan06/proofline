import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyStripeSignature } from "./index";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { client_reference_id: "ws_1" } } });

function sign(body: string, key: string, t = Math.floor(Date.now() / 1000)): string {
  const v1 = crypto.createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed, fresh payload", () => {
    const event = verifyStripeSignature(payload, sign(payload, secret), secret);
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a tampered payload", () => {
    const sig = sign(payload, secret);
    expect(() => verifyStripeSignature(payload + " ", sig, secret)).toThrow();
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(() => verifyStripeSignature(payload, sign(payload, secret), "whsec_wrong")).toThrow();
  });

  it("rejects a missing or malformed header", () => {
    expect(() => verifyStripeSignature(payload, null, secret)).toThrow();
    expect(() => verifyStripeSignature(payload, "garbage", secret)).toThrow();
  });

  it("rejects a stale timestamp (replay protection)", () => {
    const stale = Math.floor(Date.now() / 1000) - 10_000;
    expect(() => verifyStripeSignature(payload, sign(payload, secret, stale), secret)).toThrow();
  });

  it("accepts any matching v1 during a secret rotation (multiple v1 entries)", () => {
    // While rotating the webhook secret Stripe signs with both secrets and sends
    // two v1 entries; verification must accept if ANY matches — including when
    // the matching one comes first.
    const t = Math.floor(Date.now() / 1000);
    const good = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    const other = crypto.createHmac("sha256", "whsec_old_secret").update(`${t}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${t},v1=${good},v1=${other}`, secret).type).toBe("checkout.session.completed");
    expect(verifyStripeSignature(payload, `t=${t},v1=${other},v1=${good}`, secret).type).toBe("checkout.session.completed");
  });
});
