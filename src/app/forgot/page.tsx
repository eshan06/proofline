"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { api, ApiClientError } from "@/lib/api-client";

/** Request a password-reset link. Always reports success (no account enumeration). */
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-landing px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <Link href="/" className="flex items-center gap-[9px] no-underline">
          <Logo size={28} />
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Proofline</span>
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Reset your password</h1>
          <p className="text-[13px] text-ink-4">Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        {sent ? (
          <div className="rounded-[8px] border border-success/30 bg-success/10 px-4 py-3 text-[12.5px] text-ink-2">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and spam).
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-ink-4">Work email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[13px] text-ink"
                placeholder="you@company.com"
              />
            </label>
            {error ? <span className="text-[11.5px] text-danger">{error}</span> : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-[8px] bg-accent py-[9px] text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/signin" className="text-[12px] text-ink-4 no-underline hover:text-ink">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
