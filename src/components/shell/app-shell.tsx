"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { KeyboardProvider } from "./keyboard-provider";
import { Toaster } from "./toaster";
import { DemoBanner } from "./demo-banner";
import { DemoChecklist } from "./demo-checklist";
import { VerifyBanner } from "./verify-banner";
import { useWorkspace } from "@/hooks/use-workspace";
import { ApiClientError } from "@/lib/api-client";
import type { Shell } from "@/lib/schemas";

/**
 * The app chrome. Desktop-first (min-width 1240px); the shell never scrolls —
 * content panes scroll internally. SSR'd from the light `shell` payload for an
 * instant first paint; the full workspace loads lazily client-side and is
 * merged over the shell once available (so the chrome stays reactive to demo
 * steps, notifications, identity, etc.).
 */
export function AppShell({ shell, children }: { shell: Shell; children: React.ReactNode }) {
  const router = useRouter();
  const { data: ws, error } = useWorkspace();

  // A present-but-invalid session (expired cookie) surfaces as a 401 on the
  // client workspace fetch — bounce to sign-in.
  useEffect(() => {
    if (error instanceof ApiClientError && error.status === 401) router.replace("/signin");
  }, [error, router]);

  // Light shell first; the full workspace (when loaded) wins so the chrome
  // reacts to live changes.
  const name = ws?.name ?? shell.name;
  const currentUser = ws?.currentUser ?? shell.currentUser;
  const notifications = ws?.notifications ?? shell.notifications;
  const demo = ws?.demo ?? shell.demo;
  const isDemo = demo.active;
  const needsVerify = !isDemo && currentUser && !currentUser.emailVerified;

  return (
    <div
      className="flex h-screen min-h-[600px] w-full flex-col overflow-hidden bg-page text-[13px] text-ink"
      style={{ minWidth: 1240 }}
    >
      {isDemo ? <DemoBanner demo={demo} /> : null}
      {needsVerify ? <VerifyBanner email={currentUser!.email} /> : null}

      <div className="flex min-h-0 flex-1">
        <Sidebar workspaceName={name} currentUser={currentUser} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <Topbar notifications={notifications} workspaceName={name} currentUser={currentUser} />
          {children}

          <CommandPalette tickets={ws?.tickets ?? []} />
          <Toaster />
          {isDemo ? <DemoChecklist demo={demo} /> : null}
        </div>
      </div>

      <KeyboardProvider isDemo={isDemo} />
    </div>
  );
}
