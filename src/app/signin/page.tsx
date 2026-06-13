"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Real email + password auth, separate from the demo sandbox. Toggles between
 * sign-in and create-account; on success it lands on the requested page (or the
 * home dashboard). With a database this is the only way into the app.
 */
function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await api.signUp({ name, email, password });
      } else {
        await api.logIn({ email, password });
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
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
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">
            {mode === "login" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="text-[13px] text-ink-4">
            {mode === "login" ? "Sign in to your Proofline workspace." : "Start with a fully-loaded workspace to explore."}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "signup" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-ink-4">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[13px] text-ink"
                placeholder="Jane Doe"
              />
            </label>
          ) : null}
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
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-ink-4">Password</span>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[13px] text-ink"
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            />
          </label>
          {error ? <span className="text-[11.5px] text-danger">{error}</span> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-[8px] bg-accent py-[9px] text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="flex items-center justify-between text-[12px] text-muted">
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
            className="border-0 bg-transparent text-ink-4 hover:text-ink"
          >
            {mode === "login" ? "Create an account" : "I already have an account"}
          </button>
          <Link href="/demo" className="font-medium text-accent no-underline hover:text-accent-hover">
            Try the demo →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page-landing" />}>
      <SignInInner />
    </Suspense>
  );
}
