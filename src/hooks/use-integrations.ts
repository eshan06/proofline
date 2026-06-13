"use client";

import { api } from "@/lib/api-client";
import { useWorkspaceMutation } from "@/hooks/use-workspace";
import type { IntegrationKey } from "@/lib/schemas";

export function useToggleIntegration() {
  return useWorkspaceMutation<{ key: IntegrationKey; name: string; connected: boolean }>({
    mutationFn: ({ key, connected }) => api.patchIntegration(key, connected),
    optimistic: (ws, { key, connected }) => ({
      ...ws,
      integrations: ws.integrations.map((i) => (i.key === key ? { ...i, connected } : i)),
    }),
    onSuccessToast: ({ name, connected }) => `${name} ${connected ? "connected" : "disconnected"}`,
  });
}
