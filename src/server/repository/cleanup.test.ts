import { vi, describe, it, expect, afterEach } from "vitest";
import { repo } from "@/server/repository";

/**
 * Demo workspaces are created (and their seed KB embedded) on every /demo visit
 * and were never reaped — an unbounded DB/cost leak. cleanupExpired() purges
 * expired sessions and abandoned demo workspaces. These tests pin that it reaps
 * an expired demo workspace but never touches a live one or a real (membership)
 * workspace.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("cleanupExpired", () => {
  it("does not reap a demo workspace while its session is still live", async () => {
    const r = repo();
    const t0 = new Date("2026-06-16T00:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(t0);

    const workspaceId = await r.createDemoWorkspace();
    const session = await r.createSession({ type: "demo", workspaceId });

    const res = await r.cleanupExpired();
    expect(res.demoWorkspacesDeleted).toBe(0);
    expect(await r.getSession(session.id)).not.toBeNull();
  });

  it("reaps an abandoned demo workspace once its session has expired", async () => {
    const r = repo();
    const t0 = new Date("2026-06-16T01:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(t0);

    const workspaceId = await r.createDemoWorkspace();
    const session = await r.createSession({ type: "demo", workspaceId });

    // Past the 30-minute demo TTL. (In an isolated store this is the only demo
    // workspace + session, so the counts pin that both were removed. getSession
    // can't assert deletion — it transparently reseeds a missing demo_ id.)
    void session;
    vi.setSystemTime(t0 + 31 * 60 * 1000);
    const res = await r.cleanupExpired();

    expect(res.sessionsDeleted).toBeGreaterThanOrEqual(1);
    expect(res.demoWorkspacesDeleted).toBeGreaterThanOrEqual(1);
  });

  it("never reaps a real workspace that has a membership", async () => {
    const r = repo();
    const t0 = new Date("2026-06-16T02:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(t0);

    const created = await r.createUserWithWorkspace({
      email: `owner_${t0}@example.com`,
      name: "Olive Owner",
      passwordHash: "x",
    });

    // Far past any TTL, with no live session at all.
    vi.setSystemTime(t0 + 30 * 24 * 60 * 60 * 1000);
    await r.cleanupExpired();

    // The real workspace (and its membership) survive: role still resolves.
    expect(await r.membershipRole(created.user.id, created.workspaceId)).toBe("Admin");
  });
});
