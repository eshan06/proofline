import { MarketingPage, H2 } from "@/components/marketing/marketing-page";

export const metadata = { title: "Terms of Service — Proofline" };

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of Service" updated="June 13, 2026">
      <p className="rounded-[8px] border border-warning/30 bg-warning/[0.06] px-4 py-3 text-[12.5px] text-warning-soft">
        Template — review with counsel before launch.
      </p>
      <p>By using Proofline you agree to these terms. If you use it on behalf of an organization, you accept on its behalf.</p>
      <H2>The service</H2>
      <p>Proofline drafts support replies grounded in your knowledge base, with a human approving every send. Drafts are suggestions; you are responsible for what you send to your customers.</p>
      <H2>Plans &amp; billing</H2>
      <p>Paid plans are billed per seat. Charges recur until cancelled. You can change or cancel your plan from Settings → Billing; access continues through the paid period.</p>
      <H2>Acceptable use</H2>
      <p>Don&rsquo;t use Proofline to send unlawful, deceptive, or abusive content, to bypass rate limits, or to reverse-engineer the service. We may suspend accounts that do.</p>
      <H2>Warranty &amp; liability</H2>
      <p>The service is provided &ldquo;as is.&rdquo; AI drafts may contain errors; the human-approval step exists for that reason. To the extent permitted by law, our liability is limited to the fees you paid in the prior 12 months.</p>
      <H2>Changes</H2>
      <p>We may update these terms; material changes will be announced in-product and on the changelog.</p>
    </MarketingPage>
  );
}
