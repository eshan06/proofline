import { z } from "zod";
import { demoStepSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession, trackEvent } from "@/server/api";
import { repo } from "@/server/repository";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, z.object({ step: demoStepSchema }));
    if (await repo().completeDemoStep(session.id, body.step)) {
      trackEvent(session, "demo_step_completed", { step: body.step });
    }
    const updated = await repo().getSession(session.id);
    return { steps: updated?.demoSteps ?? session.demoSteps };
  });
}
