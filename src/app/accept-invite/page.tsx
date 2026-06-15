"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Accept-invite page. Reached via the link in the invite email:
 *   /accept-invite?token=<hmac-signed-token>
 *
 * The invitee fills in their name + password to create their account and
 * activate the membership in one step. Already-logged-in users can also land
 * here and accept with just the token (no password required).
 */
function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.acceptInvite({ token, name: name.trim() || undefined, password: password || undefined });
      setDone(true);
      // Small delay so the success message is visible before redirect.
      setTimeout(() => router.push("/home"), 1200);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-landing px-6">
        <div className="flex w-full max-w-[380px] flex-col gap-6">
          <Link href="/" className="flex items-center gap-[9px] no-underline">
            <Logo size={28} />
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Proofline</span>
          </Link>
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 px-4 py-3 text-[12.5px] text-ink-2">
            This invite link is missing its token.{" "}
            <Link href="/signin" className="text-accent no-underline">
              Sign in instead →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-landing px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <Link href="/" className="flex items-center gap-[9px] no-underline">
          <Logo size={28} />
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Proofline</span>
        </Link>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Accept your invite</h1>
          <p className="text-[13px] text-ink-4">Set a name and password to activate your account.</p>
        </div>

        {done ? (
          <div className="rounded-[8px] border border-accent/30 bg-accent/10 px-4 py-3 text-[12.5px] text-ink-2">
            You&apos;re in. Redirecting to your workspace…
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-ink-4">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[13px] text-ink"
                placeholder="Jane Doe"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-ink-4">Password</span>
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
              {busy ? "Activating…" : "Accept invite"}
            </button>
          </form>
        )}

        <div className="text-[12px] text-ink-4">
          Already have an account?{" "}
          <Link href={`/signin?next=/accept-invite?token=${encodeURIComponent(token)}`} className="text-accent no-underline hover:text-accent-hover">
            Sign in first →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page-landing" />}>
      <AcceptInviteInner />
    </Suspense>
  );
}
