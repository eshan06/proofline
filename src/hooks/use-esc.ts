"use client";

import { useEffect } from "react";

/** Close an overlay on Escape. Spec: all overlays close on Esc + backdrop click. */
export function useEscToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
