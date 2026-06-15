import { MarketingPage, H2 } from "@/components/marketing/marketing-page";

export const metadata = { title: "Terms of Service — Proofline" };

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of Service" updated="June 2026">
      <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
      <p>By using Proofline you agree to these terms. If you use it on behalf of an organization, you accept on its behalf.</p>
      <H2>Beta / early access</H2>
      <p>Proofline is currently in early access. Features, limits, and pricing may change. We may invite additional users, expand access, or adjust the product during this period without prior notice. Early-access customers receive direct support and an opportunity to shape the roadmap. We appreciate your feedback.</p>
      <H2>The service</H2>
      <p>Proofline drafts support replies grounded in your knowledge base, with a human approving every send. Drafts are suggestions — you are responsible for reviewing and approving anything sent to your customers. The human-in-the-loop step is a core part of how the product works, not optional.</p>
      <H2>Plans &amp; billing</H2>
      <p>Paid plans are billed per seat, per month or year depending on the plan selected. Charges recur until cancelled. You can change or cancel your plan at any time from Settings &rarr; Billing; access continues through the end of the paid period. No partial-month refunds are issued for mid-cycle cancellations unless required by law.</p>
      <H2>Acceptable use</H2>
      <p>You must not use Proofline to send unlawful, deceptive, or abusive content; to bypass rate limits or quotas; to reverse-engineer or scrape the service; or to share access credentials with unauthorized users. We may suspend or terminate accounts that violate this policy, with or without prior notice depending on severity.</p>
      <H2>Your content</H2>
      <p>You own the content you bring into Proofline. By connecting data sources you grant us a limited licence to process that content solely to provide the service. We do not claim ownership of your knowledge base, tickets, or workspace data.</p>
      <H2>Warranty &amp; liability</H2>
      <p>The service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; AI drafts may contain errors; the human-approval step exists for that reason. We make reasonable efforts to maintain uptime but do not guarantee it. To the extent permitted by applicable law, our liability is limited to the fees you paid in the 12 months preceding the claim.</p>
      <H2>Changes to these terms</H2>
      <p>We may update these terms. Material changes will be announced in-product and on the changelog at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.</p>
      <H2>Contact</H2>
      <p>Questions about these terms? Email <a href="mailto:hello@proofline.com" className="underline">hello@proofline.com</a>.</p>
    </MarketingPage>
  );
}
