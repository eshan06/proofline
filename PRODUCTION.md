# Proofline — Production Readiness

Status of the path from "high-fidelity product on mock data" to "a SaaS a team can
deploy, onboard onto, and pay for." This is the durable roadmap; it reflects what
is **done and tested**, what needs **your accounts/keys**, and what's **left**.

Legend: ✅ done & tested · 🔌 built, needs your credentials to go live · ⛏️ remaining work

---

## Done — built and verified in this repo

### Frontend & UX ✅
- All 10 app surfaces + landing + demo, pixel-faithful to the design (verified via
  1440px screenshots and a 7-case Playwright smoke suite).
- TypeScript strict, zod contracts, deep-linkable URLs, optimistic updates with
  rollback, ⌘K palette / J-K / ⌘↵ keyboard model, ARIA on overlays.
- Error boundaries, styled 404, loading skeletons, empty/error states.
- Security headers (strict CSP, X-Frame-Options, nosniff, Referrer/Permissions
  policy, HSTS in prod), `x-powered-by` removed, secure cookies in prod.

### Persistence & multi-tenancy ✅
- Postgres (Drizzle) repository behind a clean interface; in-memory fallback for
  zero-setup dev/demo. Selected by `DATABASE_URL`.
- Every record workspace-scoped → tenant isolation enforced server-side. Verified:
  two signups → two isolated workspaces; a reply persists in `tickets.messages` and
  round-trips.
- Migrations (`db:generate` / `db:migrate` / `db:push`); pgvector + HNSW index.

### Auth ✅
- Email/password signup + login + logout (scrypt hashing, DB-backed sessions).
  Verified: login ok / wrong password 401. Middleware requires auth in DB mode.
- **Session ids are cryptographically random** (`crypto.getRandomValues`, not a
  guessable timestamp+counter) — the cookie is the bearer credential, so this
  closes session prediction/hijacking.
- **Timing-constant login** (scrypt runs on the no-such-user path) defeats email
  enumeration; **per-account throttle** bounds brute force even under IP rotation.
- **CSRF defense**: mutating `/api/*` requests with a foreign `Origin` are
  rejected in middleware (verified: cross-origin POST → 403; widget intake +
  Stripe webhook exempt by design).

### Channels ✅ (website chat — first real round-trip)
- **Website chat widget, end-to-end**: a public embed script (`/api/widget/embed`)
  mounts a launcher on any site; visitor messages hit an origin-allowlisted,
  unauthenticated intake (`/api/widget/[siteKey]/messages`) that opens/append to
  a real ticket; approved agent replies stream back to the visitor by polling.
  Authorized by a public site key (tenant) + an unguessable per-visitor token
  (conversation) — never a cookie. Verified end-to-end via curl: inbound →
  ticket in inbox → agent reply → delivered to the widget; forged tokens and
  unknown site keys 404; CORS preflight + cross-origin POST work. The real embed
  snippet + a live preview (`/widget-preview`) are in the product.

### AI / RAG ✅
- Real pipeline on pgvector: chunk → embed → store; cosine-kNN retrieval;
  confidence scoring; citation extraction; **refusal when ungrounded**. Verified
  against live Postgres: refund/invite/slack/plan-sync/bug-chart ground with
  sensible confidence; SSO + gibberish refuse.
- Everything behind interfaces (`DraftProvider`, `EmbeddingProvider`, `LLMProvider`)
  so the providers below are drop-in.

### Infra ✅
- Token-bucket rate limiting on auth + AI + widget endpoints (verified 429 after
  burst). The client-IP key is **proxy-spoofing resistant** (rightmost
  `x-forwarded-for` by default; `RATE_LIMIT_PROXY_HOPS` for deeper chains), and
  demo-session minting is itself rate-limited so a cookie reset can't farm AI budget.
- Structured JSON logging, `/api/health` (liveness) + `/api/health/ready`
  (readiness — pings Postgres in DB mode), GitHub Actions CI (typecheck/lint/test/build + e2e).
- Dockerfile (standalone, non-root, healthcheck) + docker-compose (app + pgvector).
- 58 unit tests + 7 E2E.

### Identity & data integrity ✅
- The **real signed-in user** drives the app shell (sidebar, topbar, home greeting)
  and authors their own replies / status changes — no more hardcoded "Eshan Patel".
  Verified: signup → workspace payload carries `currentUser`.
- Signup provisioning (user + seeded workspace + membership) is **transaction-wrapped**
  — a mid-seed failure can't orphan a user or leave a half-workspace; corpus
  embedding runs after commit, best-effort.
