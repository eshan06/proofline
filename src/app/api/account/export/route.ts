import { NextResponse } from "next/server";
import { currentSession } from "@/server/session";
import { repo } from "@/server/repository";

/**
 * GDPR / data-portability export: the full workspace payload + the requesting
 * account, as a downloadable JSON file. Admin-only for real (signed-in) sessions.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const r = repo();
  if (session.userId) {
    const role = await r.membershipRole(session.userId, session.workspaceId);
    if (role !== "Admin") return NextResponse.json({ error: "Admin access required to export." }, { status: 403 });
  }
  const [ws, user] = await Promise.all([
    r.getWorkspace(session.workspaceId),
    session.userId ? r.getUser(session.userId) : Promise.resolve(null),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    account: user ? { name: user.name, email: user.email } : null,
    workspace: ws,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="proofline-export.json"`,
      "cache-control": "no-store",
    },
  });
}
