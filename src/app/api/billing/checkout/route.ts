import { z } from "zod";
import { handleApi, parseBody, requireSession } from "@/server/api";
import { billing } from "@/server/billing";

const checkoutSchema = z.object({ plan: z.enum(["growth", "scale"]).default("scale") });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, checkoutSchema);
    const { url } = await billing().createCheckoutSession({
      workspaceId: session.workspaceId,
      plan: body.plan ?? "scale",
      seats: 3,
      successUrl: `${APP_URL}/settings/billing`,
      cancelUrl: `${APP_URL}/settings/billing`,
    });
    return { url };
  });
}
