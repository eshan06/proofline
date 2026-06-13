"use client";

import { create } from "zustand";

/**
 * Inbox UI state that shouldn't live in the URL:
 * - the filtered ticket order, registered by the list so global J/K
 *   navigation walks exactly what the user sees;
 * - composer text per ticket;
 * - per-ticket draft mode (idle / edit / regen / accepted).
 */

export type DraftMode = "idle" | "edit" | "regen" | "accepted";

interface InboxStore {
  orderedIds: string[];
  setOrderedIds: (ids: string[]) => void;
  composers: Record<string, string>;
  setComposer: (ticketId: string, text: string) => void;
  draftModes: Record<string, DraftMode>;
  setDraftMode: (ticketId: string, mode: DraftMode) => void;
}

export const useInboxStore = create<InboxStore>((set) => ({
  orderedIds: [],
  setOrderedIds: (orderedIds) =>
    set((s) =>
      s.orderedIds.length === orderedIds.length &&
      s.orderedIds.every((id, i) => id === orderedIds[i])
        ? s
        : { orderedIds },
    ),
  composers: {},
  setComposer: (ticketId, text) =>
    set((s) => ({ composers: { ...s.composers, [ticketId]: text } })),
  draftModes: {},
  setDraftMode: (ticketId, mode) =>
    set((s) => ({ draftModes: { ...s.draftModes, [ticketId]: mode } })),
}));
