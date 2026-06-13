import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata = { title: "Status — Proofline" };

const components = [
  { name: "Web app", status: "Operational" },
  { name: "API", status: "Operational" },
  { name: "AI drafting", status: "Operational" },
  { name: "Knowledge-base ingestion", status: "Operational" },
  { name: "Email & Slack channels", status: "Operational" },
];

export default function StatusPage() {
  return (
    <MarketingPage title="System status">
      <div className="flex items-center gap-2.5 rounded-[10px] border border-success/30 bg-success/[0.06] px-4 py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-success" style={{ boxShadow: "0 0 8px rgba(61,214,140,0.6)" }} />
        <span className="text-[14px] font-semibold text-success">All systems operational</span>
      </div>
      <div className="mt-2 flex flex-col overflow-hidden rounded-[11px] border border-white/8">
        {components.map((c, i) => (
          <div key={c.name} className="flex items-center justify-between px-4 py-3" style={{ borderTop: i ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
            <span className="text-[13.5px] text-ink-2">{c.name}</span>
            <span className="flex items-center gap-1.5 text-[12.5px] text-success">
              <span className="h-[6px] w-[6px] rounded-full bg-success" />
              {c.status}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-muted">Incident history and subscribe-to-updates are wired through the status provider in production.</p>
    </MarketingPage>
  );
}
