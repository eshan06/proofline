"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { useCreateAutomation, useToggleAutomation } from "@/hooks/use-automations";
import { builderActions, builderConditions, builderTriggers } from "@/data/workspace";
import type { Automation } from "@/lib/schemas";

export function AutomationsView() {
  const { data: ws } = useWorkspace();
  const automations = ws?.automations ?? [];
  const toggle = useToggleAutomation();
  const create = useCreateAutomation();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [trig, setTrig] = useState(0);
  const [cond, setCond] = useState(0);
  const [act, setAct] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(automations[0]?.id ?? null);

  const save = () => {
    create.mutate({
      trigger: builderTriggers[trig]!,
      conds: [builderConditions[cond]!],
      acts: [builderActions[act]!],
    });
    setBuilderOpen(false);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[880px] px-8 pb-10 pt-[26px]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Automations</div>
            <div className="text-[12px] text-muted">Rules that run before a human ever sees the ticket</div>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setBuilderOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-[7px] border-0 bg-accent px-[13px] py-[7px] text-[12px] font-semibold text-white hover:bg-accent-hover"
            style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
          >
            <Plus size={13} strokeWidth={1.4} />
            <span>{builderOpen ? "Cancel" : "New automation"}</span>
          </button>
        </div>

        {builderOpen ? (
          <div
            className="mt-4 flex flex-col gap-3.5 rounded-[12px] border border-accent/30 p-4 px-[18px] py-[17px]"
            style={{ background: "linear-gradient(170deg, rgba(77,124,254,0.06), rgba(77,124,254,0.01)), #0F141E", animation: "plFade 0.2s ease" }}
          >
            <BuilderRow label="When" color="#9DB7FF" options={builderTriggers} value={trig} onChange={setTrig} />
            <BuilderRow label="If" color="#F5B74E" options={builderConditions} value={cond} onChange={setCond} />
            <BuilderRow label="Then" color="#3DD68C" options={builderActions} value={act} onChange={setAct} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={save}
                className="rounded-[7px] border-0 bg-accent px-4 py-[7px] text-[12px] font-semibold text-white hover:bg-accent-hover"
              >
                Save automation
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2.5">
          {automations.map((a) => (
            <AutomationRow
              key={a.id}
              automation={a}
              open={expanded === a.id}
              onExpand={() => setExpanded((e) => (e === a.id ? null : a.id))}
              onToggle={() => toggle.mutate({ id: a.id, name: a.name, enabled: !a.enabled })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BuilderRow({
  label,
  color,
  options,
  value,
  onChange,
}: {
  label: string;
  color: string;
  options: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, i) => {
          const sel = i === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(i)}
              className="rounded-full border px-3 py-[4.5px] text-[11.5px] hover:border-accent/55"
              style={{
                borderColor: sel ? "rgba(77,124,254,0.5)" : "rgba(255,255,255,0.08)",
                background: sel ? "rgba(77,124,254,0.14)" : "rgba(255,255,255,0.03)",
                color: sel ? "#9DB7FF" : "#8A93A6",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PipeChip({ text, color, bg, bd }: { text: string; color: string; bg: string; bd: string }) {
  return (
    <span className="rounded-full border px-[11px] py-[3px] text-[11px]" style={{ color, background: bg, borderColor: bd }}>
      {text}
    </span>
  );
}

function AutomationRow({
  automation: a,
  open,
  onExpand,
  onToggle,
}: {
  automation: Automation;
  open: boolean;
  onExpand: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[11px] border border-white/7 bg-card">
      <div onClick={onExpand} className="flex cursor-pointer items-center gap-3 px-4 py-[13px] hover:bg-white/2">
        <ToggleSwitch on={a.enabled} onToggle={onToggle} label={`Toggle ${a.name}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px] font-semibold text-ink">{a.name}</span>
          <span className="text-[11px] text-muted">{a.trigger}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: a.enabled ? "#3DD68C" : "#5C6478" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.enabled ? "#3DD68C" : "#5C6478" }} />
          <span>{a.enabled ? "Active" : "Paused"}</span>
        </span>
        <span className="font-mono text-[10.5px] text-muted">{a.runs} runs · {a.last}</span>
        <span className="text-[9px] text-muted transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>
      {open ? (
        <div className="flex flex-col gap-[13px] border-t border-white/6 px-4 py-3.5" style={{ animation: "plFade 0.2s ease" }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <PipeChip text={a.trigger} color="#9DB7FF" bg="rgba(77,124,254,0.1)" bd="rgba(77,124,254,0.3)" />
            {a.conds.map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted">→</span>
                <PipeChip text={c} color="#F5B74E" bg="rgba(245,183,78,0.06)" bd="rgba(245,183,78,0.3)" />
              </span>
            ))}
            {a.acts.map((ac) => (
              <span key={ac} className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted">→</span>
                <PipeChip text={ac} color="#3DD68C" bg="rgba(61,214,140,0.06)" bd="rgba(61,214,140,0.3)" />
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Recent runs</span>
            {a.log.length === 0 ? (
              <span className="text-[11.5px] text-muted">No runs yet — this rule will log its executions here.</span>
            ) : (
              a.log.map((l, i) => (
                <div key={i} className="flex items-center gap-[9px] text-[11.5px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.ok ? "#3DD68C" : "#F5B74E" }} />
                  <span className="w-[72px] shrink-0 font-mono text-[10px] text-muted">{l.time}</span>
                  <span className="text-ink-3">{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
