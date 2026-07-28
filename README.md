# Proofline

[![CI](https://github.com/eshan06/proofline/actions/workflows/ci.yml/badge.svg)](https://github.com/eshan06/proofline/actions/workflows/ci.yml)

**[▶ Live demo](https://proofline-rho.vercel.app/demo)** — no signup, nothing to install.

**Support that shows its work.** An omnichannel AI customer-support copilot: website
chat, email, and Slack unified into one inbox; an AI that drafts replies grounded in
the customer's own knowledge base with **citations and a confidence score on every
draft**; and a human who approves, edits, or escalates every send. The refusal path
is first-class: **no grounded source ⇒ no draft** — the AI never silently guesses.

![Proofline inbox — AI draft with citations and confidence](docs/screenshots/inbox.png)

## Run it locally (zero setup)

```bash
npm install
npm run dev          # → http://localhost:3000
```

No database, no API keys, nothing to configure: without `DATABASE_URL` the app runs
on an in-memory repository with a deterministic mock AI provider. Open
[`/demo`](http://localhost:3000/demo) for a seeded sandbox workspace with a guided
"try it yourself" checklist — accept an AI draft, upload a KB doc, watch the SSO
ticket refuse honestly.

**With Postgres** (real persistence, auth, and the actual RAG pipeline):

```bash
docker run -d --name pl-postgres -e POSTGRES_PASSWORD=proofline \
  -e POSTGRES_DB=proofline -p 5432:5432 pgvector/pgvector:pg16
echo "DATABASE_URL=postgres://postgres:proofline@localhost:5432/proofline" > .env.local
npm run db:migrate
npm run dev          # sign up at /signin — real accounts, real embeddings
```

Or the production-like stack in one command:
`INVITE_SECRET=$(openssl rand -hex 32) docker compose up --build`.

## Deploy the demo (one click, no database)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Feshan06%2Fproofline&project-name=proofline-demo&repository-name=proofline-demo)

The [live demo](https://proofline-rho.vercel.app/demo) above is this repo deployed
exactly this way, with no environment variables at all.

With no `DATABASE_URL`, a production deploy runs as the **stateless in-memory
demo**: every visitor gets a seeded sandbox workspace with the mock AI —
zero env vars, zero services, nothing durable to secure (the startup validator
relaxes its hard-fails to warnings in exactly this case). Sessions live in
process memory and reset on cold starts; the app recovers by re-entering
`/demo` automatically. Add the env vars from [`DEPLOY.md`](./DEPLOY.md) to turn
the same deployment into the real, database-backed product.

### Embed it in another page

The demo build is framable (`frame-ancestors *`, no `X-Frame-Options`), so it
drops into a portfolio or docs page as-is. The app is desktop-first, so give it
room:

```html
<iframe src="https://proofline-rho.vercel.app/demo"
        width="1280" height="760" style="border:0;border-radius:8px"
        title="Proofline demo"></iframe>
```

Its session cookie is `SameSite=None; Secure; Partitioned`, so the sandbox
survives inside a third-party frame and is partitioned per embedding page
(CHIPS) — each host page gets its own isolated demo. In browsers that block
third-party cookies outright (Safari by default), the frame still renders but
the sandbox resets on each navigation inside it, so keep a plain link to the
demo alongside the embed. A **database-backed** deployment is deliberately not
embeddable: it keeps `X-Frame-Options: DENY` and `SameSite=Lax`, because there
the session is a real credential for real tenant data.

## What's real vs. what's mocked

Every subsystem sits behind an interface with a real implementation **and** a
working keyless fallback, selected by env — the UI can't tell which is active, and
nothing crashes without a key.

| Subsystem | Keyless default | Real implementation (env flip) |
|---|---|---|
| Persistence | In-memory, per-session | Postgres + Drizzle, workspace-scoped multi-tenancy |
| Retrieval | Fixture-grounded | pgvector RAG: chunk → embed → cosine-kNN → score → cite → **refuse** |
| Embeddings | Local hashed vectors (free) | OpenAI `text-embedding-3-small` |
| LLM drafting | Grounded template drafter | OpenAI (graceful fallback) |
| Email | Console logger | Resend |
| Billing | Mock | Stripe — signature-verified webhooks, plans, seat gating |
| Channels | Website chat widget (fully real, end-to-end) | + Gmail OAuth sync, Slack Events API |

The website chat channel is real with zero keys: a public embed script
(`/api/widget/embed`, live preview at `/widget-preview`) opens tickets in the inbox,
and approved agent replies stream back to the visitor.

## Engineering highlights

- **RAG with honest refusals** — ingestion (text/MD/CSV/HTML/PDF/DOCX) → chunking →
  embeddings → cosine-kNN retrieval → confidence scoring → citation extraction, with
  an explicit ungrounded-refusal path threaded through the product (inbox error
  state, KB warning, playground refusal are all the same field).
- **Concurrency-safe invariants** — plan seat limits and the "last active Admin"
  rule are enforced atomically (`FOR UPDATE` row locks, transactional upserts), not
  read-then-write; invite tokens are single-use and re-checked at accept time.
- **Stripe webhooks done right** — constant-time signature verification that
  accepts dual signatures during secret rotation, an idempotency ledger with a
  compensating un-mark so a transient failure is actually retried, and an ordering
  watermark so a stale `past_due` can't clobber a newer `active`.
- **Abuse-resistant by default** — streamed request-body caps that ignore lying
  `Content-Length` headers, proxy-spoofing-resistant client IPs, per-IP +
  per-account + per-workspace token buckets, magic-byte sniffing on uploads,
  per-document chunk ceilings, and per-conversation message caps on the public
  widget intake.
- **Enumeration-safe auth** — signup/login/forgot are response-identical for
  existing vs. unknown emails, with timing-constant login and per-account throttles
  that survive IP rotation.
- **RBAC with a CI-enforced manifest** — every mutating route carries a
  `requireRole` gate, and a static route-policy test fails CI if a gate is dropped.
- **Fail-fast production config** — the server refuses to boot in production with a
  forgeable invite secret, missing app URL, half-configured Stripe, un-verified
  remote DB TLS, or plaintext channel tokens (AES-256-GCM at rest otherwise).
- **Tenant privacy** — complete GDPR export (including channel-captured end-customer
  PII), account deletion that also cancels + deletes the Stripe customer, and
  masked email addresses in logs.

## Quality gates

```bash
npm run typecheck    # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run lint         # eslint
npm test             # 189 Vitest tests (+5 real-Postgres concurrency tests, skipped without a DB)
npm run test:e2e     # 7 Playwright smoke scenarios (builds + boots the production server)
npm run build        # next build
```

CI (GitHub Actions) runs all of the above on every push and PR.

## Entry points

- `/` — marketing landing (interactive proof card, auto-playing demo stage, pricing).
- `/demo` — unauthenticated sandbox session: seeded workspace, rate-limited AI,
  guided checklist. Nothing persists past the session.
- `/signin` — real accounts (email/password, verification, reset); lands on `/home`.
- The app: `/home`, `/inbox/[ticketId]`, `/tickets`, `/customers/[id]`, `/kb`,
  `/copilot` (settings + playground), `/automations`, `/analytics`, `/integrations`,
  `/settings/[tab]`, `/widget-preview`.

![Proofline landing page](docs/screenshots/landing.png)

## Stack

Next.js 15 (App Router, RSC) · TypeScript strict · Tailwind CSS v4 · Drizzle ORM ·
Postgres + pgvector · TanStack Query · zustand · zod · Framer Motion · Vitest ·
Playwright.

## More docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the stack decisions and system shape,
  written as a design review before the code.
- [`PRODUCTION.md`](./PRODUCTION.md) — the readiness ledger: what's done and
  tested, what needs your keys, what's deliberately left.
- [`DEPLOY.md`](./DEPLOY.md) — the runbook (Vercel or Docker), migrations, provider
  checklist, post-deploy smoke test.

## Notes

- Dark theme only; desktop-first (≥1240px) by design. The marketing site is
  responsive; the app targets an agent's desktop.
- On filesystems without symlink support (some network drives), install with
  `npm install --no-bin-links` and invoke tools via `node node_modules/<pkg>/<entry>`.
