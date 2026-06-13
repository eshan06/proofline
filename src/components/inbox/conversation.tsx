"use client";

import { CustomerAvatar, AgentAvatar } from "@/components/ui/avatar";
import { Composer } from "./composer";
import { statusMap, priorityMap } from "@/lib/maps";
import { slaColor, slaLabel } from "@/lib/utils";
import { useCyclePriority } from "@/hooks/use-ticket-actions";
import type { AgentName, Message, Ticket } from "@/lib/schemas";

function StatusEvent({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <div className="h-px flex-1 bg-white/5" />
      <span className="text-center font-mono text-[10px] leading-[1.5] text-muted">{text}</span>
      <div className="h-px flex-1 bg-white/5" />
    </div>
  );
}

function InternalNote({ m }: { m: Message }) {
  return (
    <div className="rounded-[10px] border border-dashed border-warning/35 bg-warning/5 px-[13px] py-2.5">
      <div className="mb-[5px] flex items-center gap-[7px]">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-warning">Internal note</span>
        <span className="text-[11px] text-ink-4">{m.author}</span>
        <span className="ml-auto font-mono text-[10px] text-muted">{m.time}</span>
      </div>
      <div className="text-[12.5px] leading-[1.55] text-[#D6DCE8]">{m.text}</div>
    </div>
  );
}

function CustomerBubble({ m, ticket }: { m: Message; ticket: Ticket }) {
  return (
    <div className="flex max-w-[640px] gap-2.5">
      <CustomerAvatar initials={ticket.customer.initials} hue={ticket.customer.hue} size={28} className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold text-ink">{ticket.customer.name}</span>
          <span className="font-mono text-[10px] text-muted">{m.time}</span>
        </div>
        <div className="rounded-[4px_12px_12px_12px] border border-white/7 bg-bubble px-[13px] py-2.5 text-[12.5px] leading-[1.6] text-[#D6DCE8]">
          {m.text}
        </div>
      </div>
    </div>
  );
}

function AgentBubble({ m }: { m: Message }) {
  return (
    <div className="flex max-w-[640px] flex-row-reverse gap-2.5 self-end">
      <AgentAvatar name={(m.author as AgentName) ?? null} size={28} className="mt-0.5" />
      <div className="flex min-w-0 flex-col items-end gap-1">
        <div className="flex flex-row-reverse items-baseline gap-2">
          <span className="text-[12px] font-semibold text-ink">{m.author}</span>
          {m.viaAI ? (
            <span className="rounded-[4px] bg-accent/12 px-1.5 py-px text-[10px] text-accent">via AI draft</span>
          ) : null}
          <span className="font-mono text-[10px] text-muted">{m.time}</span>
        </div>
        <div className="rounded-[12px_4px_12px_12px] border border-accent/22 bg-accent/10 px-[13px] py-2.5 text-[12.5px] leading-[1.6] text-[#DDE5F5]">
          {m.text}
        </div>
      </div>
    </div>
  );
}

export function Conversation({ ticket, isDemo }: { ticket: Ticket; isDemo: boolean }) {
  const status = statusMap[ticket.status];
  const pr = priorityMap[ticket.priority];
  const cyclePriority = useCyclePriority();
  const slaFg = slaColor(ticket.slaMins);
  const slaW = ticket.slaTotal ? `${Math.round((ticket.slaMins / ticket.slaTotal) * 100)}%` : "100%";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-page">
      {/* header */}
      <div className="shrink-0 border-b border-white/7 px-5 pt-3">
        <div className="flex items-center gap-2.5">
          <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{ticket.subject}</span>
          <span className="shrink-0 font-mono text-[10.5px] text-muted">{ticket.id}</span>
          <span className="flex-1" />
          <span
            className="flex shrink-0 items-center gap-[5px] rounded-full border px-[9px] py-0.5 text-[11px] font-medium"
            style={{ color: status.fg, borderColor: status.bd, background: status.bg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.fg }} />
            <span>{status.label}</span>
          </span>
        </div>
        <div className="my-2.5 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/7 bg-white/4 py-[2.5px] pl-1 pr-[9px] text-[11.5px] text-ink-4">
            <AgentAvatar name={ticket.assignee} size={17} />
            <span>{ticket.assignee ?? "Unassigned"}</span>
          </span>
          <button
            type="button"
            onClick={() => cyclePriority.mutate({ ticket })}
            title="Change priority"
            className="flex cursor-pointer items-center gap-[5px] rounded-full border border-white/7 bg-white/4 px-[9px] py-[2.5px] text-[11.5px] font-medium hover:border-accent/50"
            style={{ color: pr.color }}
          >
            <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: pr.color }} />
            <span>{pr.label}</span>
            <span className="text-[9px] text-muted">▾</span>
          </button>
          {ticket.tags.map((tag) => (
            <span key={tag} className="rounded-[5px] bg-white/5 px-2 py-[2.5px] text-[11px] text-ink-4">
              {tag}
            </span>
          ))}
          <span className="flex-1" />
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[10.5px]" style={{ color: slaFg }}>
              {slaLabel(ticket.slaMins)}
            </span>
            <div className="h-[3.5px] w-[130px] overflow-hidden rounded-full bg-white/7">
              <div
                className="h-full rounded-full"
                style={{ background: slaFg, width: slaW, transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* timeline */}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-[18px]">
        {ticket.messages.map((m) => {
          if (m.kind === "status") return <StatusEvent key={m.id} text={m.text} />;
          if (m.kind === "note") return <InternalNote key={m.id} m={m} />;
          if (m.kind === "agent") return <AgentBubble key={m.id} m={m} />;
          return <CustomerBubble key={m.id} m={m} ticket={ticket} />;
        })}
      </div>

      <Composer ticket={ticket} isDemo={isDemo} />
    </div>
  );
}
