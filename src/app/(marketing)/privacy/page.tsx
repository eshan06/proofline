import { MarketingPage, H2 } from "@/components/marketing/marketing-page";

export const metadata = { title: "Privacy Policy — Proofline" };

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy Policy" updated="June 2026">
      <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
      <p>Proofline (&ldquo;we&rdquo;) helps support teams draft grounded, cited replies. This policy explains what we collect, why, and the choices you have.</p>
      <H2>What we collect</H2>
      <p>We collect account data (name, work email, hashed password), workspace content you create or connect (tickets, messages, knowledge-base documents), and product telemetry (feature usage, error events, performance metrics). We do not sell personal data to third parties.</p>
      <H2>How the AI uses your data</H2>
      <p>Drafts are generated only from your own knowledge base. Retrieved passages and the customer question are sent to the configured model provider to produce a draft. We do not use your content to train foundation models, and we do not share your workspace content across customer accounts. When no grounded source exists, the AI abstains rather than guessing.</p>
      <H2>Data processing</H2>
      <p>We process data on your behalf as a data processor when you connect external systems (ticketing, messaging, knowledge base). You remain the data controller for any personal data belonging to your customers or end users. Enterprise (Scale) customers can sign a Data Processing Agreement that governs these relationships explicitly. For GDPR purposes, our lawful basis for processing is the performance of a contract. California residents have rights under CCPA as described in &ldquo;Your rights&rdquo; below.</p>
      <H2>Sub-processors</H2>
      <p>We use infrastructure, AI model, email, and billing providers to operate the service. A current list of sub-processors is available on request and is maintained for enterprise customers under a Data Processing Agreement. We require sub-processors to maintain appropriate data protection standards.</p>
      <H2>Retention &amp; deletion</H2>
      <p>Workspace data persists until you delete it or close your workspace. You may request export or deletion of your data at any time by contacting us; deletion is propagated to sub-processors within 30 days. Aggregated, anonymised telemetry may be retained for product analytics after deletion.</p>
      <H2>Cookies &amp; tracking</H2>
      <p>We use strictly necessary cookies to keep you signed in and to prevent cross-site request forgery. We use product analytics (first-party) to understand how the product is used. We do not use advertising trackers or sell behavioural data.</p>
      <H2>Your rights</H2>
      <p>Subject to applicable law — including the EU/UK GDPR and the California Consumer Privacy Act (CCPA) — you may access, correct, export, restrict processing of, or delete your personal data. To exercise any of these rights, contact <a href="mailto:privacy@proofline.com" className="underline">privacy@proofline.com</a>. We aim to respond within 30 days.</p>
      <H2>Contact</H2>
      <p>Questions about this policy? Email <a href="mailto:privacy@proofline.com" className="underline">privacy@proofline.com</a>.</p>
    </MarketingPage>
  );
}
