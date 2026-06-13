"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Plus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { ChannelIcon } from "@/components/shared/channel-icon";
import { useUiStore } from "@/stores/ui";
import { toast } from "@/stores/toasts";
import { api } from "@/lib/api-client";
import { Kbd } from "@/components/ui/kbd";
import type { Ticket } from "@/lib/schemas";

interface PaletteItem {
  group: "Pages" | "Actions" | "Tickets";
  label: string;
  sub?: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen } = useUiStore();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => {
      setPaletteOpen(false);
      router.push(href);
    };
    const iconFor = (Icon: LucideIcon) => <Icon size={13} strokeWidth={1.4} />;

    const pages: PaletteItem[] = NAV_ITEMS.map((n) => ({
      group: "Pages",
      label: n.label,
      hint: "Jump to",
      icon: iconFor(n.icon),
      run: go(n.href),
    }));

    const actions: PaletteItem[] = [
      {
        group: "Actions",
        label: "Review low-confidence drafts",
        sub: "2 waiting",
        hint: "Action",
        icon: <AlertTriangle size={13} strokeWidth={1.4} />,
        run: () => {
          setPaletteOpen(false);
          router.push("/inbox/TKT-1038?filter=Low+Confidence");
        },
      },
      {
        group: "Actions",
        label: "Upload knowledge-base docs",
        hint: "Action",
        icon: <Plus size={13} strokeWidth={1.4} />,
        run: () => {
          setPaletteOpen(false);
          router.push("/kb?upload=1");
        },
      },
      {
        group: "Actions",
        label: "Escalate current ticket",
        hint: "Action",
        icon: <Zap size={13} strokeWidth={1.4} />,
        run: () => {
          setPaletteOpen(false);
          const first = tickets.find((t) => !t.archived);
          if (first) {
            void api.patchTicket(first.id, { status: "escalated" }).then(() =>
              toast("Escalated to engineering"),
            );
          }
        },
      },
    ];

    const ticketItems: PaletteItem[] = tickets
      .filter((t) => !t.archived)
      .map((t) => ({
        group: "Tickets",
        label: t.subject,
        sub: t.customer.name,
        hint: t.id,
        icon: <ChannelIcon channel={t.channel} />,
        run: go(`/inbox/${t.id}`),
      }));

    return [...pages, ...actions, ...ticketItems];
  }, [router, setPaletteOpen, tickets]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      `${p.label} ${p.sub ?? ""} ${p.group} ${p.hint}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Reset when (re)opened.
  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [paletteOpen]);

  // Keep the active item in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  // The palette owns ↑↓ / ↵ while open; ⌘K / Esc are handled globally.
  useEffect(() => {
    if (!paletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[index]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, filtered, index]);

  if (!paletteOpen) return null;

  return (
    <div
      onClick={() => setPaletteOpen(false)}
      className="absolute inset-0 z-80 flex justify-center pt-[110px] backdrop-blur-[5px]"
      style={{ background: "rgba(5,7,11,0.62)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[420px] w-[580px] flex-col overflow-hidden rounded-[14px] border border-white/12 bg-raised"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(77,124,254,0.08)", animation: "plFade 0.16s ease" }}
      >
        <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-[13px]">
          <span className="flex text-muted">
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              <path d="M10 10l3.5 3.5" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={`palette-item-${index}`}
            placeholder="Type a command or search tickets…"
            className="flex-1 border-0 bg-transparent text-[13.5px] text-ink placeholder:text-muted"
          />
          <Kbd className="border border-white/10 bg-transparent">esc</Kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="px-7 py-7 text-center text-[12.5px] text-muted">
              No results for “{query}”
            </div>
          ) : (
            filtered.map((p, i) => {
              const showGroup = i === 0 || filtered[i - 1]?.group !== p.group;
              const active = i === index;
              return (
                <div key={`${p.group}-${p.label}-${i}`}>
                  {showGroup ? (
                    <div className="px-[11px] pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
                      {p.group}
                    </div>
                  ) : null}
                  <div
                    id={`palette-item-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setIndex(i)}
                    onClick={p.run}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-2"
                    style={{ background: active ? "rgba(77,124,254,0.12)" : "transparent" }}
                  >
                    <span className="flex" style={{ color: active ? "#9DB7FF" : "#5C6478" }}>
                      {p.icon}
                    </span>
                    <span className="text-[12.5px] text-ink">{p.label}</span>
                    {p.sub ? <span className="text-[11px] text-muted">{p.sub}</span> : null}
                    <span className="ml-auto font-mono text-[10px] text-muted">{p.hint}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3.5 border-t border-white/8 px-4 py-[9px] text-[10.5px] text-muted">
          <span><Kbd>↑↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> select</span>
          <span className="ml-auto"><Kbd>J</Kbd> / <Kbd>K</Kbd> move through inbox</span>
        </div>
      </div>
    </div>
  );
}
