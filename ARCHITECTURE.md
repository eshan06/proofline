# Proofline — Architecture

> Support that shows its work. An omnichannel AI support copilot: one inbox for
> chat/email/Slack, AI drafts grounded in the customer's own knowledge base with
> citations + a confidence score on every draft, and a human approving every send.

This document records the technology decisions and system shape **before** code,
the way a design review would expect them. The pixel source of truth is
`design_handoff_proofline/` (README + three `.dc.html` prototypes); nothing here
overrides it.

> **Historical note:** this is the v1 design document, kept as written. Some
> deliberate v1 trade-offs it records have since been superseded — the in-memory
> store now has a full Postgres/Drizzle sibling, a real RAG pipeline runs on
> pgvector, and a Playwright E2E suite exists. See the README and
> `PRODUCTION.md` for the current state.

---

## 1. Stack

| Concern | Choice | Why (and what was rejected) |
|---|---|---|
| Framework | **Next.js 15, App Router, RSC** | Marketing site + app + API in one deployable; RSC gives us server-seeded first paint with no fetch waterfall; route handlers host the mock backend that later swaps for real services. SPA+Vite was rejected: we need real URLs, a server boundary for the sandbox/demo session, and a place for the AI pipeline to live server-side from day one. |
| Language | **TypeScript `strict` + `noUncheckedIndexedAccess`** | The data model (tickets ↔ drafts ↔ citations ↔ KB docs) is relational enough that loose typing would rot fast. |
| Styling | **Tailwind CSS v4** (CSS-first `@theme` tokens) + a small set of shadcn-style primitives we own | The design's token table maps 1:1 onto `@theme`. We deliberately do **not** pull in a component library: the design is bespoke down to 12.5px font sizes and 3.5px meters — fighting a library's opinions would cost more than writing ~10 primitives. |
| Motion | **Framer Motion** for enter/exit + layout; **CSS keyframes** for ambient loops (marquee, spinners, traveling dot, glow) | Framer for things React mounts/unmounts (toasts, palette, page fade+rise). Ambient loops stay in CSS so they never schedule React work — the prototype is explicit that the DemoStage timer must not re-render the page. |
| Server state | **TanStack Query v5** | Mutations with optimistic updates + rollback are a hard requirement ("every action gives feedback ≤100ms"). Query's mutation lifecycle is the most battle-tested way to get that with typed rollback. |
| UI state | **zustand** (toasts, palette, composer) + **URL** (everything addressable) | Selected ticket, inbox filter, tickets view, analytics range, settings tab, selected customer are all URLs — deep-linkable, refresh-safe. zustand only holds what genuinely shouldn't be in the URL. |
| Contracts | **zod** at every API boundary | Route handlers parse input with zod; client hooks parse responses. One schema file is the single source of truth for both sides. |
| Fonts | **`geist` npm package** (Geist + Geist Mono) | Self-hosted via package — no Google Fonts network dependency at build or runtime. |
| Icons | **lucide-react**, 15px / 1.4px stroke | Per the handoff's explicit substitution note. Slack is a mono `#` glyph component, as designed. |
| Tests | **Vitest + Testing Library** | Where tests earn their keep: data layer, automations engine, confidence thresholds, palette keyboard handling. No E2E suite for v1 — the visual contract is verified against the prototypes instead. |

## 2. Folder structure

```
src/
  app/
    (marketing)/page.tsx          # landing — own layout, no app chrome
    signin/                       # minimal real sign-in (separate from demo)
    demo/route.ts                 # creates sandbox session → redirects into app
    (app)/                        # app shell layout wraps everything below
      home/  inbox/[[...ticketId]]/  tickets/  customers/[[...customerId]]/
      kb/  copilot/  automations/  analytics/  integrations/  settings/[[...tab]]/
    api/                          # typed route handlers (zod-validated)
  components/
    ui/        # primitives: Button, Chip, Toggle, Meter, Avatar, Skeleton, …
    shell/     # Sidebar, Topbar, CommandPalette, Toasts, DemoBanner, DemoChecklist
    inbox/  landing/  …           # per-surface components
  lib/         # types, zod schemas, confidence scale, formatting, cn()
  server/
    store.ts   # per-session in-memory workspace store (seeded from fixtures)
    session.ts # cookie sessions: regular + demo sandbox (TTL, AI rate limit)
    ai/        # DraftProvider interface + MockDraftProvider
    automations/engine.ts
  data/        # fixture data ported VERBATIM from the prototypes
```

