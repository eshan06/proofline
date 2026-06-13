"use client";

import { useEffect } from "react";

/**
 * Sets the document body background for the landing route. The app body uses
 * the app page token (#0A0D14); the landing uses #07090F (per the prototype's
 * separate document). Restores on unmount so navigating into the app reverts.
 * Matters for overscroll color, not just the covered viewport.
 */
export function BodyBackground({ color }: { color: string }) {
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = color;
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, [color]);
  return null;
}
