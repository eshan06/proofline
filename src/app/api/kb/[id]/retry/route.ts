import { ApiError, handleApi, requireSession } from "@/server/api";

/**
 * Retrying the failed SSO guide always fails again — the document genuinely
 * exceeds the size limit. This is the cross-page story thread (inbox TKT-1024
 * error state + KB warning + playground refusal), so it must stay broken.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    await requireSession();
    await ctx.params;
    throw new ApiError(
      422,
      "Re-indexing “SSO configuration guide.pdf” — still exceeds the 50 MB limit",
    );
  });
}
