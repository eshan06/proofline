import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-page px-6 text-center">
      <Logo size={34} radius={9} />
      <div className="flex flex-col items-center gap-2.5">
        <div className="font-mono text-[34px] font-semibold tracking-[-0.02em] text-ink">404</div>
        <h1 className="text-[15px] font-semibold text-ink">Page not found</h1>
        <p className="max-w-[400px] text-[12.5px] leading-[1.6] text-ink-4">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <div className="flex gap-2.5">
        <Link
          href="/inbox"
          className="rounded-[7px] bg-accent px-4 py-2 text-[12.5px] font-semibold text-white no-underline hover:bg-accent-hover"
          style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
        >
          Go to inbox
        </Link>
        <Link
          href="/"
          className="rounded-[7px] border border-white/10 bg-white/5 px-4 py-2 text-[12.5px] font-medium text-ink-2 no-underline hover:bg-white/9"
        >
          Marketing site
        </Link>
      </div>
    </div>
  );
}
