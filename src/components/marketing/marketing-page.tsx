import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { BodyBackground } from "@/components/landing/body-background";

/** Shared chrome for static marketing/legal pages — nav + readable column + footer. */
export function MarketingPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen font-sans text-ink" style={{ background: "#07090F" }}>
      <BodyBackground color="#07090F" />
      <div className="sticky top-0 z-50 border-b border-white/6 backdrop-blur-[12px]" style={{ background: "rgba(7,9,15,0.72)" }}>
        <div className="mx-auto flex max-w-[820px] items-center gap-4 px-6 py-3.5">
          <Link href="/" className="flex items-center gap-[9px] no-underline">
            <Logo size={24} />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Proofline</span>
          </Link>
          <span className="flex-1" />
          <Link href="/signin" className="text-[13px] text-ink-4 no-underline hover:text-ink">Sign in</Link>
          <Link href="/signin" className="rounded-[7px] bg-accent px-3.5 py-[7px] text-[13px] font-semibold text-white no-underline hover:bg-accent-hover">Start free</Link>
        </div>
      </div>

      <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12 sm:pt-16">
        <h1 className="text-[clamp(28px,5vw,38px)] font-bold tracking-[-0.03em] text-ink">{title}</h1>
        {updated ? <p className="mt-2 font-mono text-[12px] text-muted">Last updated {updated}</p> : null}
        <div className="prose-proofline mt-8 flex flex-col gap-5 text-[14px] leading-[1.7] text-ink-3">{children}</div>
      </article>

      <footer className="border-t border-white/6">
        <div className="mx-auto flex max-w-[820px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-6 text-[12px] text-faint">
          <span>Proofline © 2026</span>
          <span className="flex-1" />
          <Link href="/privacy" className="no-underline hover:text-ink-4">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-ink-4">Terms</Link>
          <Link href="/security" className="no-underline hover:text-ink-4">Security</Link>
          <Link href="/status" className="no-underline hover:text-ink-4">Status</Link>
          <Link href="/docs" className="no-underline hover:text-ink-4">Docs</Link>
        </div>
      </footer>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em] text-ink">{children}</h2>;
}
