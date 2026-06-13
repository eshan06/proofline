import { MarketingPage, H2 } from "@/components/marketing/marketing-page";

export const metadata = { title: "Privacy Policy — Proofline" };

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy Policy" updated="June 13, 2026">
      <p className="rounded-[8px] border border-warning/30 bg-warning/[0.06] px-4 py-3 text-[12.5px] text-warning-soft">
        Template — review with counsel before launch. This describes how the product is built to handle data; it is not yet legal advice.
      </p>
      <p>Proofline (&ldquo;we&rdquo;) helps support teams draft grounded, cited replies. This policy explains what we collect, why, and the choices you have.</p>
      <H2>What we collect</H2>
      <p>Account data (name, email, hashed password), workspace content you create or connect (tickets, messages, knowledge-base documents), and product telemetry (feature usage, performance). We do not sell personal data.</p>
      <H2>How the AI uses your data</H2>
      <p>Drafts are generated only from your own knowledge base. Retrieved passages and the customer question are sent to the configured model provider to produce a draft; we do not use your content to train foundation models. When no grounded source exists, the AI abstains rather than guessing.</p>
      <H2>Sub-processors</H2>
      <p>We use infrastructure, model, email, and billing providers to operate the service. A current list is available on request and maintained for enterprise (Scale) customers under a Data Processing Agreement.</p>
      <H2>Retention &amp; deletion</H2>
      <p>Workspace data persists until you delete it or close your workspace. You may request export or deletion of your data at any time; deletion is propagated to sub-processors.</p>
      <H2>Your rights</H2>
      <p>Subject to applicable law (including GDPR and CCPA), you may access, correct, export, or delete your personal data. Contact privacy@proofline.com.</p>
    </MarketingPage>
  );
}
