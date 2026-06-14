"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useWorkspace, useWorkspaceMutation, WORKSPACE_KEY } from "@/hooks/use-workspace";
import { useEscToClose } from "@/hooks/use-esc";
import { api } from "@/lib/api-client";
import { toast } from "@/stores/toasts";
import { agents } from "@/data/workspace";
import { billingUsage, type UsageStat } from "@/lib/metrics";
import type { AuditEvent, Member, MemberRole, Subscription } from "@/lib/schemas";

const TABS = [
  ["team", "Team"],
  ["workspace", "Workspace"],
  ["billing", "Billing"],
  ["audit", "Audit log"],
] as const;
type Tab = (typeof TABS)[number][0];

const AUDIT_FILTERS = ["All", "AI", "Team", "Integrations", "Security"] as const;
const AUDIT_TYPE_COLOR: Record<AuditEvent["type"], string> = {
  AI: "#9DB7FF",
  Team: "#C4B0F8",
  Integrations: "#F5B74E",
  Security: "#F36C6C",
};

const PERM_ROWS: [string, string, string, string][] = [
  ["View & reply to tickets", "✓", "✓", "—"],
  ["Approve AI drafts", "✓", "✓", "—"],
  ["Edit knowledge base", "✓", "✓", "—"],
  ["Manage automations", "✓", "—", "—"],
  ["Billing & members", "✓", "—", "—"],
];

