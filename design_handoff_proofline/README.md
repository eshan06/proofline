# Handoff: Proofline — AI Support Copilot (Marketing Site + App)

## Overview

**Proofline** is an omnichannel AI customer-support copilot for small SaaS teams. It unifies website chat, email, and Slack into one inbox; the AI drafts replies grounded in the company's own knowledge base, attaches **citations** for every claim plus a **confidence score**, and a human approves, edits, or escalates every send. The product's identity is *evidence*: "Support that shows its work."

This package contains the complete design for:
1. A **marketing landing page** with an animated product demo and an interactive hero "proof card"
2. The **full app**: unified inbox + AI copilot panel (the hero surface), home dashboard, tickets (kanban/table), customers CRM, knowledge base, AI copilot settings + test playground, automations builder, analytics, integrations, settings (team/workspace/billing/audit)
3. A **self-serve demo mode** (`?demo=1`) with a guided checklist

## About the Design Files

The files in `design_files/` are **design references created in HTML** — high-fidelity interactive prototypes showing intended look and behavior. They are NOT production code to copy directly.

Your task is to **recreate these designs in a production stack**. No codebase exists yet; recommended stack (matching the design's assumptions): **Next.js (App Router) + React + TypeScript + Tailwind CSS + Framer Motion + shadcn/ui-style components**. If you choose differently, preserve the visual spec exactly.

The prototypes are written as "Design Components" (`.dc.html`): a single HTML file with a template (inline styles, `{{ }}` bindings, `<sc-if>`/`<sc-for>` control flow) plus a `class Component` holding state and a `renderVals()` method returning template inputs. `support.js` is the prototype runtime — ignore it for production; read the templates as JSX-like markup and the logic classes as plain React state logic. They translate 1:1:
- `<sc-if value="{{ x }}">` → `{x && (...)}`
- `<sc-for list="{{ xs }}" as="x">` → `{xs.map(x => ...)}`
- `style-hover="..."` → Tailwind `hover:` / CSS `:hover`
- `renderVals()` → component state + derived values + handlers

**All mock data lives in the logic classes** (`tickets`, `customersData`, `automationsData`, `analyticsData`, `integrationsData`, `auditData`, `kbBase`, `notifData`) — port it verbatim as seed/fixture data.

## Fidelity

**High-fidelity.** Colors, type, spacing, copy, and interactions are final. Recreate pixel-perfectly. All numbers/copy in the mocks are intentional fixture content.

## Design Tokens

### Color (dark theme only — no light mode yet)

| Token | Value | Use |
|---|---|---|
| `bg-page` | `#07090F` (landing) / `#0A0D14` (app) | page background |
| `bg-panel` | `#0C0F17` | sidebar, cards on landing, panel chrome |
| `bg-card` | `#0F141E` | app cards/tables |
| `bg-raised` | `#11151F` | popovers, command palette, modals |
| `bg-bubble` | `#131826` | customer message bubbles |
| `bg-toast` | `#161B28` | toasts, floating pills |
| `text-primary` | `#E6EAF2` | headings, primary text |
| `text-secondary` | `#C6CCDA` → `#A9B2C4` → `#8A93A6` | descending emphasis |
| `text-muted` | `#5C6478` | labels, meta |
| `text-faint` | `#444B5C` | timestamps, fine print |
| `accent` | `#4D7CFE` | primary actions, AI, links, active states |
| `accent-hover` | `#5E89FF` | button hover |
| `accent-soft-text` | `#9DB7FF` / `#7DA2FF` | accent-tinted text |
| `success` | `#3DD68C` | high confidence, healthy, resolved |
| `warning` | `#F5B74E` | medium confidence, SLA risk, notes |
| `danger` | `#F36C6C` (text `#F8A0A0`) | urgent, low confidence, failures |
| `violet` | `#8B5CF6` (text `#C4B0F8`) | automations, secondary accent |

Tinted fills are the accent at low alpha: `rgba(77,124,254,0.05–0.16)` backgrounds, `rgba(77,124,254,0.22–0.45)` borders. Neutral hairlines: `rgba(255,255,255,0.04–0.10)`. Avatars: `hsl(<hue> 45% 20%)` bg with `hsl(<hue> 75% 72%)` text (per-customer hue: Ava 210, Marcus 280, Priya 30, Jordan 150, Sofia 330, Daniel 195).

**Confidence color scale** (used everywhere AI confidence appears): ≥0.80 → success green, 0.65–0.79 → warning amber, <0.65 → danger red.

### Typography

- **Sans**: `Geist` (Google Fonts; weights 400/500/600/700) — all UI text
- **Mono**: `Geist Mono` (400/500/600) — timestamps, ticket IDs, confidence numbers, keyboard hints, eyebrow labels, code
- App base size **13px**; dense scale: 10–12.5px for chrome/meta, 14.5–19px headings, 21px metric numbers
- Landing: h1 53px/700/−0.035em, h2 30–34px/700/−0.03em, body 16px/1.62
- Letter-spacing: negative on headings (−0.01 to −0.035em), wide (+0.08–0.18em) on uppercase mono labels

### Spacing, radius, shadows

- Radius: 4–5px micro chips, 7px buttons/inputs, 9–11px cards, 13–16px panels/modals, 99px pills
- Card padding 13–18px; app page gutter 28–32px; section gap 12–14px
- Shadows: buttons `0 2px 12px rgba(77,124,254,0.3)` (accent glow); popovers `0 16px 50px rgba(0,0,0,0.6)`; hero/modals `0 30px 80px rgba(0,0,0,0.55–0.7)`
- Focus: `border-color rgba(77,124,254,0.55)` + `0 0 0 3px rgba(77,124,254,0.12)` ring

### Motion

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for meters/bars/entrances; `ease` for micro-fades
- Page transitions: fade+rise `opacity 0→1, translateY(4px)→0` over 0.22s
- Toast: pop `translateY(10px) scale(0.97)→none` 0.22s
- Confidence/SLA meters: width transitions 0.7–0.8s
- **Rule learned in review: feature-card micro-demos play ONCE then hold still** (no infinite loops). Only ambient elements (marquee, traveling dot, pricing-card glow, hero badge pulse) may loop, slowly.
- Count-up numbers: ~1.15s cubic ease-out, driven by state (survives re-renders)

---

## Files

| File | Contents |
|---|---|
| `design_files/Proofline Landing.dc.html` | Marketing page: nav, hero + interactive proof card, integration marquee, 6 feature cards with micro-demos, how-it-works, pricing, CTA, footer |
| `design_files/Proofline App.dc.html` | Entire app: shell, all 10 pages, command palette, notifications, toasts, demo mode |
| `design_files/DemoStage.dc.html` | The landing page's auto-playing 4-act product demo (isolated component so its timer never re-renders the page) |
| `design_files/support.js` | Prototype runtime — reference only, do not port |
| `screenshots/` | `01–06-landing` (hero, demo stage, features, how-it-works, pricing, footer), `01–12-app` (inbox left/right, home, tickets board, tickets table, customers, KB, copilot, automations, analytics, integrations, settings), `13-app-demo-mode` |

Screenshots were captured in a 914px-wide viewport; the app is designed for **≥1240px** desktop, so some right-edge content is clipped in captures — the HTML files are the source of truth.

---

## Screens / Views

### 1. Landing page (`Proofline Landing.dc.html`)

**Nav** (sticky, blur backdrop `rgba(7,9,15,0.72)`): logo (24px rounded square, blue gradient `135deg #4D7CFE→#3B5FD9`, white check icon) + "Proofline" 15px/600; links Product/Pricing/Docs/Changelog 13px muted; right: "Sign in" text link → app (regular mode), "Start free" primary button.

**Hero** — asymmetric editorial grid `1.04fr / 0.96fr`, gap 54px, max-width 1140px, NOT centered:
- Background: faint 56px blueprint grid (`rgba(255,255,255,0.018)` lines) masked to an ellipse + radial accent glow top-right
- Left: h1 "Support that **shows its work**." — the phrase "shows its work" carries a highlighter mark: `linear-gradient(transparent 60%, rgba(77,124,254,0.32) 60%…92%)` behind the text. Subhead: *"One inbox for chat, email, and Slack. Every reply is drafted from your docs, cited, and approved by a human."* CTAs: **Start free** (primary, → signup) and **Try the demo yourself →** (ghost, → app `?demo=1`). Below: 3 count-up stats with 1px dividers — **87%** drafts accepted, **4m 12s** median first response, **100%** claims cited (numbers animate 0→target on load, ~1.15s; values must be state-driven so interactions don't reset them)
- Right: **interactive proof card** (this is the brand artifact). Header row: AI spark icon, "Proofline draft", mono "· TKT-1031", green "● 0.94 conf". Customer bubble (avatar "PR"): *"I was charged twice for our March invoice — can you refund the duplicate?"* AI answer block (blue-tinted, `rgba(77,124,254,0.05)` bg / `0.22` border): two phrases are highlighted with the same marker treatment + mono superscripts ¹ ². Dashed divider, then "SOURCES · tap to inspect" and two source rows (numbered blue square badge, doc name, mono `→ section`, similarity score right-aligned). **Interactions**: clicking a highlighted phrase or its source row toggles an inset quote panel under that row (2px blue left border, italic, the actual cited passage); **Approve & send** replaces the button row with a green "Sent to Priya Raman · just now" state and swaps the floating receipt pill from "Drafted in 1.2s · awaiting your approval" (blue dot) to "Approved by **you** · sent just now" (green check); **Edit** swaps the answer into a focused textarea (button label → "Done"). The receipt pill hangs off the card's bottom-left corner (`bottom: -16px; left: 22px`).

**Integration marquee** (replaces a logo wall): centered mono label "CONNECTS YOUR WHOLE SUPPORT STACK", then an infinitely scrolling row of pill chips — Website Chat `</>`、Gmail `M`, Slack `#`, Notion `N`, Stripe `$`, Linear `L`, GitHub `GH`, Zapier `Z`, Twilio SMS `S`, Google Docs `G`. Each chip: 24px circled mono glyph (per-brand tint) + name. Track = two identical copies, `translateX(0 → −50%)` over 30s linear infinite, pause on hover, edge fade via mask `linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)`.

**Product demo** (`DemoStage` component, framed like a browser window with traffic lights and "app.proofline.com · Inbox" address): auto-playing 4-act loop — (1) ticket arrives + auto-tag chips pop in, (2) "Searching 7 knowledge sources" with bouncing dots, (3) draft appears with inline citation chips + animated 92% confidence bar + evidence cards, (4) "Approved by Eshan · sent in 38 seconds". Bottom: 4 labeled progress segments (mono uppercase), clickable to jump; segment fill is written directly to DOM (not via state) so the page never re-renders. Status pill top-right cycles INGESTING → RETRIEVING → AWAITING APPROVAL → RESOLVED. Durations: 2.6s / 2.2s / 3.8s / 2.6s.

**Features** — header "Built for teams who refuse to send a guess." + 3×2 card grid. Each card: 124px micro-demo viewport (gradient tint top, hairline bottom border) + 14.5px/600 title + 12.5px muted description. Micro-demos **animate in once on reveal, then hold still**: (1) Unified inbox — three channel rows (web/email/slack dots) slide in staggered; (2) Replies with citations — static skeleton draft + two citation chips pop in + "0.92 conf"; (3) Smart routing — avatar row, then "auto-tag → billing, urgent" chips pop, then "→ routed to Billing team in 0.4s"; (4) Knowledge base sync — "refund-policy.pdf · chunking…" (amber) and "billing-and-plans.md · indexed · 48" (green) rows + "+26 chunks citable"; (5) SLA tracking — bar drains 96%→30% green→amber once (1.7s) then "escalation armed → notify #support-oncall" chip fades in; (6) Analytics — 8 bars grow up staggered, last one green, "↑ 87%" badge. Hover: card lifts −3px, border brightens.

**How it works** — 4 numbered columns (38px circled mono numbers, glow) joined by a gradient hairline with a slow traveling dot (9s loop): Connect channels / Upload your docs / Review AI drafts / Resolve faster.

**Pricing** — 3 cards: Free $0 (1 channel · 3 seats, 100 drafts/mo, 25 docs); **Growth $49/seat/mo** (most-popular badge, blue border, slow glow pulse, all channels/unlimited drafts/automations/SLA+analytics/Notion+GDocs sync, "Start 14-day trial"); Scale Custom (SAML SSO & SCIM, audit logs & residency, custom AI policies, dedicated support engineer, "Talk to sales"). Check icons accent blue.

**CTA** — "Stop guessing. Start answering with proof." + Start free / View demo; faint floating evidence chips rise behind (slow, low opacity). Footer: logo, © 2026, Privacy/Terms/Security/Status.

Scroll reveal: sections below the fold start `opacity 0, translateY(26px)` and reveal at 12% intersection with 0.75s staggered transitions (`data-reveal` = per-element delay ms). Never hide above-the-fold content.

### 2. App shell (`Proofline App.dc.html`)

Desktop-first, min-width 1240px, full-viewport height, content panes scroll internally.

- **Sidebar** 220px, `#0C0F17`, right hairline: workspace switcher (26px logo, "Acme Inc" 13px/600, "Proofline · Pro plan" 10.5px muted, ▾); nav — Home, Inbox (badge "6"), Tickets, Customers, Knowledge Base, AI Copilot, Automations, Analytics, Integrations, Settings. Items 12.5px, 5.5px/9px padding, radius 7px; active = `rgba(77,124,254,0.12)` bg + white text + blue icon; inactive muted, hover soft white. Icons: 15px, 1.4px stroke, 16×16 viewBox line set (drawn inline in the prototype — use Lucide equivalents). Footer: "Marketing site" link (→ landing) + user card (avatar, name, email, green presence dot).
- **Topbar** 48px, blur, hairline: breadcrumb "Acme Inc / {Page}"; search button (220px, "Search or jump to…", `⌘K` kbd chip); bell with red dot → notifications popover (330px, 5 rows: colored dot, text, mono time; "Mark all read"); "?" help; avatar.
- **Command palette** (⌘K, and Esc closes): overlay `rgba(5,7,11,0.62)` + blur, 580px panel at top+110px. Search input + `esc` chip; grouped results — Pages (all 10), Actions (review low-confidence drafts · 2 waiting, upload docs, escalate current ticket), Tickets (all 6, with channel icon, customer, ID). ↑↓ navigate (highlight `rgba(77,124,254,0.12)`), ↵ select, hover sets index. Footer hints: ↑↓ / ↵ / "J / K move through inbox".
- **Keyboard**: ⌘K palette · J/K next/prev conversation in inbox · ⌘↵ send reply · Esc closes overlays. Suppressed while typing in inputs.
- **Toasts** bottom-right: dark card, green check, 12px text, pop-in, auto-dismiss 2.6s. Every mock action confirms via toast.

### 3. Unified Inbox (hero page)

Three columns: **list 318px** / conversation flex / **AI copilot 336px**.

**List**: search field; filter chips (All 6 · Unassigned 2 · Mine 2 · SLA Risk 2 · AI Drafted 5 · Low Confidence 1) — pill chips with mono counts, active = blue tint/border. Rows: channel icon (globe/mail/#), name 12.5px/600, mono relative time, unread blue glow dot; subject 12px/500; one-line preview muted; bottom row: priority (colored 6px square + label: Urgent red, High amber, Medium blue, Low gray), first tag chip, right-aligned `AI 92%` mono chip in confidence color. Selected row: 2px blue left edge + `rgba(77,124,254,0.07)` bg. Empty state (no filter matches): dashed-ring inbox icon, "No conversations match", hint.

**Conversation**: header — subject 14.5px/600 + mono ID + status pill (Open blue / Waiting on customer amber / Escalated red / Closed green: dot + label + tinted border); meta row — assignee chip (17px avatar + name), priority chip (click cycles low→medium→high→urgent, toasts), tag chips, right: SLA — mono label ("First response due in 18m" / "SLA met · responded in 2m 40s") + 130px progress bar in risk color (red ≤20m, amber ≤45m, gray else, green met). Timeline (scrolls): customer messages left (avatar, name, mono time, `#131826` bubble, radius `4px 12px 12px 12px`); agent replies right-aligned mirrored (blue-tinted bubble `rgba(77,124,254,0.1)` bg / `0.22` border, radius `12px 4px 12px 12px`), optional "via AI draft" chip; internal notes — full-width amber dashed-border card, "INTERNAL NOTE" caps label; status events — centered mono text between hairlines. Composer: textarea (placeholder "Reply to {name}… (or accept the AI draft →)"), buttons: **Send reply** (primary + `⌘↵` chip), Save draft, Add note (hover amber; posts composer text as internal note), spacer, Escalate (amber outline; appends status event + sets status), Close ticket (hover green).

**AI Copilot panel** (gradient blue wash at top): header — spark icon, "AI Copilot", mono `proofline-r1` model chip.
- **Confidence block**: "CONFIDENCE" caps label, big mono % in confidence color, 6px meter with glow animating to value, meta line "Grounded in 2 sources · top similarity 0.93".
- **Low-confidence warning** (<70%): amber box "Low confidence — the AI found limited supporting evidence. Review carefully before sending."
- **Suggested reply card** (blue border/tint): "Suggested reply" header + "Inserted ✓" green chip after accept; body pre-wrap 12.5px/1.62. Regenerating overlay: dark blur veil + spinner + "Regenerating draft…" (1.1s mock).
- **Actions**: Accept draft (primary; copies draft into composer, marks Inserted), Edit (inline textarea within card; button → "Done", toast "Draft updated"), ↻ regenerate (swaps to alternate draft text), "Make more concise" / "More empathetic" pill buttons (0.75s shimmer then tone-rewritten draft + toast). All disabled (45% opacity) while regenerating.
- **Evidence · N sources**: expandable citation cards — mono numbered badge, doc title, mono path ("Plan upgrades → Sync delays"), chevron; expanded: quoted snippet in dark inset, "Cited 132× this month", "Open doc ↗".
- **Why this answer?** accordion: paragraph explaining retrieval/reasoning.
- **Suggested actions**: pill buttons per ticket (e.g. Insert refund macro — appends macro text to composer; Escalate to billing — escalates; others toast).
- **Error state** (ticket TKT-1024, SAML/SSO): red box "AI draft unavailable" — "'SSO configuration guide.pdf' failed to index… no grounded source. Fix the document or answer manually." + Retry sync / Open Knowledge Base buttons. Panel shows this instead of draft when `ticket.draft == null`.

**Seed tickets** (6, port verbatim from `tickets` array): TKT-1042 Ava Chen/Northwind plan-upgrade-not-applied (urgent, web, conf 0.92, SLA 18m, internal note from Maya re Stripe webhooks); TKT-1038 Marcus Lee/Lumen Labs Slack-integration-broken (high, slack, conf 0.58 → low-confidence flow); TKT-1031 Priya Raman/Arcadia duplicate-charge-refund (high, email, 0.87); TKT-1029 Jordan Kim/Polygraph invite-teammates (low, web, 0.96, resolved-by-AI example); TKT-1027 Sofia Martinez/Helio dashboard-chart-bug (medium, email, 0.71, linked LIN-482); TKT-1024 Daniel Park/Helio SAML-SSO (medium, slack, **no draft** → error state). Each has `draft.text`, `draft.cites[]` (title, path, snippet, uses), `draft.reasoning`, `draft.actions[]`, and `alts` {regen, concise, empathetic} variants.

### 4. Home dashboard

Max-width 1060px. "Good morning, Eshan" + date + "6 conversations need your attention"; quick actions (Upload docs → KB + triggers upload; Connect channel → Integrations; New automation; Review low-confidence → inbox filtered). 5 metric cards (label, 21px mono value, delta in semantic color, 12-bar sparkline): Open tickets 24 (+3 today), AI draft acceptance 87% (+2.4 pts, green value), Median first response 4m 12s (−38s), SLA risk 3 (red, "2 urgent"), Resolved this week 142 (+18%). Main grid `1fr / 340px`: left — stacked bar chart "Ticket volume · last 14 days" (blue = resolved via AI draft, gray = human only; hover tooltips) + "Needs attention" list (glow dot, subject, who, chip `SLA 18m`/`AI 58%`/`No AI draft`, time; rows click through to inbox); right — "AI performance" card (gradient blue: acceptance meter 87% blue→green, 214 drafts / 0.84 avg confidence stat tiles, "Review 2 low-confidence drafts" button), "Channel health" (Website chat ● green "1.2s median · 99.9%", Email ● amber "sync delayed 4m", Slack ● green "2 workspaces"), "Activity" feed (mini avatars incl. ⚡ automation and "AI" indexing entries).

### 5. Tickets

Header + Board/Table segmented toggle. **Board**: 5 columns (New blue, Waiting amber, In progress violet, Escalated red, Resolved green) — column = dot + label + mono count on `rgba(255,255,255,0.018)` well; cards: subject (2 lines ok), channel icon + customer + mono ID, priority + tag + mono confidence % + 18px assignee avatar; hover border accent; click → opens that conversation in Inbox. Status changes made in the inbox (escalate/close) move cards between columns. Empty column: dashed "No tickets" well. **Table**: checkbox, Ticket (subject + ID + status dot), Customer, Channel, Priority, Assignee, AI conf (right), Updated (right). Selecting rows reveals a **bulk bar** (blue tint): "N selected | Assign to me · Close · Add tag · Export CSV | Clear" — all functional against mock data. Includes 2 archived resolved tickets (TKT-1019, TKT-1012).

### 6. Customers

Two panes: list 300px (search; rows: avatar, name, company, sentiment dot, mono "N conv"; selected = blue edge) + profile: 46px avatar, name 17px/600, "company · email", sentiment pill (Stressed amber / Neutral gray / Satisfied green / Delighted green / Evaluating blue), Email button; 3×2 meta cards (PLAN, MRR, CUSTOMER SINCE, LOCATION, SEATS, LAST ACTIVE — caps 10px labels + 12.5px values); "Conversations" card (lifetime count; rows → inbox; empty: "No open conversations — older history is archived."); "Notes" card (+ Add note; author avatar + time + text). 6 customers incl. company groupings (Sofia + Daniel both Helio Systems).

### 7. Knowledge Base

Header "Everything the AI is allowed to cite. 7 sources · 161 chunks indexed" + Add URL + **Upload docs** (primary). 3 connector cards: Notion (Connected, "5 docs syncing"), Google Docs (Connect), Help Center (Connected). Doc table: Document / Source / Status / Chunks / Cited / Last synced — status: ● Indexed green, spinner Processing amber, ● Failed red. **Upload flow**: button adds "Refund-policy-v3.pdf" row in Processing with spinner → after 2.2s flips to Indexed · 26 chunks + toast. Footer warning line (red icon): "1 source failed to index — 'SSO configuration guide.pdf' exceeds the 50 MB limit. The AI cannot answer SSO questions until this is fixed." (This is the cross-page thread tying to inbox TKT-1024 and the playground's refusal.)

### 8. AI Copilot settings

Two-column `1fr / 380px`. Left cards: **Tone** chips (Friendly/Concise/Formal/Technical, single-select); **Risk mode** — 3 selectable cards (Conservative / Balanced / Autonomous) with descriptions + glow dot on active; picking Autonomous toasts "still requires approval for refunds & account changes"; **Confidence threshold** slider 40–95% (accent), live label + "Drafts below N% confidence are flagged…"; **Require human approval** toggles (Low-confidence drafts ✓, Refunds & credits ✓, All outbound replies ✗) — 32×18 pill switches; **"Never say" policies** — removable red-tinted chips + "Add a policy and press Enter…" input; **Allowed actions** (green checks) / **Blocked actions** (red ×) twin cards. Right, sticky: **Test playground** (blue gradient card) — textarea "Type a fake customer question…", 3 sample-question chips, **Generate draft**; loading "Searching 7 sources…" 1.4s; result: confidence meter + draft + numbered citations; <70% adds threshold warning; SSO/SAML questions return the red "no grounded source — the copilot refuses to guess" refusal. Keyword routing: refund/charge→0.89, invite/team→0.96, slack→0.58, sso/saml→refusal, default→0.74.

### 9. Automations

Header + **New automation** (primary; toggles builder). **Builder** (blue gradient card): three chip-select rows — WHEN (blue): new ticket / no reply after 30 min / AI confidence < 65% / keyword "refund"; IF (amber): channel email / tag billing / plan Enterprise / priority urgent; THEN (green): escalate to engineering / add tag follow-up / notify #support-oncall / assign senior agent; **Save automation** prepends an active rule + toast. **Rule list** (4 seeded): toggle switch, name 13px/600, trigger subtitle, status (● Active / Paused), mono "38 runs · 2h ago", chevron. Expanded: the rule as a chip pipeline (trigger blue → conditions amber → actions green, joined by mono →) + "RECENT RUNS" log (green/amber dot, mono time, entry). Seeds: "Escalate billing tickets over $500", "Auto-tag login issues" (214 runs), "VIP open-ticket alert", "Low-confidence safety net".

### 10. Analytics

Header with date range; **7d/14d/30d segmented picker — switching swaps every dataset with animated transitions**; Export report. 4 metric cards (Tickets 164 +12% / Median first response 4m 12s −38s / AI acceptance 87% +2.4pts / SLA breaches 3 −2). Charts: stacked volume bars (AI vs human, animated heights); first-response SVG line+area chart with current value; **AI confidence distribution** — 5 horizontal bars (<50% red … 90%+ green); **Top tags** bars (billing 54, bug 38, how-to 31, login 22, feature-request 14, enterprise 5); **Most-cited docs** violet bars (Getting started 208 …); agent leaderboard table (avatar, Resolved, AI acceptance green, Median FRT). Full per-range datasets are in `analyticsData` — port all three.

### 11. Integrations

"Channels in, context out — 6 of 10 connected." 3×N grid of cards: mono glyph tile, name, one-line description, status dot, permissions summary ("Read & write conversations" / "Not connected"), mono last-sync, **Connect** (primary) / **Disconnect** (ghost) + **Configure** (when connected & configurable). Connect/disconnect flips state live + toast; connecting a configurable one auto-opens its setup panel. **Setup panels** (inline below grid, blue border, closable): **Website Chat** — embed snippet code block (syntax-tinted, Copy button), brand color swatches (#4D7CFE/#8B5CF6/#2DD4BF/#F5B74E) that **recolor the live widget preview** (customer bubble, citation line, send button), allowed-domains chips (acme.io, app.acme.io, + add); **Gmail** — OAuth account card (support@acme.io · scopes read,send · Sync now), 3 import toggles (history 90d ✓, labels ✗, send-as alias ✓), "Sync delayed 4m" amber chip; **Slack** — "2 workspaces" chip + channel routing rows (#support → Inbox · all messages; #billing-alerts → Billing team only; #vip-customers → High priority + VIP tag) + add rule. Ten integrations: Website Chat, Gmail, Slack, Twilio SMS, Notion, Google Docs, GitHub, Stripe, Linear, Zapier (connected state in `intgConn`).

### 12. Settings

Underline tabs: **Team** — Members table (avatar, name, email, ● Active/Invited, role pill ▾) + **Invite member** modal (email input with validation, Admin/Agent/Viewer segmented role, Send invite → appends Invited row + toast) + permission matrix (5 rows × Admin/Agent/Viewer, mono ✓/—). **Workspace** — name input, read-only URL `app.proofline.com/acme`, Save; red-bordered danger zone "Delete workspace". **Billing** — Growth plan card ($49/seat · 3 seats · renews Jul 1, 2026 · $147/mo · Upgrade to Scale); 4 usage cards with meters (Tickets 1,284/∞ 62%, AI replies 842/∞ 41%, Docs 7/100, Seats 3/10); invoices (Visa ···· 4242; 3 paid rows, PDF ↓). **Audit log** — filter chips All/AI/Team/Integrations/Security; rows: avatar/◆ for System, action, user, type pill (color per category), mono timestamp. 9 seeded events.

### 13. Demo mode (`?demo=1`)

Entered via the landing hero's "Try the demo yourself" button. Regular sign-in is unchanged.
- **Banner** above the shell: blue/violet gradient tint, pulse dot, "**Interactive demo** — explore freely with mock data. Nothing is saved.", mono "n/5 explored", **Start free**, Exit (→ landing).
- **"Try it yourself" checklist** — floating card bottom-left of the content area (268px, blue border, collapsible to a "Demo guide · n/5" pill): header with spark icon + n/5, thin progress bar (blue→green gradient fill), 5 missions — *Accept an AI draft*, *Send the reply* (⌘↵), *Upload a knowledge doc*, *Connect an integration*, *Open the command palette* (⌘K). Clicking a mission navigates to the relevant surface; completing the **real action** checks it off (green circled check + strikethrough + muted). All 5 done → footer panel: "That's the core loop — Proofline drafts, **you approve**." + Start free button.
- Completion hooks: accept-draft, send-reply, KB upload, integration connect, palette open.

**Production contract**: the prototype keys demo mode off the URL (`/[?&#]demo(=1)?/`). In production, replace with an unauthenticated **sandbox session** — server-seeded mock workspace (the fixture data in this package), no persistence, rate-limited AI calls, signup CTA carried through. Keep the checklist instrumentation as product analytics events (`demo_step_completed`).

---

## State Management (production shape)

The prototype holds everything in two component states; in production split into:
- **Server data** (React Query/RSC): tickets + messages, customers, KB docs, automations + run logs, analytics aggregates, integrations, members, audit events, notifications. CRUD per the interactions above.
- **AI draft object** per ticket: `{ text, confidence, citations: [{docId, title, path, snippet, similarity, usesThisMonth}], reasoning, suggestedActions[], alternates: {regen, concise, empathetic} }` — `null` + `failureReason` when no grounded source (drives the error state).
- **UI state** (client): selected ticket, inbox filter + search, composer text, draft mode (idle/edit/regen/accepted), expanded citation, palette open/query/index, notifications open, toasts queue, tickets view + row selection, settings tab, integration panel open, copilot settings (tone, risk, threshold, approvals, neverSay[]), playground state, demo mode + steps.
- **Status/priority overrides** flow through to every surface (inbox pill, board column, table) — single source of truth per ticket.

## Interactions & Behavior — global rules

- Every action gives feedback ≤100ms (optimistic UI + toast). Mock latencies to preserve: regenerate 1.1s, tone rewrite 0.75s, playground 1.4s, KB indexing 2.2s.
- Page switches: 0.22s fade+rise. No layout shift on data load — use skeletons matching final layout.
- All overlays close on Esc and on backdrop click; palette traps ↑↓/↵.
- Hover states everywhere: rows tint `rgba(255,255,255,0.03)`, buttons brighten, borders move toward accent.
- Numbers, IDs, times, confidence, keyboard hints: always mono.
- Confidence is never shown without its color coding; low confidence always pairs with an explicit warning.

## Assets

No external images. Logo = white check in a blue-gradient rounded square (recreate as SVG). Icons are inline 16×16 stroked paths — substitute **Lucide** (home, inbox, list, users, book-open, sparkles, zap, bar-chart, layout-grid, settings, search, bell, check, alert-triangle, plus, external-link, globe, mail, file-text; Slack channels use a mono `#` glyph). Fonts via Google Fonts: Geist + Geist Mono.

## Suggested build order

1. Tokens + Tailwind theme, app shell (sidebar/topbar/toasts/palette), routing
2. Inbox + AI copilot panel with fixture data (the hero — get this pixel-right first)
3. Home, Tickets, Customers, Knowledge Base
4. AI Copilot settings + playground, Automations, Analytics, Integrations, Settings
5. Demo mode (sandbox session + checklist)
6. Landing page (hero proof card, DemoStage, marquee, features with play-once micro-demos)
7. Real backend: auth, channel ingestion, RAG pipeline (chunking/embedding/citation extraction), confidence scoring, automations engine
