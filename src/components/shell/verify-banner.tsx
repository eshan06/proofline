"use client";

import { useState } from "react";

/** Dismissible banner shown when the signed-in user has not verified their email. */
export function VerifyBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (dismissed) return null;

  async function handleResend() {
    if (resendState === "sending" || resendState === "sent") return;
    setResendState("sending");
    try {
      const res = await fetch("/api/auth/resend-verify", { method: "POST" });
      setResendState(res.ok ? "sent" : "error");
    } catch {
      setResendState("error");
    }
  }

  return (
    <div className="flex h-8 shrink-0 items-center justify-center gap-2 bg-warning/12 px-4 text-[12px] text-warning">
      <span>
        Please verify your email — check your inbox at <strong>{email}</strong>.
      </span>
      {resendState === "sent" ? (
        <span className="text-warning/70">Email sent!</span>
      ) : (
        <button
          onClick={handleResend}
          disabled={resendState === "sending"}
          className="underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
        >
          {resendState === "sending" ? "Sending…" : resendState === "error" ? "Try again" : "Resend"}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-2 text-warning/60 hover:text-warning"
      >
        ✕
      </button>
    </div>
  );
}
