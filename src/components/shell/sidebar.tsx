"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { Logo } from "./logo";
import { NAV_ITEMS } from "./nav-items";
import { toast } from "@/stores/toasts";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    try {
      await api.logOut();
    } catch {
      /* sign out locally regardless */
    }
    router.push("/signin");
  };

  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-white/7 bg-panel">
      {/* workspace switcher */}
      <button
        type="button"
        onClick={() => toast("Workspace switcher — coming with multi-workspace support")}
        className="m-2.5 flex cursor-pointer items-center gap-[9px] rounded-lg border-0 bg-transparent p-2 px-[9px] text-left hover:bg-white/5"
      >
        <Logo size={26} />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Acme Inc</span>
          <span className="text-[10.5px] text-muted">Proofline · Pro plan</span>
        </span>
        <span className="ml-auto text-[10px] text-muted">▾</span>
      </button>

      {/* nav */}
      <nav className="flex flex-col gap-px px-2.5 py-1" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-[9px] rounded-[7px] px-[9px] py-[5.5px] text-[12.5px] no-underline",
                active
                  ? "bg-accent/12 font-semibold text-ink"
                  : "font-normal text-ink-4 hover:bg-white/5 hover:text-ink",
              )}
            >
              <span className={cn("flex items-center", active ? "text-accent" : "text-muted")}>
                <Icon size={15} strokeWidth={1.4} />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="inline-flex rounded-full bg-accent/12 px-[7px] py-px font-mono text-[10px] text-accent">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* footer */}
      <div className="mt-auto flex flex-col gap-2 p-2.5">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-[7px] px-[9px] py-1.5 text-[11.5px] text-muted no-underline hover:bg-white/5 hover:text-ink-4"
        >
          <ExternalLink size={12} strokeWidth={1.4} />
          <span>Marketing site</span>
        </Link>
        <div className="flex items-center gap-[9px] rounded-lg border border-white/6 bg-white/2 p-2 px-[9px]">
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent/18 text-[11px] font-semibold text-accent-soft">
            E
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="text-[12px] font-medium text-ink">Eshan Patel</span>
            <span className="truncate text-[10.5px] text-muted">eshan@acme.io</span>
          </span>
          <span
            aria-label="Online"
            className="h-[7px] w-[7px] shrink-0 rounded-full bg-success"
            style={{ boxShadow: "0 0 6px rgba(61,214,140,0.6)" }}
          />
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="ml-auto flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border-0 bg-transparent text-muted hover:bg-white/6 hover:text-ink"
          >
            <LogOut size={13} strokeWidth={1.4} />
          </button>
        </div>
      </div>
    </div>
  );
}
