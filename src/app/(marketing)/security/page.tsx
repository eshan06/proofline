import { MarketingPage, H2 } from "@/components/marketing/marketing-page";

export const metadata = { title: "Security — Proofline" };

export default function SecurityPage() {
  return (
    <MarketingPage title="Security" updated="June 13, 2026">
      <p>Security is foundational to a product whose whole promise is evidence. Here&rsquo;s how we protect your data.</p>
      <H2>Data protection</H2>
      <p>All traffic is encrypted in transit (TLS). Data is encrypted at rest. Passwords are hashed with a salted, memory-hard function — never stored in plaintext. Sessions are httpOnly, secure cookies.</p>
      <H2>Tenant isolation</H2>
      <p>Every record is scoped to a workspace, and all access is authorized server-side against your membership. One workspace can never read another&rsquo;s data.</p>
      <H2>Application hardening</H2>
      <p>A strict Content-Security-Policy, clickjacking and MIME-sniffing protections, and per-endpoint rate limiting are enforced on every response. The AI abstains when it lacks grounding, so it never fabricates customer-facing claims.</p>
      <H2>Access &amp; audit</H2>
      <p>Role-based access (Admin / Agent / Viewer) governs what each member can do. Security-relevant actions are recorded in an audit log. Scale customers can enforce SSO and review residency controls.</p>
      <H2>Reporting</H2>
      <p>Found a vulnerability? Email security@proofline.com — we respond promptly and credit responsible disclosure.</p>
    </MarketingPage>
  );
}
