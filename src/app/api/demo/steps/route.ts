import { z } from "zod";
import { demoStepSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession, trackEvent } from "@/server/api";
import { completeDemoStep } from "@/server/store";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, z.object({ step: demoStepSchema }));
    if (completeDemoStep(session, body.step)) {
      trackEvent(session, "demo_step_completed", { step: body.step });
    }
    return { steps: session.demoSteps };
  });
}
