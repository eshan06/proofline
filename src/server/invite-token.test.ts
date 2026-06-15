import { describe, it, expect, vi } from "vitest";
import { createInviteToken, verifyInviteToken } from "./invite-token";

describe("invite-token", () => {
  it("roundtrips a valid token", () => {
    const token = createInviteToken("ws_abc", "agent@acme.com", "Agent");
    const result = verifyInviteToken(token);
    expect(result).toEqual({ workspaceId: "ws_abc", email: "agent@acme.com", role: "Agent" });
  });

  it("returns null for a tampered token", () => {
    const token = createInviteToken("ws_abc", "agent@acme.com", "Agent");
    // flip one character in the base64 payload
    const tampered = token.slice(0, -3) + "xxx";
    expect(verifyInviteToken(tampered)).toBeNull();
  });

  it("returns null for an expired token", () => {
    // Forge a token whose expiresAt is already in the past.
    vi.useFakeTimers();
    const token = createInviteToken("ws_abc", "agent@acme.com", "Agent");
    // Advance time past the 7-day TTL.
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    expect(verifyInviteToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("returns null for an empty or garbage string", () => {
    expect(verifyInviteToken("")).toBeNull();
    expect(verifyInviteToken("not-a-token")).toBeNull();
    expect(verifyInviteToken("e30K")).toBeNull(); // base64 of '{}'
  });

  it("handles email addresses with + and . in the local part", () => {
    const token = createInviteToken("ws_xyz", "user+tag@company.io", "Admin");
    const result = verifyInviteToken(token);
    expect(result?.email).toBe("user+tag@company.io");
  });
});