## 3. Data model

Core entities (full zod schemas in `src/lib/schemas.ts`):

- **Ticket** — id, customer ref, channel (`web|email|slack`), subject, preview,
  priority, tags, status (`open|waiting|escalated|closed`), board stage, assignee,
  SLA (minutes left / total), messages (customer / agent / internal note / status
  event), and an optional **AIDraft**.
- **AIDraft** — `{ text, confidence, citations[], reasoning, suggestedActions[],
  alternates: { regen, concise, empathetic } }`. When grounding is missing the
  draft is `null` and the ticket carries `aiFailureReason` — this single field
  drives the inbox error state, the KB warning, and the playground refusal
  (the intentional cross-page "failed SSO doc" thread).
- **Citation** — `{ docId, title, path, snippet, similarity, usesThisMonth }`.
- **Customer, KbDoc, Automation (+ run log), Integration, Member, AuditEvent,
  Notification, AnalyticsRange** — ported verbatim; analytics has full datasets
  for 7d/14d/30d.

**Status/priority changes have one source of truth** — the ticket record in the
session store. Inbox pill, board column, table row, and customer profile all
derive from it; there are no per-view copies.

## 4. API boundary

All mutations go through `/api/*` route handlers (zod-parsed, session-scoped):

```
GET    /api/workspace                  # everything, for RSC first paint
GET    /api/tickets · GET /api/tickets/:id
PATCH  /api/tickets/:id                # status / priority / assignee / tags
POST   /api/tickets/:id/messages       # reply | note  (reply ⇒ status: waiting)
POST   /api/tickets/:id/draft          # action: regenerate | tone | accept
POST   /api/kb/upload · POST /api/kb/:id/retry
POST   /api/automations · PATCH /api/automations/:id
PATCH  /api/integrations/:id           # connect / disconnect / configure
POST   /api/members                    # invite
POST   /api/playground                 # ask the copilot a test question
POST   /api/demo/session · POST /api/demo/steps
POST   /api/events                     # product analytics (demo_step_completed…)
```

Latency contract from the design is enforced **in the mock provider**, not the UI:
regenerate 1.1s · tone rewrite 0.75s · playground 1.4s · KB indexing 2.2s.

## 5. The AI pipeline abstraction

The UI never knows whether the AI is real. Everything goes through one interface:

```ts
interface DraftProvider {
  generateDraft(ticket, kb, opts): Promise<DraftResult>   // full RAG pass
  rewrite(draft, tone): Promise<DraftResult>              // tone transform
  answer(question, kb, opts): Promise<PlaygroundResult>   // playground / widget
}
// DraftResult = { draft: AIDraft } | { draft: null; failureReason: string }
```

A production provider implements this as: ingestion → chunking → embedding →
retrieval → drafting → **citation extraction** → **confidence scoring** (top
similarity + coverage). `MockDraftProvider` implements the same interface from
fixture data + keyword routing (refund→0.89, invite→0.96, slack→0.58,
sso/saml→refusal, default→0.74) with the specced latencies. The refusal path is
first-class: *no grounded source ⇒ no draft* — the AI never silently guesses.

Confidence rendering is centralized in `lib/confidence.ts`
(≥0.80 green `#3DD68C` · 0.65–0.79 amber `#F5B74E` · <0.65 red `#F36C6C`) and
unit-tested; confidence is never displayed without its color, and <70% always
pairs with the explicit warning.

