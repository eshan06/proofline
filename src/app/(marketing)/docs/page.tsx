import Link from "next/link";
import { MarketingPage, H2 } from "@/components/marketing/marketing-page";

export const metadata = { title: "Docs — Proofline" };

export default function DocsPage() {
  return (
    <MarketingPage title="Documentation">
      <p>Everything you need to get Proofline answering with proof. Full guides live here in production; this is the orientation.</p>
      <H2>Quickstart</H2>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>Create your workspace and invite your team from Settings → Team.</li>
        <li>Connect a channel (website chat, Gmail, or Slack) from Integrations.</li>
        <li>Upload your help docs and runbooks in the Knowledge Base — they become citable sources.</li>
        <li>Review AI drafts in the Inbox: every reply arrives cited and confidence-scored. Approve, edit, or escalate.</li>
      </ol>
      <H2>How drafting works</H2>
      <p>For each ticket, Proofline retrieves the most relevant passages from your knowledge base, drafts a reply grounded only in those passages, attaches citations, and scores its confidence. Below your threshold, drafts are held for review; with no grounded source, the AI abstains.</p>
      <H2>Automations</H2>
      <p>Build rules from triggers (new ticket, low confidence, keyword), conditions (channel, tag, plan, priority), and actions (escalate, tag, notify, assign). Every run is logged.</p>
      <H2>Try it now</H2>
      <p><Link href="/demo" className="text-accent no-underline hover:text-accent-hover">Open the interactive demo →</Link></p>
    </MarketingPage>
  );
}
