"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  msg: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (msg: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const TOAST_MS = 2600;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (msg) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, msg }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Every mock action confirms via toast — the design's global feedback rule. */
export function toast(msg: string) {
  useToastStore.getState().push(msg);
}
