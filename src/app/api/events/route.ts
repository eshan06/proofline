import { eventSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession, trackEvent } from "@/server/api";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, eventSchema);
    trackEvent(session, body.name, body.props);
    return { ok: true };
  });
}
