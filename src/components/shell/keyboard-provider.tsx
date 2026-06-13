"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUiStore } from "@/stores/ui";
import { useInboxStore } from "@/stores/inbox";
import { api } from "@/lib/api-client";

/**
 * Global keyboard handler owned by the app shell.
 *
 * ⌘K toggles the palette (and counts toward the demo checklist) · Esc closes
 * overlays · J/K walk the *filtered* inbox list via router pushes so the URL
 * stays the source of truth. Suppressed while typing in inputs, except ⌘K which
 * is always available. (⌘↵ to send is owned by the composer itself.)
 */
export function KeyboardProvider({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { togglePalette, paletteOpen, closeOverlays } = useUiStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isDemo) void api.completeDemoStep("palette").catch(() => {});
        togglePalette();
        return;
      }

      if (e.key === "Escape") {
        closeOverlays();
        return;
      }

      // While the palette is open it owns arrow/enter (handled in its own effect).
      if (paletteOpen || typing) return;

      const onInbox = pathname.startsWith("/inbox");
      if (onInbox && (e.key === "j" || e.key === "k")) {
        const { orderedIds } = useInboxStore.getState();
        const currentId = pathname.split("/")[2];
        const i = currentId ? orderedIds.indexOf(currentId) : -1;
        const next =
          e.key === "j"
            ? Math.min(orderedIds.length - 1, i + 1)
            : Math.max(0, i - 1);
        const nextId = orderedIds[next];
        if (nextId && nextId !== currentId) {
          e.preventDefault();
          const qs = typeof window !== "undefined" ? window.location.search : "";
          router.push(`/inbox/${nextId}${qs}`);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname, togglePalette, paletteOpen, closeOverlays, isDemo]);

  return null;
}
