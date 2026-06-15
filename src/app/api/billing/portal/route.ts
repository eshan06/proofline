import { handleApi, requireRole, requireSession } from "@/server/api";
import { billing } from "@/server/billing";
import { repo } from "@/server/repository";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST() {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);

    const sub = await repo().getSubscription(session.workspaceId);
    if (!sub.stripeCustomerId) {
      return { error: "no_customer", message: "No billing account found. Complete a checkout first." };
    }

    const { url } = await billing().portal({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: `${APP_URL}/settings/billing`,
    });
    return { url };
  });
}