## 6. Sessions, demo mode, and persistence

- **Store**: an in-memory `Map<sessionId, Workspace>` seeded from fixtures on
  first touch. This is a deliberate v1 trade-off: the entire surface behaves like
  a real multi-user backend (sessions don't share state, mutations persist for
  the session) without dragging a database into a fixture-driven product. The
  repository functions are written against an interface so Postgres/Drizzle can
  replace the Map without touching route handlers. Caveat (documented, accepted):
  single-process only; sessions evaporate on deploy.
- **Regular sign-in** (`/signin`): minimal real flow — creates a workspace
  session cookie, lands on `/home`. Kept fully separate from demo.
- **Demo mode** (`/demo`): a feature, not a URL flag. The route handler mints an
  **unauthenticated sandbox session** (fresh seeded workspace, 30-min TTL,
  AI calls rate-limited per session), sets a scoped cookie, and redirects into
  the app. The banner + 5-step "Try it yourself" checklist are wired to the real
  actions (accept draft, ⌘↵ send, KB upload, integration connect, ⌘K), each
  completion emits a `demo_step_completed` analytics event, and the signup CTA
  carries through. Nothing is persisted past the session.

## 7. Interaction architecture

- **Keyboard**: one `KeyboardProvider` in the app shell owns ⌘K / Esc / J / K /
  ⌘↵, suppressed while typing (except ⌘K and ⌘↵ in the composer). J/K navigate
  the *filtered* inbox list via router pushes, so the URL stays the source of
  truth.
- **Optimistic updates**: priority cycling, status changes, toggles, bulk
  actions, integration connects all apply instantly via Query cache updates and
  roll back on error; every mock action confirms with a toast.
- **Overlays**: palette / modals / popovers close on Esc + backdrop click, trap
  focus, set ARIA roles (`dialog`, `listbox`/`option` for the palette).
- **Skeletons** match final layout exactly (no layout shift); error boundaries
  wrap each page region; empty states are designed, not blank.
- **Motion rules** (hard requirement): entrance animations play once and settle;
  only ambient elements loop (marquee 30s, traveling dot 9s, pricing glow,
  hero badge pulse). Meters/counters ease on `cubic-bezier(0.22,1,0.36,1)`;
  count-ups are state-driven so re-renders never reset them.

## 8. Risks called out up front

1. **Pixel fidelity vs. utility CSS** — the design uses off-scale values
   (12.5px, 3.5px, 99px). Mitigation: tokens for the repeated values, arbitrary
   values where the design is intentionally one-off; the prototype HTML is
   checked side-by-side per surface.
2. **In-memory store** — see §6; acceptable for v1, interface-isolated for v2.
3. **Animation loops leaking** — feature micro-demos must play once; enforced by
   playing animations via `animation-fill-mode: both` one-shot keyframes
   triggered on reveal, never `infinite` (except the allow-listed ambient set).
4. **DemoStage re-rendering the landing page** — progress fills are written
   directly to DOM refs inside an isolated client component, exactly as the
   prototype does; React state only changes on act transitions (4 per cycle).
5. **Demo abuse** — sandbox AI endpoints are rate-limited per session and the
   sessions are TTL'd; demo sessions can't touch regular-session data.

## 9. Build order (mirrors the handoff)

1. Tokens + Tailwind theme, fonts, primitives, app shell (sidebar/topbar/palette/toasts), routing
2. **Inbox + AI copilot panel** — the hero; pixel-perfect first; everything reuses its patterns
3. Home, Tickets, Customers, Knowledge Base
4. Copilot settings + playground, Automations, Analytics, Integrations, Settings
5. Demo mode (sandbox session + checklist) + sign-in
6. Landing page (proof card, DemoStage, marquee, play-once feature demos)
7. Tests (data layer, automations engine, confidence scale, palette keyboard) + lint/typecheck/build clean
