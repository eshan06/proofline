"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { KeyboardProvider } from "./keyboard-provider";
import { Toaster } from "./toaster";
import { DemoBanner } from "./demo-banner";
import { DemoChecklist } from "./demo-checklist";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Workspace } from "@/lib/schemas";

/**
 * The app chrome. Desktop-first (min-width 1240px); the shell never scrolls —
 * content panes scroll internally. Seeded from the server-fetched workspace so
 * first paint is correct with no fetch waterfall.
 */
export function AppShell({
  initialWorkspace,
  children,
}: {
  initialWorkspace: Workspace;
  children: React.ReactNode;
}) {
  const { data: ws } = useWorkspace(initialWorkspace);
  const workspace = ws ?? initialWorkspace;
  const isDemo = workspace.demo.active;

  return (
    <div
      className="flex h-screen min-h-[600px] w-full flex-col overflow-hidden bg-page text-[13px] text-ink"
      style={{ minWidth: 1240 }}
    >
      {isDemo ? <DemoBanner demo={workspace.demo} /> : null}

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <Topbar notifications={workspace.notifications} />
          {children}

          <CommandPalette tickets={workspace.tickets} />
          <Toaster />
          {isDemo ? <DemoChecklist demo={workspace.demo} /> : null}
        </div>
      </div>

      <KeyboardProvider isDemo={isDemo} />
    </div>
  );
}
