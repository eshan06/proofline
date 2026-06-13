# Proofline

**Support that shows its work.** An omnichannel AI customer-support copilot:
website chat, email, and Slack unified into one inbox; an AI that drafts replies
grounded in the customer's own knowledge base with **citations** and a
**confidence score** on every draft; and a human who approves, edits, or
escalates every send.

This is a production-shaped Next.js implementation of the design in
`design_handoff_proofline/`. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the
stack decisions and [`PRODUCTION.md`](./PRODUCTION.md) for the readiness roadmap
(what's done & tested, what needs your keys, what's left).

**Two run modes, one codebase:**
- **Zero-setup** (no `DATABASE_URL`): runs entirely in-memory with a deterministic
  fixture provider — the demo and tests work with `npm run dev` and nothing else.
- **Real backend** (`DATABASE_URL` set): Postgres persistence + multi-tenancy,
  email/password auth, and a real RAG pipeline on pgvector (chunk → embed →
  retrieve → score → cite → refuse). LLM/embeddings/email/billing are behind
  interfaces selected by env (mock transports until you add keys).

## Stack

Next.js 15 (App Router, RSC) · TypeScript (strict) · Tailwind CSS v4 ·
TanStack Query · zustand · zod · Framer Motion · Geist + Geist Mono · Vitest.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

> **Note for OneDrive / network drives without symlink support:** if
> `npm install` fails with `EPERM: operation not permitted, symlink`, install
> with `npm install --no-bin-links` and run the toolchain via `node` directly
> (e.g. `node node_modules/next/dist/bin/next dev`,
> `node node_modules/typescript/lib/tsc.js --noEmit`,
> `node node_modules/vitest/vitest.mjs run`).

### Entry points

- `/` — marketing landing page (interactive proof card, auto-playing DemoStage,
  integration marquee, play-once feature demos, pricing).
- `/demo` — creates an unauthenticated **sandbox session** (server-seeded mock
  workspace, no persistence, rate-limited AI) and drops you into the hero inbox
  with the guided "Try it yourself" checklist.
- `/signin` — the regular sign-in flow (separate from demo); lands on `/home`.
- The app: `/home`, `/inbox/[ticketId]`, `/tickets`, `/customers/[id]`, `/kb`,
  `/copilot`, `/automations`, `/analytics`, `/integrations`, `/settings/[tab]`.

## Quality gates

```bash
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint         # eslint (next/core-web-vitals + typescript)
npm test             # vitest — 39 unit tests
npm run test:e2e     # playwright — critical-path smoke (builds + starts the app)
npm run build        # next build
```

Unit tests cover where they earn their keep: the confidence color scale (incl.
exact 0.80/0.65 boundaries), the inbox data layer (filters/counts/search), the
automations engine (triggers/conditions/actions + the low-confidence safety
net), the mock AI provider's keyword routing + KB-grounded SSO refusal, and the
command-palette keyboard handling. The Playwright smoke suite (`e2e/`) drives the
real browser through the demo boot, the accept-draft loop, the SSO refusal/error
state, the ⌘K palette, and the playground refusal — proving styles load and the
happy path works end-to-end. CI (`.github/workflows/ci.yml`) runs both on every
push/PR.

## Production posture

- **Security headers** on every response (strict CSP, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in prod);
  `x-powered-by` removed. Session cookies are `httpOnly` + `secure` in prod.
- **Error boundaries** (root + app-section) and a styled 404 — never a white
  stack trace; an app-shell loading skeleton avoids layout shift.
- **`/api/health`** liveness probe (unauthenticated, dependency-free) reports
  the active AI provider.
- **Structured JSON logging** (`src/server/logger.ts`) is the seam for a log
  pipeline; analytics events flow through it.
- **Config** via env (`.env.example`): `AI_PROVIDER`, the real-provider keys,
  `DEMO_AI_CALL_LIMIT`.

## How the AI works (and swaps for a real provider)

Everything the UI calls goes through one `DraftProvider` interface
(`src/server/ai/provider.ts`): `regenerate`, `rewrite`, `answer`. The bundled
`MockDraftProvider` answers from fixture data with the design's keyword routing
and latencies; a production provider implements the same interface as a full
RAG pass (ingestion → chunking → embedding → retrieval → drafting → citation
extraction → confidence scoring). The refusal path is first-class: **no grounded
source ⇒ no draft** — the AI never silently guesses. This is the cross-page
thread tying inbox `TKT-1024`, the failed SSO doc in the Knowledge Base, and the
playground's refusal.

## Notes

- Dark theme only; desktop-first (≥1240px). Panes scroll internally; the shell
  never scrolls.
- The session store is in-memory and per-session (interface-isolated so
  Postgres/Drizzle can replace it without touching route handlers). Single
  process; sessions evaporate on restart — a deliberate v1 trade-off documented
  in `ARCHITECTURE.md`.
