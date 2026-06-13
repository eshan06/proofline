"use client";

import { api } from "@/lib/api-client";
import { useWorkspaceMutation } from "@/hooks/use-workspace";

export function useToggleAutomation() {
  return useWorkspaceMutation<{ id: string; name: string; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => api.patchAutomation(id, enabled),
    optimistic: (ws, { id, enabled }) => ({
      ...ws,
      automations: ws.automations.map((a) => (a.id === id ? { ...a, enabled } : a)),
    }),
    onSuccessToast: ({ name, enabled }) => `“${name}” ${enabled ? "activated" : "paused"}`,
  });
}

export function useCreateAutomation() {
  return useWorkspaceMutation<{ trigger: string; conds: string[]; acts: string[] }>({
    mutationFn: (rule) => api.createAutomation(rule),
    onSuccessToast: () => "Automation created and activated",
  });
}