- **Real audit events** recorded on member invites and integration connect/disconnect.

---

## 🔌 Needs your accounts / keys (interfaces ready; flip an env var + wire the branch)

| Capability | Env | What you provide | Where to wire |
|---|---|---|---|
| **Database** | `DATABASE_URL` | An AWS RDS Postgres (with pgvector) URL | already consumed — just set it + run `db:migrate` |
| **LLM drafting** | `LLM_PROVIDER=anthropic\|openai` + key | Anthropic/OpenAI key | `src/server/ai/llm.ts` (marked TODO) |
| **Embeddings** | `EMBEDDINGS_PROVIDER=openai\|voyage` + key | Embedding API key | `src/server/ai/embeddings.ts` (marked TODO) |
| **Email** | `EMAIL_PROVIDER=resend\|postmark\|ses` + key | Transactional email provider | `src/server/email/index.ts` (marked TODO) |
| **Billing** | `BILLING_PROVIDER=stripe` + keys | Stripe secret + webhook secret + price IDs | `src/server/billing/index.ts` + `/api/billing/webhook` (marked TODO) |
| **App URL** | `NEXT_PUBLIC_APP_URL` | Your domain | already consumed |

Each TODO branch currently falls back to a working dev transport, so nothing
crashes if a key is missing — it just runs in mock/local mode.

---

## ⛏️ Remaining engineering

**Auth & accounts**
- OAuth (Google) and SAML SSO/SCIM for the Scale tier.
- Password-reset delivery (template + token table exist; wire the email send + `/reset` page).
- Email verification on signup.

**Channels (the actual ingestion)**
- ✅ Website chat widget (embed → message → ticket → reply back) — shipped, see above.
- Gmail OAuth + sync; Slack app (events API). The Integrations UI + setup panels exist;
  the OAuth flows and inbound webhooks are the work.
- Outbound send: ✅ delivered for web chat (reply streams to the widget). Email/Slack
  outbound delivery on approve is the remaining piece.

**RAG quality & scale**
- ✅ Real KB file upload + ingestion for text formats (.txt/.md/.csv/.json/.html →
  chunk → embed → pgvector). PDF/Docx need a document-parser add-on (pdf-parse/mammoth)
  — currently surfaced as a clear 415.
- Wire a real embedding model (local hashed vectors are dev-only) and re-index.
- Background ingestion jobs (incremental re-sync) and a job queue (pg-boss/BullMQ)
  instead of synchronous ingestion on the request path.
- Re-ranking and evaluation harness for retrieval quality.

**Billing**
- Stripe products/prices, seat-based metering, plan gating (enforce plan limits),
  customer portal, dunning. Webhook handler skeleton is in place.

**Compliance & legal**
- Replace the templated Privacy/Terms/Security pages with counsel-reviewed copy.
- DPA + sub-processor list; GDPR/CCPA data-export & deletion endpoints.
- SOC 2 program for enterprise deals.
- Audit log: ✅ now records invites + integration changes; extend to role changes,
  draft approvals, logins, and add an export.

**Ops**
- Managed Postgres (RDS) with backups/PITR + read replica; Redis for rate limits
  and sessions across instances (the in-process token-bucket store is correct for a
  single instance but multiplies limits per replica).
- Error reporting (Sentry) wired to the existing logger seam; metrics + alerting; uptime/status automation.
- Graceful shutdown (SIGTERM drain + pool close). Readiness probe ✅ (`/api/health/ready`).
- Load testing; autoscaling; CDN for static assets.

**Product polish**
- ✅ Real signed-in user in the app shell (name/email/initials/role) + real reply authorship.
- Onboarding first-run checklist for real (the demo checklist is the pattern).
- Accessibility audit to WCAG AA; the app is desktop-first by design (≥1240px) —
  decide whether a mobile app experience is in scope (marketing site is responsive).
- Analytics to a real sink (PostHog/Segment) via the existing `trackEvent` seam.

---

## Recommended sequence

The thin vertical slice that turns this into a sellable product, in order:

1. **Provision Postgres (RDS) + set `DATABASE_URL`** → real persistence/auth/RAG live.
2. **Wire one LLM + embedding provider** → genuinely useful drafts.
3. **One real channel** (Gmail or website chat) end-to-end, including outbound send.
4. **Stripe** (products, checkout, webhooks, plan gating).
5. **Legal + email verification + password reset** → safe to open signups.
6. Harden: Sentry, Redis, backups, SSO.

Everything in steps 1–4 is already scaffolded with interfaces and tests; the work
is filling the marked TODO branches and connecting your accounts.
