"use client";

import { useUiStore } from "@/stores/ui";
import { toast } from "@/stores/toasts";
import type { Notification } from "@/lib/schemas";

export function NotificationsPopover({ notifications }: { notifications: Notification[] }) {
  const setNotifOpen = useUiStore((s) => s.setNotifOpen);

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute right-14 top-[46px] w-[330px] overflow-hidden rounded-xl border border-white/10 bg-raised"
      style={{ boxShadow: "0 16px 50px rgba(0,0,0,0.6)", animation: "plFade 0.18s ease" }}
    >
      <div className="flex items-center border-b border-white/7 px-3.5 py-[11px]">
        <span className="text-[12.5px] font-semibold text-ink">Notifications</span>
        <button
          type="button"
          onClick={() => {
            setNotifOpen(false);
            toast("All notifications marked read");
          }}
          className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[11px] text-accent"
        >
          Mark all read
        </button>
      </div>
      {notifications.map((nf, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setNotifOpen(false)}
          className="flex w-full cursor-pointer gap-2.5 border-0 border-b border-white/[0.045] bg-transparent px-3.5 py-2.5 text-left hover:bg-white/3"
        >
          <span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: nf.c }} />
          <span className="flex flex-col gap-0.5">
            <span className="text-[12px] leading-[1.4] text-[#D6DCE8]">{nf.text}</span>
            <span className="font-mono text-[10px] text-muted">{nf.time}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
