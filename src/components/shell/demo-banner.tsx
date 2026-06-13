"use client";

import Link from "next/link";
import type { DemoState } from "@/lib/schemas";

/** Banner above the shell — only present in a demo sandbox session. */
export function DemoBanner({ demo }: { demo: DemoState }) {
  const count = Object.values(demo.steps).filter(Boolean).length;
  return (
    <div
      className="relative z-60 flex shrink-0 items-center gap-2.5 border-b border-accent/30 px-4 py-[7px]"
      style={{ background: "linear-gradient(90deg, rgba(77,124,254,0.16), rgba(139,92,246,0.09))" }}
    >
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent"
        style={{ boxShadow: "0 0 8px rgba(77,124,254,0.8)", animation: "plPulse 2s ease infinite" }}
      />
      <span className="text-[12px] text-ink-2">
        <span className="font-semibold text-ink">Interactive demo</span> — explore freely with mock
        data. Nothing is saved.
      </span>
      <span className="flex-1" />
      <span className="font-mono text-[10.5px] text-accent-soft">{count}/5 explored</span>
      <Link
        href="/signin"
        className="rounded-md bg-accent px-[11px] py-[4.5px] text-[11.5px] font-semibold text-white no-underline hover:bg-accent-hover"
      >
        Start free
      </Link>
      <Link href="/" className="px-1 py-[4.5px] text-[11.5px] text-ink-4 no-underline hover:text-ink">
        Exit
      </Link>
    </div>
  );
}
