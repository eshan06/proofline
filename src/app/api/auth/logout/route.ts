import { handleApi } from "@/server/api";
import { endSession } from "@/server/session";

export async function POST() {
  return handleApi(async () => {
    await endSession();
    return { ok: true };
  });
}