export function SettingsView({ tab }: { tab: Tab }) {
  const router = useRouter();
  const { data: ws } = useWorkspace();
  const members = ws?.members ?? [];
  const audit = ws?.audit ?? [];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [auditFilter, setAuditFilter] = useState<(typeof AUDIT_FILTERS)[number]>("All");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[880px] px-8 pb-10 pt-[26px]">
        <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Settings</div>
        <div className="mt-4 flex gap-1 border-b border-white/7">
          {TABS.map(([key, label]) => {
            const sel = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => router.push(`/settings/${key}`)}
                className="-mb-px border-0 border-b-2 bg-transparent px-3.5 py-2 text-[12.5px] font-medium hover:text-ink"
                style={{ borderBottomColor: sel ? "#4D7CFE" : "transparent", color: sel ? "#E6EAF2" : "#8A93A6" }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "team" ? <TeamTab members={members} onInvite={() => setInviteOpen(true)} /> : null}
        {tab === "workspace" ? <WorkspaceTab initialName={ws?.name ?? "Acme Inc"} /> : null}
        {tab === "billing" ? <BillingTab subscription={ws?.subscription} usage={ws ? billingUsage(ws) : []} /> : null}
        {tab === "audit" ? <AuditTab audit={audit} filter={auditFilter} setFilter={setAuditFilter} /> : null}
      </div>

      {inviteOpen ? <InviteModal onClose={() => setInviteOpen(false)} /> : null}
    </div>
  );
}

function TeamTab({ members, onInvite }: { members: Member[]; onInvite: () => void }) {
  return (
    <div className="mt-[18px] flex flex-col gap-3.5" style={{ animation: "plFade 0.2s ease" }}>
      <div className="overflow-hidden rounded-[11px] border border-white/7 bg-card">
        <div className="flex items-center border-b border-white/6 px-4 py-3">
          <span className="text-[13px] font-semibold text-ink">Members</span>
          <button type="button" onClick={onInvite} className="ml-auto flex items-center gap-1.5 rounded-[7px] border-0 bg-accent px-3 py-[5.5px] text-[11.5px] font-semibold text-white hover:bg-accent-hover">
            <Plus size={13} strokeWidth={1.4} /> Invite member
          </button>
        </div>
        {members.map((m) => {
          const ag = agents[m.name.split(" ")[0] as keyof typeof agents];
          return (
            <div key={m.email} className="flex items-center gap-[11px] border-b border-white/[0.04] px-4 py-[11px]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: ag?.bg ?? "rgba(77,124,254,0.12)", color: ag?.fg ?? "#9DB7FF" }}>{m.init}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[12.5px] font-medium text-ink">{m.name}</span>
                <span className="text-[11px] text-muted">{m.email}</span>
              </div>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: m.status === "Active" ? "#3DD68C" : "#F5B74E" }}>
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: m.status === "Active" ? "#3DD68C" : "#F5B74E" }} />
                <span>{m.status}</span>
              </span>
              <button type="button" onClick={() => toast("Role editor")} className="flex items-center gap-1.5 rounded-full border border-white/9 bg-white/4 px-[11px] py-[3px] text-[11px] text-ink-2 hover:border-accent/50">
                <span>{m.role}</span><span className="text-[8px] text-muted">▾</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[11px] border border-white/7 bg-card">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2.5 border-b border-white/7 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          <span>Permission</span><span className="text-center">Admin</span><span className="text-center">Agent</span><span className="text-center">Viewer</span>
        </div>
        {PERM_ROWS.map((p) => (
          <div key={p[0]} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2.5 border-b border-white/[0.04] px-4 py-[9px]">
            <span className="text-[12px] text-ink-3">{p[0]}</span>
            <span className="text-center font-mono text-[11px]" style={{ color: p[1] === "✓" ? "#3DD68C" : "#444B5C" }}>{p[1]}</span>
            <span className="text-center font-mono text-[11px]" style={{ color: p[2] === "✓" ? "#3DD68C" : "#444B5C" }}>{p[2]}</span>
            <span className="text-center font-mono text-[11px]" style={{ color: p[3] === "✓" ? "#3DD68C" : "#444B5C" }}>{p[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceTab({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await api.renameWorkspace(trimmed);
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      toast("Workspace name updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update workspace");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (confirmDelete !== "DELETE") return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      window.location.href = "/signin";
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete workspace");
      setDeleting(false);
    }
  };

  return (
    <div className="mt-[18px] flex max-w-[520px] flex-col gap-3.5" style={{ animation: "plFade 0.2s ease" }}>
      <div className="flex flex-col gap-3 rounded-[11px] border border-white/7 bg-card px-[18px] py-4">
        <span className="text-[13px] font-semibold text-ink">Workspace</span>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-ink-4">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[12.5px] text-ink" />
        </div>
        <button type="button" disabled={saving || !name.trim() || name.trim() === initialName} onClick={saveName} className="self-start rounded-[7px] border-0 bg-accent px-4 py-[7px] text-[12px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
      </div>

      <div className="flex items-center gap-3 rounded-[11px] border border-white/7 bg-card px-[18px] py-4">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[12.5px] font-semibold text-ink">Export your data</span>
          <span className="text-[11.5px] text-ink-4">Download everything in this workspace as JSON.</span>
        </div>
        <a href="/api/account/export" className="rounded-[7px] border border-white/10 bg-white/4 px-[13px] py-1.5 text-[11.5px] font-medium text-ink-2 no-underline hover:border-accent/50 hover:text-accent-soft">Export ↓</a>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[11px] border border-danger/25 bg-card px-[18px] py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12.5px] font-semibold text-danger-soft">Delete workspace</span>
          <span className="text-[11.5px] text-ink-4">Permanently removes all tickets, docs, members, and your account. This cannot be undone — type <span className="font-mono text-ink-3">DELETE</span> to confirm.</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="DELETE"
            className="pl-focus w-[120px] rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-1.5 font-mono text-[12px] text-ink"
          />
          <button
            type="button"
            disabled={confirmDelete !== "DELETE" || deleting}
            onClick={doDelete}
            className="rounded-[7px] border border-danger/40 bg-transparent px-[13px] py-1.5 text-[11.5px] font-medium text-danger hover:bg-danger/[0.08] disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BillingTab({ subscription, usage }: { subscription?: Subscription; usage: UsageStat[] }) {
  const plan = subscription?.plan ?? "Growth";
  const used = subscription?.seatsUsed ?? 0;
  const limit = subscription?.seatLimit ?? 0;
  const status = subscription?.status ?? "active";
  const isScale = plan === "Scale";
  return (
    <div className="mt-[18px] flex flex-col gap-3.5" style={{ animation: "plFade 0.2s ease" }}>
      <div className="flex items-center gap-3.5 rounded-[11px] border border-accent/30 px-[18px] py-4" style={{ background: "linear-gradient(170deg, rgba(77,124,254,0.08), rgba(77,124,254,0.015)), #0F141E" }}>
        <div className="flex flex-1 flex-col gap-[3px]">
          <span className="text-[14px] font-semibold text-ink">{plan} plan{status !== "active" ? ` · ${status}` : ""}</span>
          <span className="text-[11.5px] text-ink-4">{used} of {limit} seats used{subscription?.currentPeriodEnd ? ` · renews ${subscription.currentPeriodEnd}` : ""}</span>
        </div>
        {!isScale ? (
          <button
            type="button"
            onClick={async () => {
              try {
                const { url } = await api.checkout("scale");
                window.location.href = url;
              } catch {
                toast("Could not start checkout — try again");
              }
            }}
            className="rounded-[7px] border border-white/10 bg-white/5 px-[13px] py-1.5 text-[11.5px] font-medium text-ink-2 hover:border-accent/50 hover:text-accent-soft"
          >
            Upgrade to Scale
          </button>
        ) : (
          <span className="rounded-full bg-success/[0.1] px-[10px] py-1 text-[11px] text-success">Top tier</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {usage.map((u) => (
          <div key={u.label} className="flex flex-col gap-2 rounded-[11px] border border-white/7 bg-card px-[15px] py-[13px]">
            <span className="text-[11px] text-muted">{u.label}</span>
            <span className="font-mono text-[15px] font-semibold text-ink">{u.value}</span>
            {u.ratio != null ? (
              <div className="h-1 overflow-hidden rounded-full bg-white/6">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(u.ratio * 100)}%` }} />
              </div>
            ) : (
              <span className="text-[10px] text-faint">all-time</span>
            )}
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-[11px] border border-white/7 bg-card">
        <div className="flex items-center border-b border-white/6 px-4 py-3">
          <span className="text-[13px] font-semibold text-ink">Invoices</span>
        </div>
        <div className="px-4 py-5 text-[12px] leading-[1.6] text-muted">
          Invoices and payment methods are managed in Stripe. Once your first
          payment is processed they’ll appear in your Stripe billing portal.
        </div>
      </div>
    </div>
  );
}

function AuditTab({
  audit,
  filter,
  setFilter,
}: {
  audit: AuditEvent[];
  filter: (typeof AUDIT_FILTERS)[number];
  setFilter: (f: (typeof AUDIT_FILTERS)[number]) => void;
}) {
  const rows = audit.filter((a) => filter === "All" || a.type === filter);
  return (
    <div className="mt-[18px] flex flex-col gap-3" style={{ animation: "plFade 0.2s ease" }}>
      <div className="flex gap-1.5">
        {AUDIT_FILTERS.map((f) => {
          const sel = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="rounded-full border px-3 py-[3.5px] text-[11.5px] font-medium hover:border-accent/55"
              style={{ borderColor: sel ? "rgba(77,124,254,0.5)" : "rgba(255,255,255,0.08)", background: sel ? "rgba(77,124,254,0.14)" : "rgba(255,255,255,0.03)", color: sel ? "#9DB7FF" : "#8A93A6" }}
            >
              {f}
            </button>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-[11px] border border-white/7 bg-card">
        {rows.map((a, i) => (
          <div key={i} className="flex items-center gap-[11px] border-b border-white/[0.04] px-4 py-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-ink-4">
              {a.user === "System" ? "◆" : a.user[0]}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-[12px] text-[#D6DCE8]">{a.action}</span>
              <span className="text-[10.5px] text-muted">{a.user}</span>
            </div>
            <span className="shrink-0 rounded-full border border-white/8 px-[9px] py-[1.5px] text-[10px] font-medium" style={{ color: AUDIT_TYPE_COLOR[a.type] }}>{a.type}</span>
            <span className="w-[105px] shrink-0 text-right font-mono text-[10px] text-faint">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("Agent");
  useEscToClose(onClose);
  const invite = useWorkspaceMutation<{ email: string; role: MemberRole }>({
    mutationFn: (vars) => api.inviteMember(vars),
    onSuccessToast: ({ email }) => `Invite sent to ${email}`,
  });

  const send = async () => {
    const em = email.trim();
    if (!em || !em.includes("@")) {
      toast("Enter a valid email address");
      return;
    }
    try {
      // Close only on success — on failure useWorkspaceMutation toasts the error
      // and we keep the modal open with the entered values.
      await invite.mutateAsync({ email: em, role });
      onClose();
    } catch {
      /* error surfaced via the mutation's onError toast; modal stays open */
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-85 flex items-center justify-center backdrop-blur-[5px]" style={{ background: "rgba(5,7,11,0.62)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Invite member"
        className="flex w-[380px] flex-col gap-3.5 rounded-[14px] border border-white/12 bg-raised p-5"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.7)", animation: "plFade 0.16s ease" }}
      >
        <div className="flex items-center">
          <span className="text-[14px] font-semibold text-ink">Invite member</span>
          <button type="button" onClick={onClose} className="ml-auto border-0 bg-transparent text-[15px] text-muted hover:text-ink">×</button>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-ink-4">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@acme.io" className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-3 py-2 text-[12.5px] text-ink" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-ink-4">Role</span>
          <div className="flex gap-1.5">
            {(["Admin", "Agent", "Viewer"] as MemberRole[]).map((r) => {
              const sel = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="flex-1 rounded-[7px] border py-1.5 text-[12px] font-medium"
                  style={{ borderColor: sel ? "rgba(77,124,254,0.5)" : "rgba(255,255,255,0.08)", background: sel ? "rgba(77,124,254,0.14)" : "rgba(255,255,255,0.03)", color: sel ? "#9DB7FF" : "#8A93A6" }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={send} disabled={invite.isPending} className="rounded-[8px] border-0 bg-accent py-[9px] text-[12.5px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60" style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}>
          {invite.isPending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </div>
  );
}
