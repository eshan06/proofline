"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { ChannelIcon } from "@/components/shared/channel-icon";
import { PriorityBadge, ConfidenceValue } from "@/components/shared/badges";
import { AgentAvatar } from "@/components/ui/avatar";
import { useWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api-client";
import { useWorkspaceMutation, WORKSPACE_KEY } from "@/hooks/use-workspace";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/toasts";
import { stageMap, stageOrder, priorityMap } from "@/lib/maps";
import type { Ticket } from "@/lib/schemas";

export function TicketsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: ws } = useWorkspace();
  const tickets = ws?.tickets ?? [];
  const view = searchParams.get("view") === "table" ? "table" : "board";

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const setView = (v: "board" | "table") => {
    const params = new URLSearchParams();
    if (v === "table") params.set("view", "table");
    router.push(`/tickets${params.toString() ? `?${params}` : ""}`);
  };

  const bulkAssign = useWorkspaceMutation<string[]>({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.patchTicket(id, { assignee: "Eshan" }))),
    onSuccessToast: (ids) => `${ids.length} ticket(s) assigned to you`,
  });
  const bulkClose = useWorkspaceMutation<string[]>({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.patchTicket(id, { status: "closed" }))),
    onSuccessToast: (ids) => `${ids.length} ticket(s) closed`,
  });
  const bulkTag = useWorkspaceMutation<string[]>({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.patchTicket(id, { addTag: "follow-up" }))),
    onSuccessToast: (ids) => `Tag “follow-up” added to ${ids.length} ticket(s)`,
  });

  const clearSel = () => setSelected({});
  const runBulk = (fn: typeof bulkAssign, ids: string[]) =>
    fn.mutate(ids, { onSettled: () => { clearSel(); void queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY }); } });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1200px] px-7 pb-10 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Tickets</div>
            <div className="text-[12px] text-muted">{tickets.length} tickets · 2 resolved this week</div>
          </div>
          <span className="flex-1" />
          <div className="flex gap-0.5 rounded-[8px] border border-white/8 bg-white/4 p-[3px]">
            {(["board", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="rounded-[6px] px-3.5 py-[5px] text-[12px] font-medium capitalize"
                style={{
                  background: view === v ? "rgba(77,124,254,0.16)" : "transparent",
                  color: view === v ? "#9DB7FF" : "#8A93A6",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "table" && selectedIds.length > 0 ? (
          <div
            className="mt-3.5 flex items-center gap-2 rounded-[9px] border border-accent/30 bg-accent/[0.07] px-[13px] py-2"
            style={{ animation: "plFade 0.18s ease" }}
          >
            <span className="text-[12px] font-semibold text-accent-soft">{selectedIds.length} selected</span>
            <span className="h-4 w-px bg-white/10" />
            {[
              { label: "Assign to me", run: () => runBulk(bulkAssign, selectedIds), hover: "hover:border-accent/50 hover:text-accent-soft" },
              { label: "Close", run: () => runBulk(bulkClose, selectedIds), hover: "hover:border-success/50 hover:text-success" },
              { label: "Add tag", run: () => runBulk(bulkTag, selectedIds), hover: "hover:border-accent/50 hover:text-accent-soft" },
              { label: "Export CSV", run: () => { toast(`Exported ${selectedIds.length} ticket(s) to CSV`); clearSel(); }, hover: "hover:border-accent/50 hover:text-accent-soft" },
            ].map((b) => (
              <button key={b.label} type="button" onClick={b.run} className={`rounded-full border border-white/12 bg-transparent px-[11px] py-[3.5px] text-[11.5px] text-ink-2 ${b.hover}`}>
                {b.label}
              </button>
            ))}
            <span className="flex-1" />
            <button type="button" onClick={clearSel} className="border-0 bg-transparent text-[11.5px] text-muted hover:text-ink">
              Clear
            </button>
          </div>
        ) : null}

        {view === "board" ? (
          <Board tickets={tickets} onOpen={(t) => router.push(`/inbox/${t.id}`)} />
        ) : (
          <Table
            tickets={tickets}
            selected={selected}
            onToggle={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
            onOpen={(t) => router.push(`/inbox/${t.id}`)}
          />
        )}
      </div>
    </div>
  );
}

function Board({ tickets, onOpen }: { tickets: Ticket[]; onOpen: (t: Ticket) => void }) {
  return (
    <div className="mt-[18px] grid grid-cols-5 items-start gap-3">
      {stageOrder.map((stage) => {
        const cards = tickets.filter((t) => t.stage === stage);
        const info = stageMap[stage];
        return (
          <div key={stage} className="flex min-h-[120px] flex-col gap-2 rounded-[11px] border border-white/6 bg-white/[0.018] p-2.5">
            <div className="flex items-center gap-[7px] px-[3px] py-0.5">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: info.color }} />
              <span className="text-[11.5px] font-semibold text-ink-2">{info.label}</span>
              <span className="ml-auto font-mono text-[10px] text-muted">{cards.length}</span>
            </div>
            {cards.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-white/10 px-2.5 py-3.5 text-center text-[10.5px] text-faint">No tickets</div>
            ) : (
              cards.map((t) => {
                const pr = priorityMap[t.priority];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t)}
                    className="flex cursor-pointer flex-col gap-[7px] rounded-[9px] border border-white/7 bg-card p-2.5 px-[11px] text-left transition-colors hover:border-accent/45"
                  >
                    <div className="text-[12px] font-medium leading-[1.4] text-[#D6DCE8]">{t.subject}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex text-muted"><ChannelIcon channel={t.channel} /></span>
                      <span className="min-w-0 truncate text-[11px] text-ink-4">{t.customer.name}</span>
                      <span className="flex-1" />
                      <span className="font-mono text-[9.5px] text-faint">{t.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: pr.color }}>
                        <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: pr.color }} />
                        <span>{pr.label}</span>
                      </span>
                      {t.tags[0] ? <span className="rounded-[4px] bg-white/5 px-1.5 py-px text-[10px] text-ink-4">{t.tags[0]}</span> : null}
                      <span className="flex-1" />
                      <ConfidenceValue conf={t.conf} />
                      <AgentAvatar name={t.assignee} size={18} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

const GRID = "grid-cols-[30px_2fr_1.1fr_70px_90px_110px_70px_70px]";

function Table({
  tickets,
  selected,
  onToggle,
  onOpen,
}: {
  tickets: Ticket[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  onOpen: (t: Ticket) => void;
}) {
  return (
    <div className="mt-3.5 overflow-hidden rounded-[11px] border border-white/7 bg-card">
      <div className={`grid ${GRID} items-center gap-2.5 border-b border-white/7 px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted`}>
        <span />
        <span>Ticket</span>
        <span>Customer</span>
        <span>Channel</span>
        <span>Priority</span>
        <span>Assignee</span>
        <span className="text-right">AI conf</span>
        <span className="text-right">Updated</span>
      </div>
      {tickets.map((t) => {
        const st = stageMap[t.stage];
        const sel = !!selected[t.id];
        return (
          <div
            key={t.id}
            onClick={() => onOpen(t)}
            className={`grid ${GRID} cursor-pointer items-center gap-2.5 border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/3`}
            style={{ background: sel ? "rgba(77,124,254,0.06)" : "transparent" }}
          >
            <div
              role="checkbox"
              aria-checked={sel}
              onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}
              className="flex h-[15px] w-[15px] cursor-pointer items-center justify-center rounded-[4px] border text-white"
              style={{ borderColor: sel ? "#4D7CFE" : "rgba(255,255,255,0.18)", background: sel ? "#4D7CFE" : "rgba(255,255,255,0.03)" }}
            >
              {sel ? <Check size={10} strokeWidth={2.4} /> : null}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[12.5px] font-medium text-[#D6DCE8]">{t.subject}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[9.5px] text-faint">{t.id}</span>
                <span className="flex items-center gap-1 text-[10px]" style={{ color: st.color }}>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: st.color }} />
                  <span>{st.label}</span>
                </span>
              </span>
            </div>
            <span className="truncate text-[12px] text-ink-3">{t.customer.name}</span>
            <span className="flex items-center gap-[5px] text-[11px] text-ink-4">
              <span className="flex text-muted"><ChannelIcon channel={t.channel} /></span>
              <span>{t.channel}</span>
            </span>
            <span><PriorityBadge priority={t.priority} fontSize={11} /></span>
            <span className="flex min-w-0 items-center gap-1.5">
              <AgentAvatar name={t.assignee} size={18} />
              <span className="truncate text-[11.5px] text-ink-4">{t.assignee ?? "Unassigned"}</span>
            </span>
            <span className="text-right"><ConfidenceValue conf={t.conf} fontSize={11} /></span>
            <span className="text-right font-mono text-[10.5px] text-muted">{t.time}</span>
          </div>
        );
      })}
    </div>
  );
}
