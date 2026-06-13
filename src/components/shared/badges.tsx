import { priorityMap } from "@/lib/maps";
import { confidenceChipBg, confidenceColor, confidencePercent } from "@/lib/confidence";
import type { Priority } from "@/lib/schemas";

/** Colored 6px square + label (Urgent red / High amber / Medium blue / Low gray). */
export function PriorityBadge({ priority, fontSize = 10.5 }: { priority: Priority; fontSize?: number }) {
  const pr = priorityMap[priority];
  return (
    <span className="flex items-center gap-1 font-medium" style={{ fontSize, color: pr.color }}>
      <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: pr.color }} />
      <span>{pr.label}</span>
    </span>
  );
}

/** Mono "AI 92%" chip in the confidence color, tinted background. */
export function ConfidenceChip({ conf }: { conf: number | null }) {
  if (conf == null) return null;
  return (
    <span
      className="rounded-[4px] px-1.5 py-px font-mono text-[10px]"
      style={{ color: confidenceColor(conf), background: confidenceChipBg(conf) }}
    >
      AI {confidencePercent(conf)}
    </span>
  );
}

/** Plain mono confidence percent (board cards, table column). */
export function ConfidenceValue({ conf, fontSize = 9.5 }: { conf: number | null; fontSize?: number }) {
  return (
    <span className="font-mono" style={{ fontSize, color: conf != null ? confidenceColor(conf) : "#444B5C" }}>
      {conf != null ? confidencePercent(conf) : "—"}
    </span>
  );
}
