"use client";

import { api } from "@/lib/api-client";
import { useWorkspaceMutation, withTicket } from "@/hooks/use-workspace";
import { priorityOrder } from "@/lib/maps";
import type { AIDraft, Priority, Ticket, Tone } from "@/lib/schemas";

/** Cycle priority low→medium→high→urgent, optimistic + toast. */
export function useCyclePriority() {
  return useWorkspaceMutation<{ ticket: Ticket }>({
    mutationFn: ({ ticket }) => {
      const next = priorityOrder[(priorityOrder.indexOf(ticket.priority) + 1) % 4]!;
      return api.patchTicket(ticket.id, { priority: next });
    },
    optimistic: (ws, { ticket }) => {
      const next = priorityOrder[(priorityOrder.indexOf(ticket.priority) + 1) % 4]!;
      return withTicket(ws, ticket.id, (t) => ({ ...t, priority: next }));
    },
    onSuccessToast: ({ ticket }) => {
      const next = priorityOrder[(priorityOrder.indexOf(ticket.priority) + 1) % 4]!;
      return `Priority set to ${next}`;
    },
  });
}

export function useSetPriority() {
  return useWorkspaceMutation<{ id: string; priority: Priority }>({
    mutationFn: ({ id, priority }) => api.patchTicket(id, { priority }),
    optimistic: (ws, { id, priority }) => withTicket(ws, id, (t) => ({ ...t, priority })),
  });
}

export function useEscalateTicket() {
  return useWorkspaceMutation<{ id: string }>({
    mutationFn: ({ id }) => api.patchTicket(id, { status: "escalated" }),
    optimistic: (ws, { id }) =>
      withTicket(ws, id, (t) => ({
        ...t,
        status: "escalated",
        stage: "escalated",
        messages: [
          ...t.messages,
          { id: `tmp-${Date.now()}`, kind: "status", time: "just now", text: `Escalated to engineering by ${ws.currentUser?.name ?? "Eshan"} · just now` },
        ],
      })),
    onSuccessToast: () => "Escalated to engineering",
  });
}

export function useCloseTicket() {
  return useWorkspaceMutation<{ id: string }>({
    mutationFn: ({ id }) => api.patchTicket(id, { status: "closed" }),
    optimistic: (ws, { id }) =>
      withTicket(ws, id, (t) => ({
        ...t,
        status: "closed",
        stage: "resolved",
        messages: [
          ...t.messages,
          { id: `tmp-${Date.now()}`, kind: "status", time: "just now", text: `Ticket closed by ${ws.currentUser?.name ?? "Eshan"} · just now` },
        ],
      })),
    onSuccessToast: () => "Ticket closed",
  });
}

export function useSendReply() {
  return useWorkspaceMutation<{ id: string; text: string; viaAI: boolean; customerName: string }>({
    mutationFn: ({ id, text, viaAI }) => api.postMessage(id, { kind: "reply", text, viaAI }),
    optimistic: (ws, { id, text, viaAI }) =>
      withTicket(ws, id, (t) => ({
        ...t,
        status: "waiting",
        stage: "waiting",
        unread: false,
        messages: [
          ...t.messages,
          { id: `tmp-${Date.now()}`, kind: "agent", author: ws.currentUser?.name ?? "Eshan", time: "just now", text, viaAI },
        ],
      })),
    onSuccessToast: ({ customerName }) => `Reply sent to ${customerName}`,
  });
}

export function useAddNote() {
  return useWorkspaceMutation<{ id: string; text: string }>({
    mutationFn: ({ id, text }) => api.postMessage(id, { kind: "note", text }),
    optimistic: (ws, { id, text }) =>
      withTicket(ws, id, (t) => ({
        ...t,
        messages: [
          ...t.messages,
          { id: `tmp-${Date.now()}`, kind: "note", author: ws.currentUser?.name ?? "Eshan", time: "just now", text },
        ],
      })),
    onSuccessToast: () => "Internal note added",
  });
}

/** Regenerate / tone rewrite / inline edit. The draft text comes back from the server. */
export function useDraftAction() {
  return useWorkspaceMutation<
    | { id: string; action: "regenerate" }
    | { id: string; action: "tone"; tone: Tone }
    | { id: string; action: "edit"; text: string }
  >({
    mutationFn: (vars) => {
      if (vars.action === "tone") return api.draftAction(vars.id, { action: "tone", tone: vars.tone });
      if (vars.action === "edit") return api.draftAction(vars.id, { action: "edit", text: vars.text });
      return api.draftAction(vars.id, { action: "regenerate" });
    },
    optimistic: (ws, vars) => {
      if (vars.action !== "edit") return ws;
      return withTicket(ws, vars.id, (t) => ({
        ...t,
        draft: t.draft ? { ...t.draft, text: vars.text } : t.draft,
      }));
    },
    onSuccessToast: (vars) => {
      if (vars.action === "regenerate") return "Draft regenerated from 2 sources";
      if (vars.action === "tone") return vars.tone === "concise" ? "Rewrote draft — more concise" : "Rewrote draft — more empathetic";
      return "Draft updated";
    },
  });
}

/** Accept a draft into the composer — completes the demo "draft" step. */
export function useAcceptDraft(isDemo: boolean) {
  return (draft: AIDraft) => {
    if (isDemo) void api.completeDemoStep("draft").catch(() => {});
    return draft.text;
  };
}
