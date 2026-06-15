"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useUiStore } from "@/stores/ui";
import { Kbd } from "@/components/ui/kbd";
import { PAGE_TITLES } from "./nav-items";
import { NotificationsPopover } from "./notifications";
import type { CurrentUser, Notification } from "@/lib/schemas";

function pageTitle(pathname: string): string {
  const seg = pathname.split("/")[1] ?? "home";
  return PAGE_TITLES[seg] ?? "Home";
}

export function Topbar({
  notifications,
  workspaceName,
  currentUser,
}: {
  notifications: Notification[];
  workspaceName: string;
  currentUser: CurrentUser | null;
}) {
  const pathname = usePathname();
  const { togglePalette, toggleNotif, notifOpen } = useUiStore();

  return (
    <div className="relative z-40 flex h-12 shrink-0 items-center gap-2.5 border-b border-white/7 bg-panel/70 px-4 backdrop-blur-md">
      <div className="flex items-center gap-[7px] text-[12.5px] text-muted">
        <span className="max-w-[160px] truncate">{workspaceName}</span>
        <span className="text-[#353B49]">/</span>
        <span className="font-medium text-ink-2">{pageTitle(pathname)}</span>
      </div>
      <div className="flex-1" />

      <button
        type="button"
        onClick={() => togglePalette()}
        aria-label="Open command palette"
        className="pl-focus-visible flex w-[220px] cursor-pointer items-center gap-2 rounded-[7px] border border-white/8 bg-white/4 px-2.5 py-[5px] text-left text-[12px] text-muted hover:border-accent/50 hover:text-ink-4"
      >
        <Search size={13} strokeWidth={1.4} />
        <span className="flex-1">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <button
        type="button"
        onClick={() => toggleNotif()}
        aria-label="Notifications"
        aria-expanded={notifOpen}
        className="pl-focus-visible relative flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-ink-4 hover:bg-white/6 hover:text-ink"
      >
        <Bell size={15} strokeWidth={1.4} />
        <span className="absolute right-1.5 top-[5px] h-[7px] w-[7px] rounded-full border-2 border-panel bg-danger" />
      </button>

      <Link
        href="/docs"
        aria-label="Help & documentation"
        className="pl-focus-visible flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-[13px] text-ink-4 no-underline hover:bg-white/6 hover:text-ink"
      >
        ?
      </Link>

      <span
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-accent/30 bg-accent/18 text-[11px] font-semibold text-accent-soft"
        title={currentUser ? `${currentUser.name} · ${currentUser.email}` : "Demo session"}
      >
        {currentUser?.initials ?? "•"}
      </span>

      {notifOpen ? <NotificationsPopover notifications={notifications} /> : null}
    </div>
  );
}
