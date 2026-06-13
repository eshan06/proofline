"use client";

import { api } from "@/lib/api-client";
import { useWorkspaceMutation } from "@/hooks/use-workspace";
import type { CopilotSettings } from "@/lib/schemas";

/** Patch copilot settings, optimistic against the workspace cache. */
export function usePatchCopilot() {
  return useWorkspaceMutation<{ patch: Partial<CopilotSettings>; toast?: string }>({
    mutationFn: ({ patch }) => api.patchCopilot(patch),
    optimistic: (ws, { patch }) => ({ ...ws, copilot: { ...ws.copilot, ...patch } }),
    onSuccessToast: ({ toast }) => toast ?? null,
  });
}
