"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shell/error-state";

/** App-section error boundary — keeps a failing page from blanking the whole app. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[proofline:app-error]", error.digest, error.message);
  }, [error]);

  return (
    <ErrorState
      title="This page hit a snag"
      message="We couldn't load this view. Retry, or jump back to your inbox — your data is safe."
      reset={reset}
    />
  );
}
