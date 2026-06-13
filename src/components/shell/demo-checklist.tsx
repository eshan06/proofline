"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { api } from "@/lib/api-client";
import type { DemoState, DemoStep } from "@/lib/schemas";

const MISSIONS: { key: DemoStep; label: string; hint: string; go: (router: ReturnType<typeof useRouter>) => void }[] = [
  { key: "draft", label: "Accept an AI draft", hint: "", go: (r) => r.push("/inbox/TKT-1042") },
  { key: "send", label: "Send the reply", hint: "⌘↵", go: (r) => r.push("/inbox/TKT-1042") },
  { key: "upload", label: "Upload a knowledge doc", hint: "", go: (r) => r.push("/kb?upload=1") },
  { key: "connect", label: "Connect an integration", hint: "", go: (r) => r.push("/integrations") },
  {
    key: "palette",
    label: "Open the command palette",
    hint: "⌘K",
    go: () => {
      void api.completeDemoStep("palette").catch(() => {});
      useUiStore.getState().setPaletteOpen(true);
    },
  },
];

/** Floating "Try it yourself" checklist, bottom-left of the content area. */
export function DemoChecklist({ demo }: { demo: DemoState }) {
  const router = useRouter();
  const { demoPanelOpen, toggleDemoPanel } = useUiStore();
  const count = Object.values(demo.steps).filter(Boolean).length;
  const pct = Math.round((count / 5) * 100);
  const allDone = count === 5;

  if (!demoPanelOpen) {
    return (
      <div className="absolute bottom-[18px] left-[18px] z-70 w-[268px]">
        <button
          type="button"
          onClick={toggleDemoPanel}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-accent/32 bg-raised px-3.5 py-[7px] hover:border-accent/55"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
        >
          <Sparkles size={15} className="text-accent" />
          <span className="text-[12px] font-medium text-ink-2">Demo guide</span>
          <span className="font-mono text-[10px] text-accent-soft">{count}/5</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-[18px] left-[18px] z-70 w-[268px]">
      <div
        className="overflow-hidden rounded-[13px] border border-accent/32 bg-raised"
        style={{ boxShadow: "0 18px 50px rgba(0,0,0,0.6)", animation: "plToast 0.22s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <button
          type="button"
          onClick={toggleDemoPanel}
          className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-[11px] text-left hover:bg-white/[0.025]"
        >
          <Sparkles size={15} className="text-accent" />
          <span className="text-[12.5px] font-semibold text-ink">Try it yourself</span>
          <span className="ml-auto font-mono text-[10px] text-accent-soft">{count}/5</span>
          <span className="text-[9px] text-muted">▾</span>
        </button>

        <div className="h-[3px] bg-white/6">
          <div
            className="h-full transition-[width] duration-[450ms]"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #4D7CFE, #3DD68C)", transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
          />
        </div>

        <div className="py-1.5 pb-2">
          {MISSIONS.map((m) => {
            const done = demo.steps[m.key];
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => m.go(router)}
                className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-[7.5px] text-left hover:bg-white/3"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-success"
                  style={{
                    border: `1px solid ${done ? "rgba(61,214,140,0.5)" : "rgba(255,255,255,0.18)"}`,
                    background: done ? "rgba(61,214,140,0.16)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  {done ? <Check size={10} strokeWidth={2.4} /> : null}
                </span>
                <span
                  className="text-[12px]"
                  style={{ color: done ? "#5C6478" : "#D6DCE8", textDecoration: done ? "line-through" : "none" }}
                >
                  {m.label}
                </span>
                {m.hint ? <span className="ml-auto font-mono text-[9.5px] text-faint">{m.hint}</span> : null}
              </button>
            );
          })}
        </div>

        {allDone ? (
          <div
            className="flex flex-col gap-[9px] border-t border-white/7 px-3.5 py-[11px]"
            style={{ animation: "plFade 0.25s ease" }}
          >
            <span className="text-[12px] leading-[1.5] text-ink-2">
              That&apos;s the core loop — Proofline drafts, <span className="font-semibold text-ink">you approve</span>.
            </span>
            <Link
              href="/signin"
              className="rounded-[7px] bg-accent py-[7px] text-center text-[12px] font-semibold text-white no-underline hover:bg-accent-hover"
              style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
            >
              Start free
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
