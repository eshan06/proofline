"use client";

import {
  workspaceSchema,
  playgroundResultSchema,
  type DraftAction,
  type PlaygroundResult,
  type TicketPatch,
  type Workspace,
} from "@/lib/schemas";

/** Thrown for non-2xx responses; carries the server's message + status. */
export class ApiClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new ApiClientError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  workspace: async (): Promise<Workspace> =>
    workspaceSchema.parse(await request("/api/workspace")),

  patchTicket: (id: string, patch: TicketPatch) =>
    request(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  postMessage: (id: string, body: { kind: "reply" | "note"; text: string; viaAI?: boolean }) =>
    request(`/api/tickets/${id}/messages`, { method: "POST", body: JSON.stringify(body) }),

  draftAction: (id: string, action: DraftAction) =>
    request(`/api/tickets/${id}/draft`, { method: "POST", body: JSON.stringify(action) }),

  uploadKbDoc: () => request("/api/kb/upload", { method: "POST" }),

  retryKbDoc: (id: string) => request(`/api/kb/${id}/retry`, { method: "POST" }),

  createAutomation: (body: { trigger: string; conds: string[]; acts: string[] }) =>
    request("/api/automations", { method: "POST", body: JSON.stringify(body) }),

  patchAutomation: (id: string, enabled: boolean) =>
    request(`/api/automations/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),

  patchIntegration: (key: string, connected: boolean) =>
    request(`/api/integrations/${key}`, { method: "PATCH", body: JSON.stringify({ connected }) }),

  inviteMember: (body: { email: string; role: "Admin" | "Agent" | "Viewer" }) =>
    request("/api/members", { method: "POST", body: JSON.stringify(body) }),

  playground: async (question: string): Promise<PlaygroundResult> =>
    playgroundResultSchema.parse(
      await request("/api/playground", { method: "POST", body: JSON.stringify({ question }) }),
    ),

  patchCopilot: (patch: Record<string, unknown>) =>
    request("/api/copilot", { method: "PATCH", body: JSON.stringify(patch) }),

  completeDemoStep: (step: string) =>
    request("/api/demo/steps", { method: "POST", body: JSON.stringify({ step }) }),

  trackEvent: (name: string, props?: Record<string, unknown>) =>
    request("/api/events", { method: "POST", body: JSON.stringify({ name, props }) }),

  signIn: (email: string) =>
    request("/api/session", { method: "POST", body: JSON.stringify({ email }) }),
};
