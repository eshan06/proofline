"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { api, ApiClientError } from "@/lib/api-client";

function ResetInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword({ token, password });
      router.push("/signin?reset=1");
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
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Choose a new password</h1>
          <p className="text-[13px] text-ink-4">Pick a strong password — at least 8 characters.</p>
        </div>

        {!token ? (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 px-4 py-3 text-[12.5px] text-ink-2">
            This link is missing its token. <Link href="/forgot" className="text-accent no-underline">Request a new one →</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-ink-4">New password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[13px] text-ink"
                placeholder="At least 8 characters"
              />
            </label>
            {error ? <span className="text-[11.5px] text-danger">{error}</span> : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-[8px] bg-accent py-[9px] text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page-landing" />}>
      <ResetInner />
    </Suspense>
  );
}
