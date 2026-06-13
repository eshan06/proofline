import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata = { title: "Changelog — Proofline" };

const entries = [
  { date: "Jun 2026", tag: "New", items: ["Grounded RAG drafting with pgvector retrieval and per-claim citations", "Confidence scoring with an explicit refusal when sources are missing"] },
  { date: "Jun 2026", tag: "New", items: ["Workspaces, roles, and email/password auth", "Self-serve demo sandbox with a guided checklist"] },
  { date: "May 2026", tag: "Improved", items: ["Automations builder: triggers, conditions, actions, and a run log", "Analytics with 7/14/30-day ranges and AI-acceptance trends"] },
];

export default function ChangelogPage() {
  return (
    <MarketingPage title="Changelog">
      <div className="flex flex-col gap-7">
        {entries.map((e, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[12px] text-muted">{e.date}</span>
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-accent-soft">{e.tag}</span>
            </div>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {e.items.map((it, j) => (
                <li key={j} className="text-[13.5px] text-ink-3">{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </MarketingPage>
  );
}
