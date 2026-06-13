"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Minimal real sign-in — deliberately separate from the demo sandbox. Creates
 * a regular workspace session and lands on the home dashboard.
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("eshan@acme.io");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(email);
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not sign in");
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
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Welcome back</h1>
          <p className="text-[13px] text-ink-4">Sign in to your Acme Inc workspace.</p>
        </div>

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
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="flex items-center gap-2 text-[12px] text-muted">
          <span>Just exploring?</span>
          <Link href="/demo" className="font-medium text-accent no-underline hover:text-accent-hover">
            Try the demo →
          </Link>
        </div>
      </div>
    </div>
  );
}
