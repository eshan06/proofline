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

  // No file → canned demo doc (preserves the guided demo). A File → real
  // multipart upload + ingestion. FormData sets its own content-type boundary,
  // so we call fetch directly rather than the JSON `request` helper.
  uploadKbDoc: async (file?: File) => {
    if (!file) return request("/api/kb/upload", { method: "POST" });
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/kb/upload", { method: "POST", body: fd });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiClientError(res.status, body.error ?? `Upload failed (${res.status})`);
    return body;
  },

  retryKbDoc: (id: string) => request(`/api/kb/${id}/retry`, { method: "POST" }),

  createAutomation: (body: { trigger: string; conds: string[]; acts: string[] }) =>
    request("/api/automations", { method: "POST", body: JSON.stringify(body) }),

  patchAutomation: (id: string, enabled: boolean) =>
    request(`/api/automations/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),

  patchIntegration: (key: string, connected: boolean) =>
    request(`/api/integrations/${key}`, { method: "PATCH", body: JSON.stringify({ connected }) }),

  inviteMember: (body: { email: string; role: "Admin" | "Agent" | "Viewer" }) =>
    request("/api/members", { method: "POST", body: JSON.stringify(body) }),

  patchMemberRole: (userId: string, role: "Admin" | "Agent" | "Viewer") =>
    request(`/api/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),

  removeMember: (userId: string) =>
    request(`/api/members/${userId}`, { method: "DELETE" }),

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

  signUp: (body: { name: string; email: string; password: string }) =>
    request("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  logIn: (body: { email: string; password: string }) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logOut: () => request("/api/auth/logout", { method: "POST" }),

  forgotPassword: (email: string) =>
    request("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (body: { token: string; password: string }) =>
    request("/api/auth/reset", { method: "POST", body: JSON.stringify(body) }),

  acceptInvite: (body: { token: string; name?: string; password?: string }) =>
    request("/api/auth/accept-invite", { method: "POST", body: JSON.stringify(body) }),

  deleteAccount: () => request("/api/account/delete", { method: "POST" }),

  renameWorkspace: (name: string) =>
    request("/api/workspace", { method: "PATCH", body: JSON.stringify({ name }) }),

  checkout: (plan: "growth" | "scale") =>
    request<{ url: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) }),

  billingPortal: () =>
    request<{ url?: string; error?: string; message?: string }>("/api/billing/portal", { method: "POST" }),

  patchWidgetConfig: (patch: { allowedOrigins?: string[]; enabled?: boolean }) =>
    request("/api/workspace/widget", { method: "PATCH", body: JSON.stringify(patch) }),

  resendVerification: () => request("/api/auth/resend-verify", { method: "POST" }),
};
