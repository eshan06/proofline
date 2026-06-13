/**
 * Real document text for the seeded knowledge base. The ingestion pipeline
 * chunks + embeds these so retrieval (pgvector cosine search) has genuine
 * content to find. Aligned with the citation snippets in the seed tickets so
 * the AI's "grounded in N sources" story holds against real retrieval.
 *
 * Keyed by the KB doc id (kb-1 … kb-7). kb-8 (SSO guide) has NO content — it
 * failed to index — which is exactly why the copilot refuses SSO questions.
 */
export const KB_CORPUS: Record<string, { title: string; sections: { path: string; text: string }[] }> = {
  "kb-1": {
    title: "Getting started",
    sections: [
      {
        path: "Inviting your team",
        text: "Workspace admins can invite members from Settings → Team → Invite member. Enter their email addresses, choose a role (Admin, Agent, or Viewer), and Proofline sends an invite link that expires after 7 days. On the Free plan you can invite up to 3 teammates; Growth and Scale allow unlimited seats.",
      },
      {
        path: "First setup",
        text: "After signing up, connect at least one channel and upload your help docs so the AI has sources to cite. Most teams are live within five minutes — the chat widget is a single snippet, and Gmail and Slack connect over OAuth.",
      },
    ],
  },
  "kb-2": {
    title: "Billing & Plans",
    sections: [
      {
        path: "Plan upgrades → Sync delays",
        text: "Upgrades can take up to 30 minutes to propagate to a workspace after payment succeeds. If a customer was charged but still sees the Free plan, the upgrade simply has not synced yet. Agents can force a refresh from Admin → Subscriptions → Resync; this is safe to run at any time.",
      },
      {
        path: "Seats and pricing",
        text: "Growth is $49 per seat per month with unlimited AI drafts. Scale is custom-priced annually and adds enterprise authentication, provisioning, audit logs, and data residency controls for larger teams.",
      },
    ],
  },
  "kb-3": {
    title: "Refund policy",
    sections: [
      {
        path: "Duplicate charges",
        text: "Duplicate charges are refunded in full to the original payment method within 5–10 business days, depending on the customer's bank. A credit note is generated automatically and emailed to the billing contact. Agents may issue refunds up to $250 without approval; larger refunds require a manager.",
      },
    ],
  },
  "kb-4": {
    title: "Bug response playbook",
    sections: [
      {
        path: "Confirmed bugs",
        text: "When a bug is reproduced, acknowledge the repro to the customer, share the internal tracking reference, and offer to notify them automatically on release. Never promise a specific ship date unless engineering has committed to one; use 'in progress' or 'expected this week' instead.",
      },
    ],
  },
  "kb-5": {
    title: "Stripe sync runbook",
    sections: [
      {
        path: "Webhooks → Retry queue",
        text: "If checkout.session.completed events back up in the retry queue, the workspace plan may lag behind billing state. A manual resync from Admin → Subscriptions is safe and idempotent. The retry worker has a known race that can occasionally produce duplicate invoices; refund the newer invoice and link both references in the resolution.",
      },
    ],
  },
  "kb-6": {
    title: "Slack integration guide",
    sections: [
      {
        path: "Troubleshooting → Missing notifications",
        text: "After a Slack workspace update, channel-level app membership can be revoked, which stops Proofline notifications in that specific channel while others keep working. Re-inviting the app with /invite @Proofline in the affected channel restores delivery. If alerts do not resume within a minute, escalate to the integrations team with the workspace ID.",
      },
    ],
  },
  "kb-7": {
    title: "Known issues",
    sections: [
      {
        path: "Dashboard → Charts",
        text: "Chart queries on workspaces with more than 10,000 events may time out, leaving the ticket volume chart stuck on a loading spinner. The customer's data is unaffected — only the chart view. A fix is tracked in LIN-482 and is expected this week.",
      },
    ],
  },
};
