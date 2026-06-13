"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shell/error-state";

/** Root error boundary — catches anything not caught by a nested boundary. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Seam for a real error reporter (Sentry, etc.).
    console.error("[proofline:error]", error.digest, error.message);
  }, [error]);

  return <ErrorState reset={reset} />;
}
