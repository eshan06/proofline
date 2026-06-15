"use client";

import Link from "next/link";
import { Check, Rocket, X } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";

const STEPS: {
  key: "kb" | "channel" | "team" | "inbox";
  label: string;
  href: string;
}[] = [
  { key: "kb", label: "Upload a knowledge-base doc", href: "/kb" },
  { key: "channel", label: "Connect a channel", href: "/integrations" },
  { key: "team", label: "Invite your team", href: "/settings/team" },
  { key: "inbox", label: "Send your first reply", href: "/inbox" },
];

const STORAGE_KEY = "pl:onboarding:dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** "Getting started" checklist shown in the sidebar for real (non-demo) users
 *  with a fresh workspace. Disappears once all steps are done or dismissed. */
export function OnboardingChecklist() {
  const { data: ws } = useWorkspace();
  const [hidden, setHidden] = useState<boolean>(isDismissed);

  // Only show for non-demo, loaded workspaces with no tickets yet.
  if (!ws || ws.demo.active || ws.tickets.length > 0) return null;
  if (hidden) return null;

  const checked = {
    kb: ws.kbDocs.length > 0,
    channel: ws.integrations.some(
      (i) => i.connected && (i.key === "gmail" || i.key === "slack"),
    ),
    team: ws.members.length > 1,
    inbox: ws.tickets.length > 0,
  };

  const doneCount = Object.values(checked).filter(Boolean).length;
  const allDone = doneCount === STEPS.length;

  // Auto-hide once everything is complete.
  if (allDone) {
    dismiss();
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    dismiss();
    setHidden(true);
  };

  return (
    <div className="mx-2.5 mb-2 rounded-[9px] border border-white/8 bg-white/[0.03] py-2">
      {/* header */}
      <div className="flex items-center gap-2 px-[10px] pb-[6px]">
        <Rocket size={13} strokeWidth={1.5} className="shrink-0 text-accent" />
        <span className="flex-1 text-[11.5px] font-semibold text-ink">Getting started</span>
        <span className="font-mono text-[10px] text-muted">{doneCount}/{STEPS.length}</span>
        <button
          type="button"
          aria-label="Dismiss onboarding checklist"
          onClick={handleDismiss}
          className="flex h-4 w-4 items-center justify-center rounded border-0 bg-transparent text-muted hover:text-ink-4"
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>

      {/* progress bar */}
      <div className="mx-[10px] mb-[7px] h-[2px] rounded-full bg-white/6">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.round((doneCount / STEPS.length) * 100)}%`,
            background: "linear-gradient(90deg, #4D7CFE, #3DD68C)",
          }}
        />
      </div>

      {/* steps */}
      {STEPS.map((step) => {
        const done = checked[step.key];
        return (
          <Link
            key={step.key}
            href={step.href}
            className="flex items-center gap-2 px-[10px] py-[5px] no-underline hover:bg-white/[0.03]"
          >
            <span
              className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full text-success"
              style={{
                border: `1px solid ${done ? "rgba(61,214,140,0.45)" : "rgba(255,255,255,0.15)"}`,
                background: done ? "rgba(61,214,140,0.14)" : "rgba(255,255,255,0.03)",
              }}
            >
              {done ? <Check size={9} strokeWidth={2.5} /> : null}
            </span>
            <span
              className="text-[11.5px] leading-snug"
              style={{
                color: done ? "#5C6478" : "#C8D0DF",
                textDecoration: done ? "line-through" : "none",
              }}
            >
              {step.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
