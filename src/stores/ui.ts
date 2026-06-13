"use client";

import { create } from "zustand";

interface UiStore {
  paletteOpen: boolean;
  notifOpen: boolean;
  demoPanelOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setNotifOpen: (open: boolean) => void;
  toggleNotif: () => void;
  toggleDemoPanel: () => void;
  closeOverlays: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  paletteOpen: false,
  notifOpen: false,
  demoPanelOpen: true,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen, notifOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen, notifOpen: false })),
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen })),
  toggleDemoPanel: () => set((s) => ({ demoPanelOpen: !s.demoPanelOpen })),
  closeOverlays: () => set({ paletteOpen: false, notifOpen: false }),
}));
