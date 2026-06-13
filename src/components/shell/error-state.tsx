"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Logo } from "./logo";

/**
 * Shared dark-theme error surface for route error boundaries. Keeps the brand
 * present and gives the user a way out — never a white stack trace.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. The issue has been logged — try again, or head back to your inbox.",
  reset,
  backHref = "/inbox",
  backLabel = "Back to inbox",
}: {
  title?: string;
  message?: string;
  reset?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-page px-6 text-center">
      <Logo size={34} radius={9} />
      <div className="flex flex-col items-center gap-2.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-danger/25 bg-danger/10 text-danger">
          <AlertTriangle size={20} strokeWidth={1.4} />
        </div>
        <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        <p className="max-w-[420px] text-[12.5px] leading-[1.6] text-ink-4">{message}</p>
      </div>
      <div className="flex gap-2.5">
        {reset ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-[7px] bg-accent px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-accent-hover"
            style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
          >
            Try again
          </button>
        ) : null}
        <Link
          href={backHref}
          className="rounded-[7px] border border-white/10 bg-white/5 px-4 py-2 text-[12.5px] font-medium text-ink-2 no-underline hover:bg-white/9"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
