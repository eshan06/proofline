import type { Ticket } from "@/lib/schemas";

/**
 * Seed tickets — ported VERBATIM from the design prototype (`tickets` array in
 * Proofline App.dc.html). The content is intentional: it threads one coherent
 * story across pages (e.g. the failed SSO doc explains TKT-1024's missing
 * draft, the KB warning line, and the playground refusal).
 *
 * Board stages come from the prototype's `stageMap`; the two archived resolved
 * tickets (TKT-1019, TKT-1012) appear in Tickets views only.
 */

export const seedTickets: Ticket[] = [
  {
    id: "TKT-1042",
    customer: { name: "Ava Chen", company: "Northwind", initials: "AC", hue: 210 },
    channel: "web",
    subject: "Cannot access upgraded plan after payment",
    preview: "I upgraded to Growth 20 minutes ago and my card was charged, but…",
    priority: "urgent",
    tags: ["billing", "urgent"],
    status: "open",
    stage: "inprogress",
    assignee: "Eshan",
    slaMins: 18,
    slaTotal: 60,
    unread: true,
    time: "4m",
    conf: 0.92,
    archived: false,
    messages: [
      {
        id: "m-1042-1",
        kind: "customer",
        time: "12m ago",
        text: "Hi — I upgraded to the Growth plan 20 minutes ago and my card was charged, but the dashboard still says Free. My team can’t use seat invites. Can you fix this ASAP? We have onboarding tomorrow.",
      },
      {
        id: "m-1042-2",
        kind: "status",
        time: "",
        text: "Auto-tagged billing, urgent · routed to Billing by automation “Plan & payment issues”",
      },
      {
        id: "m-1042-3",
        kind: "note",
        author: "Maya",
        time: "8m ago",
        text: "Stripe shows the payment succeeded — looks like the webhook retry queue is backed up again. Same root cause as TKT-988.",
      },
    ],
    draft: {
      text: "Hi Ava — sorry about that! Your payment went through correctly; the plan upgrade just hasn’t synced to your workspace yet. This usually resolves within 30 minutes, but I’ve manually refreshed your subscription on our side — you should see Growth features (including seat invites) after a quick reload.\n\nYour receipt is on its way to your email. If anything still looks off before your onboarding tomorrow, reply here and we’ll jump on it immediately.",
      confidence: 0.92,
      confMeta: "Grounded in 2 sources · top similarity 0.93",
      citations: [
        {
          title: "Billing & Plans",
          path: "Plan upgrades → Sync delays",
          snippet: "Upgrades can take up to 30 minutes to propagate. Agents can force a refresh from Admin → Subscriptions → Resync.",
          uses: 132,
        },
        {
          title: "Stripe sync runbook",
          path: "Webhooks → Retry queue",
          snippet: "If checkout.session.completed events back up, the workspace plan may lag behind billing state. Manual resync is safe and idempotent.",
          uses: 41,
        },
      ],
      reasoning:
        "Matched the issue to a known plan-sync lag with high similarity across 2 sources. Verified from the thread that payment succeeded (internal note), chose the “manual resync” resolution path, and added a concrete time expectation because the customer mentioned a deadline.",
      actions: ["Insert refund macro", "Ask for account email", "Escalate to billing", "Mark as bug"],
      variant: "base",
      alternates: {
        base: "Hi Ava — sorry about that! Your payment went through correctly; the plan upgrade just hasn’t synced to your workspace yet. This usually resolves within 30 minutes, but I’ve manually refreshed your subscription on our side — you should see Growth features (including seat invites) after a quick reload.\n\nYour receipt is on its way to your email. If anything still looks off before your onboarding tomorrow, reply here and we’ll jump on it immediately.",
        regen:
          "Hi Ava — thanks for flagging this, and sorry for the scramble before your onboarding. The charge succeeded; the upgrade just hadn’t synced to your workspace. I’ve forced a resync, so Growth features and seat invites should appear after a reload. Your receipt will arrive by email shortly — ping me here if anything still looks off.",
        concise:
          "Hi Ava — your payment went through; the upgrade just hadn’t synced. I’ve refreshed it manually, so Growth features should appear after a reload. Reply here if anything still looks off before tomorrow.",
        empathetic:
          "Hi Ava — I completely understand the urgency with your onboarding tomorrow, and I’m sorry for the stress. The good news: your payment went through perfectly. The upgrade simply hadn’t synced to your workspace, so I’ve refreshed it manually — after a reload you should see all Growth features, including seat invites.\n\nI’ll keep an eye on this ticket until your event. Reply anytime and I’ll respond right away.",
      },
    },
  },
  {
    id: "TKT-1038",
    customer: { name: "Marcus Lee", company: "Lumen Labs", initials: "ML", hue: 280 },
    channel: "slack",
    subject: "Slack notification integration is broken",
    preview: "Our #support-alerts channel stopped getting notifications since…",
    priority: "high",
    tags: ["bug", "integration"],
    status: "open",
    stage: "new",
    assignee: null,
    slaMins: 42,
    slaTotal: 60,
    unread: true,
    time: "16m",
    conf: 0.58,
    archived: false,
    messages: [
      {
        id: "m-1038-1",
        kind: "customer",
        time: "16m ago",
        text: "Our #support-alerts channel stopped getting Proofline notifications since yesterday’s Slack workspace update. Re-installed the app, still nothing. Other channels work fine.",
      },
      {
        id: "m-1038-2",
        kind: "status",
        time: "",
        text: "Low-confidence draft · flagged for human review",
      },
    ],
    draft: {
      text: "Hi Marcus — thanks for the details. Since other channels still receive notifications, this looks scoped to #support-alerts. Could you check whether the Proofline app is still a member of that channel? Slack sometimes removes apps from channels during workspace updates. If it’s present, try /invite @Proofline once more — that re-grants the channel-level scope.\n\nIf that doesn’t restore alerts, I’ll escalate to our integrations team with your workspace logs.",
      confidence: 0.58,
      confMeta: "Grounded in 1 source · top similarity 0.64",
      citations: [
        {
          title: "Slack integration guide",
          path: "Troubleshooting → Missing notifications",
          snippet: "After Slack workspace updates, channel-level app membership can be revoked. Re-inviting the app restores delivery.",
          uses: 18,
        },
      ],
      reasoning:
        "Only one document matched above the similarity threshold, and the customer already tried a re-install — which weakens the standard fix. Confidence is low; a human should verify before sending or escalate to integrations.",
      actions: ["Escalate to integrations", "Ask for workspace ID", "Mark as bug", "Notify #eng-oncall"],
      variant: "base",
      alternates: {
        base: "Hi Marcus — thanks for the details. Since other channels still receive notifications, this looks scoped to #support-alerts. Could you check whether the Proofline app is still a member of that channel? Slack sometimes removes apps from channels during workspace updates. If it’s present, try /invite @Proofline once more — that re-grants the channel-level scope.\n\nIf that doesn’t restore alerts, I’ll escalate to our integrations team with your workspace logs.",
        regen:
          "Hi Marcus — appreciate the troubleshooting you’ve already done. Because only #support-alerts is affected, the likeliest cause is that the Slack update removed Proofline’s membership from that specific channel. Could you run /invite @Proofline in #support-alerts? If alerts still don’t flow within a few minutes, reply here and I’ll escalate with your workspace logs attached.",
        concise:
          "Hi Marcus — since only #support-alerts is affected, try /invite @Proofline in that channel (Slack updates can drop app membership). If that doesn’t fix it, I’ll escalate with your workspace logs.",
        empathetic:
          "Hi Marcus — sorry, I know missing alerts is unsettling when your team relies on them. The good news is the integration itself looks healthy, since other channels still work. Slack’s update most likely removed Proofline from #support-alerts specifically — running /invite @Proofline there usually restores delivery within a minute. If it doesn’t, tell me and I’ll personally escalate this to our integrations team right away.",
      },
    },
  },
  {
    id: "TKT-1031",
    customer: { name: "Priya Raman", company: "Arcadia", initials: "PR", hue: 30 },
    channel: "email",
    subject: "Need refund for duplicate charge",
    preview: "I was charged twice for our March invoice ($249 each)…",
    priority: "high",
    tags: ["billing", "refund"],
    status: "open",
    stage: "inprogress",
    assignee: "Maya",
    slaMins: 175,
    slaTotal: 240,
    unread: false,
    time: "1h",
    conf: 0.87,
    archived: false,
    messages: [
      {
        id: "m-1031-1",
        kind: "customer",
        time: "1h ago",
        text: "Hello, I was charged twice for our March invoice ($249 each, refs #INV-2231 and #INV-2235). Please refund the duplicate. Bank statement attached.",
      },
      {
        id: "m-1031-2",
        kind: "agent",
        author: "Maya",
        time: "52m ago",
        text: "Hi Priya — looking into this now. I can see both charges on our side; give me a few minutes.",
      },
    ],
    draft: {
      text: "Hi Priya — confirmed: #INV-2235 is a duplicate of #INV-2231, caused by a retried payment job on our side. I’ve issued a full refund of $249 to your original payment method; it should appear within 5–10 business days depending on your bank.\n\nYou’ll receive a confirmation email with the credit note shortly. Apologies for the back-and-forth on this!",
      confidence: 0.87,
      confMeta: "Grounded in 2 sources · top similarity 0.90",
      citations: [
        {
          title: "Refund policy",
          path: "Duplicate charges",
          snippet: "Duplicate charges are refunded in full to the original payment method within 5–10 business days. A credit note is generated automatically.",
          uses: 97,
        },
        {
          title: "Billing operations",
          path: "Retried payment jobs",
          snippet: "A known race in the retry worker can produce duplicate invoices. Refund the newer invoice and link both refs in the resolution.",
          uses: 23,
        },
      ],
      reasoning:
        "The customer provided both invoice refs, and an agent already confirmed the duplicate in-thread. Refund policy applies cleanly, so the draft commits to a resolution rather than asking more questions.",
      actions: ["Insert refund macro", "Attach credit note", "Escalate to billing", "Add tag: refunded"],
      variant: "base",
      alternates: {
        base: "Hi Priya — confirmed: #INV-2235 is a duplicate of #INV-2231, caused by a retried payment job on our side. I’ve issued a full refund of $249 to your original payment method; it should appear within 5–10 business days depending on your bank.\n\nYou’ll receive a confirmation email with the credit note shortly. Apologies for the back-and-forth on this!",
        regen:
          "Hi Priya — you’re right, #INV-2235 duplicates #INV-2231 (a payment-retry issue on our side). A full $249 refund is on its way to your original payment method — typically 5–10 business days. A credit-note confirmation email will follow shortly. Sorry for the hassle!",
        concise:
          "Hi Priya — confirmed duplicate. I’ve refunded the $249 for #INV-2235 to your original payment method (5–10 business days). Credit note incoming by email.",
        empathetic:
          "Hi Priya — thank you for your patience, and I’m sorry you had to dig through bank statements to catch this. You’re completely right: #INV-2235 is a duplicate of #INV-2231, caused by a payment retry on our side. I’ve issued the full $249 refund to your original payment method — it typically lands within 5–10 business days. A credit-note confirmation is on its way to your inbox now.",
      },
    },
  },
  {
    id: "TKT-1029",
    customer: { name: "Jordan Kim", company: "Polygraph", initials: "JK", hue: 150 },
    channel: "web",
    subject: "How do I invite teammates?",
    preview: "Hey! Just signed up — how do I invite my teammates? Can’t find…",
    priority: "low",
    tags: ["how-to"],
    status: "waiting",
    stage: "waiting",
    assignee: "Leo",
    slaMins: 0,
    slaTotal: 0,
    unread: false,
    time: "3h",
    conf: 0.96,
    archived: false,
    messages: [
      {
        id: "m-1029-1",
        kind: "customer",
        time: "3h ago",
        text: "Hey! Just signed up — how do I invite my teammates? Can’t find the button 😅",
      },
      {
        id: "m-1029-2",
        kind: "agent",
        author: "Leo",
        time: "3h ago",
        viaAI: true,
        text: "Hi Jordan — welcome aboard! You can invite teammates from Settings → Team → Invite member (top right). Enter their emails, pick a role (Admin, Agent, or Viewer), and they’ll get an invite link that’s valid for 7 days. On the Free plan you can invite up to 3 teammates — happy to help if you need more seats!",
      },
      {
        id: "m-1029-3",
        kind: "status",
        time: "",
        text: "AI draft accepted by Leo · sent in 2m 40s",
      },
    ],
    draft: {
      text: "Hi Jordan — welcome aboard! You can invite teammates from Settings → Team → Invite member (top right). Enter their emails, pick a role (Admin, Agent, or Viewer), and they’ll get an invite link that’s valid for 7 days.\n\nOn the Free plan you can invite up to 3 teammates — happy to help if you need more seats!",
      confidence: 0.96,
      confMeta: "Grounded in 1 source · top similarity 0.97",
      citations: [
        {
          title: "Getting started",
          path: "Inviting your team",
          snippet: "Workspace admins can invite members from Settings → Team. Roles: Admin, Agent, Viewer. Invite links expire after 7 days.",
          uses: 208,
        },
      ],
      reasoning:
        "Near-exact match against the onboarding guide. The plan limit was included because the workspace is on the Free tier, which caps invites at 3 seats.",
      actions: ["Send invite-flow GIF", "Add tag: onboarding", "Close as resolved"],
      variant: "base",
      alternates: {
        base: "Hi Jordan — welcome aboard! You can invite teammates from Settings → Team → Invite member (top right). Enter their emails, pick a role (Admin, Agent, or Viewer), and they’ll get an invite link that’s valid for 7 days.\n\nOn the Free plan you can invite up to 3 teammates — happy to help if you need more seats!",
        regen:
          "Hi Jordan — welcome! Head to Settings → Team → Invite member, add emails, choose roles (Admin / Agent / Viewer), and invites go out instantly with links valid for 7 days. Free plan includes 3 teammates — shout if you need more.",
        concise:
          "Hi Jordan — Settings → Team → Invite member. Add emails, pick roles, done. Links last 7 days; Free plan covers 3 teammates.",
        empathetic:
          "Hi Jordan — welcome, great to have you! Totally understandable, that button is easy to miss: go to Settings → Team → Invite member (top right). Add your teammates’ emails, pick a role for each, and they’ll get invite links valid for 7 days. You’re on the Free plan, which includes 3 teammates — if your team is bigger, I’m happy to help with options.",
      },
    },
  },
  {
    id: "TKT-1027",
    customer: { name: "Sofia Martinez", company: "Helio Systems", initials: "SM", hue: 330 },
    channel: "email",
    subject: "Bug report: dashboard chart not loading",
    preview: "The ticket volume chart has been stuck on a loading spinner since…",
    priority: "medium",
    tags: ["bug"],
    status: "open",
    stage: "new",
    assignee: "Eshan",
    slaMins: 320,
    slaTotal: 480,
    unread: false,
    time: "5h",
    conf: 0.71,
    archived: false,
    messages: [
      {
        id: "m-1027-1",
        kind: "customer",
        time: "5h ago",
        text: "Bug report: the ticket volume chart on my dashboard has been stuck on a loading spinner since Monday. Tried Chrome and Safari. Everything else loads fine.",
      },
      {
        id: "m-1027-2",
        kind: "note",
        author: "Leo",
        time: "4h ago",
        text: "Can repro on staging when the workspace has >10k events. Filed LIN-482 — chart query times out.",
      },
    ],
    draft: {
      text: "Hi Sofia — thanks for the clear report! We’ve reproduced this: workspaces with very large event histories can time out the chart query, which leaves it stuck loading. A fix is in progress (internal ref LIN-482) and we expect to ship it this week.\n\nI’ve linked your ticket so you’ll be notified the moment it’s out. Your data itself is safe — only the chart view is affected.",
      confidence: 0.71,
      confMeta: "Grounded in 2 sources · top similarity 0.74",
      citations: [
        {
          title: "Known issues",
          path: "Dashboard → Charts",
          snippet: "Chart queries on workspaces with >10k events may time out. Fix tracked in LIN-482.",
          uses: 12,
        },
        {
          title: "Bug response playbook",
          path: "Confirmed bugs",
          snippet: "Acknowledge the repro, share the internal reference, and offer to notify the customer on release.",
          uses: 55,
        },
      ],
      reasoning:
        "An internal note confirms the repro and links LIN-482, so the draft commits to “confirmed bug” framing per the playbook. Confidence is moderate because the ship date is an estimate.",
      actions: ["Link LIN-482", "Add tag: known-issue", "Notify on release", "Mark as bug"],
      variant: "base",
      alternates: {
        base: "Hi Sofia — thanks for the clear report! We’ve reproduced this: workspaces with very large event histories can time out the chart query, which leaves it stuck loading. A fix is in progress (internal ref LIN-482) and we expect to ship it this week.\n\nI’ve linked your ticket so you’ll be notified the moment it’s out. Your data itself is safe — only the chart view is affected.",
        regen:
          "Hi Sofia — great report, and we’ve confirmed it: very large workspaces can time out the chart query, leaving the spinner stuck. The fix (LIN-482) is in progress and expected this week — I’ve linked your ticket so you’re notified on release. Your data is unaffected; it’s purely a display issue.",
        concise:
          "Hi Sofia — confirmed bug: large workspaces time out the chart query (ref LIN-482). Fix expected this week; you’ll be auto-notified on release. Data is unaffected.",
        empathetic:
          "Hi Sofia — thank you for taking the time to test in two browsers, that helped us a lot. I’m sorry the chart has been stuck all week. We’ve confirmed the bug: very large workspaces can time out the chart query. A fix (LIN-482) is actively in progress and expected this week — I’ve linked your ticket so you’ll hear the moment it ships. Importantly, your data is completely safe; only the chart view is affected.",
      },
    },
  },
  {
    id: "TKT-1024",
    customer: { name: "Daniel Park", company: "Helio Systems", initials: "DP", hue: 195 },
    channel: "slack",
    subject: "SAML SSO setup with Okta",
    preview: "We’re evaluating the Scale plan — can you walk me through SAML…",
    priority: "medium",
    tags: ["enterprise", "how-to"],
    status: "open",
    stage: "new",
    assignee: null,
    slaMins: 290,
    slaTotal: 480,
    unread: false,
    time: "1d",
    conf: null,
    archived: false,
    messages: [
      {
        id: "m-1024-1",
        kind: "customer",
        time: "1d ago",
        text: "We’re evaluating the Scale plan — can you walk me through SAML SSO setup with Okta? Our security team needs the metadata URL format and attribute mapping.",
      },
      {
        id: "m-1024-2",
        kind: "status",
        time: "",
        text: "No grounded draft available · knowledge gap detected",
      },
    ],
    draft: null,
    aiFailureReason:
      "“SSO configuration guide.pdf” failed to index during the last knowledge-base sync, so there is no grounded source for this question. Fix the document or answer manually.",
  },
  /* ----- archived, resolved (Tickets board/table only) ----- */
  {
    id: "TKT-1019",
    customer: { name: "Sofia Martinez", company: "Helio Systems", initials: "SM", hue: 330 },
    channel: "email",
    subject: "Webhook retries flooding logs",
    preview: "",
    priority: "medium",
    tags: ["bug"],
    status: "closed",
    stage: "resolved",
    assignee: "Leo",
    slaMins: 0,
    slaTotal: 0,
    unread: false,
    time: "2d",
    conf: 0.81,
    archived: true,
    messages: [],
    draft: null,
  },
  {
    id: "TKT-1012",
    customer: { name: "Jordan Kim", company: "Polygraph", initials: "JK", hue: 150 },
    channel: "web",
    subject: "CSV export missing column",
    preview: "",
    priority: "low",
    tags: ["feature-request"],
    status: "closed",
    stage: "resolved",
    assignee: "Maya",
    slaMins: 0,
    slaTotal: 0,
    unread: false,
    time: "3d",
    conf: 0.88,
    archived: true,
    messages: [],
    draft: null,
  },
];
