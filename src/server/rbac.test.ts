import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireRole } from "@/server/api";
import { repo, type SessionInfo } from "@/server/repository";

/**
 * The product advertises a role-permission matrix in Settings (PERM_ROWS). This
 * test pins the server-side enforcement to that matrix so a future route can't
 * silently ship without the right gate.
 */

function session(userId: string | null, workspaceId: string): SessionInfo {
  return {
    id: "s_test",
    type: userId ? "regular" : "demo",
    userId,
    workspaceId,
    aiCalls: 0,
    demoSteps: {} as SessionInfo["demoSteps"],
  };
}

describe("requireRole — advertised permission matrix", () => {
  let workspaceId: string;
  let admin: SessionInfo;
  let agent: SessionInfo;
  let viewer: SessionInfo;
  let nonMember: SessionInfo;

  beforeAll(async () => {
    const r = repo();
    const stamp = Date.now();
    const created = await r.createUserWithWorkspace({
      email: `admin_${stamp}@example.com`,
      name: "Ada Admin",
      passwordHash: "x",
    });
    workspaceId = created.workspaceId;
    admin = session(created.user.id, workspaceId);

    const a = await r.acceptInvite({ workspaceId, email: `agent_${stamp}@example.com`, role: "Agent" });
    agent = session(a.userId, workspaceId);

    const v = await r.acceptInvite({ workspaceId, email: `viewer_${stamp}@example.com`, role: "Viewer" });
    viewer = session(v.userId, workspaceId);

    // A signed-in user who is not a member of this workspace at all.
    nonMember = session("u_outsider", workspaceId);
  });

  it("Admin passes both Admin+Agent and Admin-only gates", async () => {
    await expect(requireRole(admin, ["Admin", "Agent"])).resolves.toBeUndefined();
    await expect(requireRole(admin, ["Admin"])).resolves.toBeUndefined();
  });

  it("Agent passes Admin+Agent gates but is rejected by Admin-only gates", async () => {
    await expect(requireRole(agent, ["Admin", "Agent"])).resolves.toBeUndefined();
    await expect(requireRole(agent, ["Admin"])).rejects.toMatchObject({ status: 403 });
  });

  it("Viewer (read-only) is rejected by every write gate", async () => {
    await expect(requireRole(viewer, ["Admin", "Agent"])).rejects.toMatchObject({ status: 403 });
    await expect(requireRole(viewer, ["Admin"])).rejects.toMatchObject({ status: 403 });
  });

  it("a non-member with a session is rejected", async () => {
    await expect(requireRole(nonMember, ["Admin", "Agent"])).rejects.toMatchObject({ status: 403 });
  });

  it("demo / anonymous sessions (no userId) are unrestricted in their sandbox", async () => {
    const demo = session(null, workspaceId);
    await expect(requireRole(demo, ["Admin"])).resolves.toBeUndefined();
    await expect(requireRole(demo, ["Admin", "Agent"])).resolves.toBeUndefined();
  });

  it("an existing user who accepts an invite gets a working membership (regression)", async () => {
    // Before the fix, acceptInvite only created a membership for brand-new
    // users, so an existing account accepting an invite had no membership — and
    // the new RBAC gates would 403 them despite the UI showing them Active.
    const r = repo();
    const email = `existing_${Date.now()}@example.com`;
    await r.createUserWithWorkspace({ email, name: "Eve Existing", passwordHash: "x" });
    const accepted = await r.acceptInvite({ workspaceId, email, role: "Agent" });
    const sess = session(accepted.userId, workspaceId);
    await expect(requireRole(sess, ["Admin", "Agent"])).resolves.toBeUndefined();
    await expect(requireRole(sess, ["Admin"])).rejects.toMatchObject({ status: 403 });
  });
});

/**
 * Static policy manifest: every mutating route that the permission matrix
 * governs must carry the matching requireRole gate. Reading the source (rather
 * than invoking the handler) keeps this fast and makes a removed/mis-scoped gate
 * fail loudly in CI.
 */
describe("route policy manifest", () => {
  const ADMIN_AGENT = `requireRole(session, ["Admin", "Agent"])`;
  const ADMIN_ONLY = `requireRole(session, ["Admin"])`;

  const ROUTE_POLICY: Record<string, string> = {
    // View & reply to tickets / Approve AI drafts → Admin, Agent
    "src/app/api/tickets/[id]/messages/route.ts": ADMIN_AGENT,
    "src/app/api/tickets/[id]/route.ts": ADMIN_AGENT,
    "src/app/api/tickets/[id]/draft/route.ts": ADMIN_AGENT,
    "src/app/api/playground/route.ts": ADMIN_AGENT,
    "src/app/api/customers/[id]/notes/route.ts": ADMIN_AGENT,
    // Edit knowledge base → Admin, Agent
    "src/app/api/kb/upload/route.ts": ADMIN_AGENT,
    "src/app/api/kb/[id]/retry/route.ts": ADMIN_AGENT,
    "src/app/api/kb/[id]/route.ts": ADMIN_AGENT,
    // Manage automations / Billing & members → Admin only
    "src/app/api/automations/route.ts": ADMIN_ONLY,
    "src/app/api/automations/[id]/route.ts": ADMIN_ONLY,
    "src/app/api/billing/checkout/route.ts": ADMIN_ONLY,
    "src/app/api/billing/portal/route.ts": ADMIN_ONLY,
    "src/app/api/members/route.ts": ADMIN_ONLY,
    "src/app/api/members/[userId]/route.ts": ADMIN_ONLY,
  };

  for (const [file, expected] of Object.entries(ROUTE_POLICY)) {
    it(`${file} enforces ${expected}`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src).toContain(expected);
    });
  }
});
