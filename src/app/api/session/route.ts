import { z } from "zod";
import { handleApi, parseBody } from "@/server/api";
import { endSession, startSession } from "@/server/session";

const signinSchema = z.object({ email: z.string().email() });

/** Regular sign-in — fully separate from the demo sandbox. */
export async function POST(req: Request) {
  return handleApi(async () => {
    await parseBody(req, signinSchema);
    const session = await startSession("regular");
    return { ok: true, type: session.type };
  });
}

export async function DELETE() {
  return handleApi(async () => {
    await endSession();
    return { ok: true };
  });
}
