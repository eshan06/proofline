"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CustomerAvatar } from "@/components/ui/avatar";
import { ChannelIcon } from "@/components/shared/channel-icon";
import { useWorkspace } from "@/hooks/use-workspace";
import { sentimentColor } from "@/data/workspace";
import { stageMap } from "@/lib/maps";
import { toast } from "@/stores/toasts";
import type { Customer } from "@/lib/schemas";

export function CustomersView({ customerId }: { customerId: string | undefined }) {
  const router = useRouter();
  const { data: ws } = useWorkspace();
  const [search, setSearch] = useState("");
  const customers = ws?.customers ?? [];
  const tickets = ws?.tickets ?? [];

  const filtered = customers.filter(
    (c) => !search || `${c.name} ${c.company}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = customers.find((c) => c.id === customerId) ?? filtered[0] ?? customers[0];

  return (
    <div className="flex min-h-0 flex-1" style={{ animation: "plFade 0.22s ease" }}>
      {/* list */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-white/7">
        <div className="px-3 pb-2 pt-3">
          <div className="flex items-center gap-2 rounded-[7px] border border-white/7 bg-white/4 px-2.5 py-1.5">
            <Search size={13} strokeWidth={1.4} className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              aria-label="Search customers"
              className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-ink placeholder:text-muted"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const sel = c.id === selected?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/customers/${c.id}`)}
                className="flex w-full cursor-pointer items-center gap-2.5 border-b border-white/[0.045] py-[11px] pl-2.5 pr-3 text-left hover:bg-white/[0.035]"
                style={{ borderLeft: `2px solid ${sel ? "#4D7CFE" : "transparent"}`, background: sel ? "rgba(77,124,254,0.07)" : "transparent" }}
              >
                <CustomerAvatar initials={c.init} hue={c.hue} size={30} />
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-[12.5px] font-semibold text-ink">{c.name}</span>
                  <span className="truncate text-[11px] text-muted">{c.company}</span>
                </div>
                <div className="flex flex-col items-end gap-[3px]">
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: sentimentColor[c.sentiment] }} />
                  <span className="font-mono text-[9.5px] text-faint">{c.convos} conv</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* profile */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? <Profile customer={selected} tickets={tickets} onOpen={(id) => router.push(`/inbox/${id}`)} /> : null}
      </div>
    </div>
  );
}

function Profile({
  customer,
  tickets,
  onOpen,
}: {
  customer: Customer;
  tickets: { id: string; subject: string; customer: { name: string }; stage: keyof typeof stageMap; channel: "web" | "email" | "slack"; archived: boolean }[];
  onOpen: (id: string) => void;
}) {
  const convos = tickets.filter((t) => t.customer.name === customer.name && !t.archived);
  const meta: [string, string][] = [
    ["Plan", customer.plan],
    ["MRR", customer.mrr],
    ["Customer since", customer.since],
    ["Location", customer.loc],
    ["Seats", customer.seats],
    ["Last active", customer.lastActive],
  ];

  return (
    <div className="mx-auto max-w-[760px] px-8 pb-10 pt-[26px]">
      <div className="flex items-center gap-3.5">
        <CustomerAvatar initials={customer.init} hue={customer.hue} size={46} />
        <div className="flex flex-col gap-0.5">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{customer.name}</div>
          <div className="text-[12px] text-muted">{customer.company} · {customer.email}</div>
        </div>
        <span className="flex-1" />
        <span
          className="flex items-center gap-1.5 rounded-full border border-white/9 bg-white/3 px-[11px] py-[3px] text-[11.5px]"
          style={{ color: sentimentColor[customer.sentiment] }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sentimentColor[customer.sentiment] }} />
          <span>{customer.sentiment}</span>
        </span>
        <button
          type="button"
          onClick={() => toast(`Compose email to ${customer.email}`)}
          className="rounded-[7px] border border-white/9 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-white/9"
        >
          Email
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {meta.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-[3px] rounded-[9px] border border-white/7 bg-card px-[13px] py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{k}</span>
            <span className="text-[12.5px] font-medium text-[#D6DCE8]">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-3.5 overflow-hidden rounded-[11px] border border-white/7 bg-card">
        <div className="flex items-center border-b border-white/6 px-4 py-3">
          <span className="text-[13px] font-semibold text-ink">Conversations</span>
          <span className="ml-2 font-mono text-[10.5px] text-muted">{customer.convos} lifetime</span>
        </div>
        {convos.length === 0 ? (
          <div className="px-4 py-[22px] text-center text-[12px] text-muted">
            No open conversations — older history is archived.
          </div>
        ) : (
          convos.map((t) => {
            const st = stageMap[t.stage];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpen(t.id)}
                className="flex w-full cursor-pointer items-center gap-2.5 border-b border-white/[0.04] px-4 py-2.5 text-left hover:bg-white/3"
              >
                <span className="flex text-muted"><ChannelIcon channel={t.channel} /></span>
                <span className="flex-1 truncate text-[12.5px] font-medium text-[#D6DCE8]">{t.subject}</span>
                <span className="flex items-center gap-1 text-[10.5px]" style={{ color: st.color }}>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: st.color }} />
                  <span>{st.label}</span>
                </span>
                <span className="font-mono text-[10px] text-faint">{t.id}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3.5 flex flex-col gap-[11px] rounded-[11px] border border-white/7 bg-card px-4 py-3.5">
        <div className="flex items-center">
          <span className="text-[13px] font-semibold text-ink">Notes</span>
          <button
            type="button"
            onClick={() => toast("Customer notes editor")}
            className="ml-auto border-0 bg-transparent text-[11.5px] text-accent"
          >
            + Add note
          </button>
        </div>
        {customer.notes.length === 0 ? (
          <div className="text-[12px] text-muted">No notes yet.</div>
        ) : (
          customer.notes.map((n, i) => (
            <div key={i} className="flex gap-[9px]">
              <div className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white/7 text-[9px] font-semibold text-ink-4">
                {n.author[0]}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted">
                  <span className="font-medium text-ink-3">{n.author}</span> · {n.time}
                </span>
                <span className="text-[12px] leading-[1.55] text-ink-2">{n.text}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
