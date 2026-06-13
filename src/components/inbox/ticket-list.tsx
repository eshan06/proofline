"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { ChannelIcon } from "@/components/shared/channel-icon";
import { PriorityBadge, ConfidenceChip } from "@/components/shared/badges";
import { useInboxStore } from "@/stores/inbox";
import {
  filterCounts,
  filterTickets,
  INBOX_FILTERS,
  type InboxFilter,
} from "@/lib/inbox-filter";
import type { Ticket } from "@/lib/schemas";

export function TicketList({
  tickets,
  selectedId,
  filter,
  search,
}: {
  tickets: Ticket[];
  selectedId: string;
  filter: InboxFilter;
  search: string;
}) {
  const router = useRouter();
  const setOrderedIds = useInboxStore((s) => s.setOrderedIds);

  const counts = filterCounts(tickets);
  const list = filterTickets(tickets, filter, search);

  // Register the visible order so J/K navigation walks exactly this list.
  useEffect(() => {
    setOrderedIds(list.map((t) => t.id));
  }, [list, setOrderedIds]);

  const setFilter = (f: InboxFilter) => {
    const params = new URLSearchParams();
    if (f !== "All") params.set("filter", f);
    if (search) params.set("q", search);
    const qs = params.toString();
    router.push(`/inbox/${selectedId}${qs ? `?${qs}` : ""}`);
  };

  const setSearch = (value: string) => {
    const params = new URLSearchParams();
    if (filter !== "All") params.set("filter", filter);
    if (value) params.set("q", value);
    const qs = params.toString();
    router.replace(`/inbox/${selectedId}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="flex w-[318px] shrink-0 flex-col border-r border-white/7" style={{ minHeight: 0 }}>
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2 rounded-[7px] border border-white/7 bg-white/4 px-2.5 py-1.5">
          <Search size={13} strokeWidth={1.4} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-ink placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-[5px] px-3 pb-2.5">
        {INBOX_FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className="flex cursor-pointer items-center gap-[5px] rounded-full border px-[9px] py-[2.5px] text-[11px] font-medium hover:border-accent/55"
              style={{
                borderColor: active ? "rgba(77,124,254,0.45)" : "rgba(255,255,255,0.08)",
                background: active ? "rgba(77,124,254,0.14)" : "rgba(255,255,255,0.03)",
                color: active ? "#9DB7FF" : "#8A93A6",
              }}
            >
              <span>{f}</span>
              <span className="font-mono text-[9.5px] opacity-65">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-dashed border-white/15 bg-white/4 text-muted">
              <Inbox size={16} strokeWidth={1.4} />
            </div>
            <div className="text-[12.5px] font-medium text-ink-4">No conversations match</div>
            <div className="text-[11.5px] leading-[1.5] text-muted">Try a different filter, or clear your search.</div>
          </div>
        ) : (
          list.map((t) => {
            const selected = t.id === selectedId;
            const params = new URLSearchParams();
            if (filter !== "All") params.set("filter", filter);
            if (search) params.set("q", search);
            const qs = params.toString();
            return (
              <Link
                key={t.id}
                href={`/inbox/${t.id}${qs ? `?${qs}` : ""}`}
                className="block cursor-pointer border-b border-white/[0.045] py-2.5 pl-2.5 pr-3 no-underline hover:bg-white/[0.035]"
                style={{
                  borderLeft: `2px solid ${selected ? "#4D7CFE" : "transparent"}`,
                  background: selected ? "rgba(77,124,254,0.07)" : "transparent",
                }}
              >
                <div className="flex items-center gap-[7px]">
                  <span className="flex w-3.5 justify-center text-muted">
                    <ChannelIcon channel={t.channel} />
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">{t.customer.name}</span>
                  <span className="flex-1" />
                  <span className="font-mono text-[10px] text-muted">{t.time}</span>
                  {t.unread ? (
                    <span className="h-[7px] w-[7px] rounded-full bg-accent" style={{ boxShadow: "0 0 6px rgba(77,124,254,0.7)" }} />
                  ) : null}
                </div>
                <div className="ml-[21px] mb-0.5 mt-1 truncate text-[12px] font-medium text-ink-2">{t.subject}</div>
                <div className="ml-[21px] mb-[7px] truncate text-[11.5px] text-muted">{t.preview}</div>
                <div className="ml-[21px] flex items-center gap-1.5">
                  <PriorityBadge priority={t.priority} />
                  {t.tags[0] ? (
                    <span className="rounded-[4px] bg-white/5 px-1.5 py-px text-[10.5px] text-ink-4">{t.tags[0]}</span>
                  ) : null}
                  <span className="flex-1" />
                  <ConfidenceChip conf={t.conf} />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
