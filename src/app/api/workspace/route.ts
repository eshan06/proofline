import { handleApi, requireSession } from "@/server/api";
import { repo } from "@/server/repository";

export async function GET() {
  return handleApi(async () => {
    const session = await requireSession();
    const ws = await repo().getWorkspace(session.workspaceId);
    return { ...ws, demo: { active: session.type === "demo", steps: session.demoSteps } };
  });
}
