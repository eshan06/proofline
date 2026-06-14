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
- 101 unit tests + 3 Postgres integration tests (concurrency; skipped without a DB) + 7 E2E.

### Identity & data integrity ✅
- The **real signed-in user** drives the app shell (sidebar, topbar, home greeting)
  and authors their own replies / status changes — no more hardcoded "Eshan Patel".
  Verified: signup → workspace payload carries `currentUser`.
- Signup provisioning (user + seeded workspace + membership) is **transaction-wrapped**
  — a mid-seed failure can't orphan a user or leave a half-workspace; corpus
  embedding runs after commit, best-effort.
- **Real audit events** recorded on member invites and integration connect/disconnect.

### Reliability ✅
- **Concurrency-safe ticket writes**: every Postgres read-modify-write on a ticket
  (reply, note, status patch, draft, inbound-email append) runs `SELECT … FOR UPDATE`
  inside a transaction, so concurrent writers can't clobber each other's messages
  (the lost-update race). `saveTicket` merges messages by id; the draft route persists
  only automation-changed fields. **Proven** by an integration test against real
  Postgres: 20 concurrent replies all retained, concurrent new-thread email ingest →
  exactly one ticket, dup message-ids deduped.
- **Inbound-email ingest** is one transaction with `ON CONFLICT DO NOTHING` thread
  creation (no orphan tickets / no PK-violation aborting a batch) — safe under
  concurrent polling / Pub/Sub push; the poll loop isolates per-message failures.
- **Distributed rate limiting** seam: in-process by default; set
  `UPSTASH_REDIS_REST_URL` + `_TOKEN` for a dep-free Upstash token-bucket (atomic
  Lua EVAL, correct across instances, fails open on outage).
- **Error-tracking** seam: `logger.setErrorSink()` forwards every `reportError` to an
  optional sink (Sentry/APM); `instrumentation.ts` documents the build-safe wiring.
- **DB TLS**: `DB_CA_CERT` (provider CA bundle) enables strict verification without
  `NODE_EXTRA_CA_CERTS`; an unverified remote connection logs a one-time MITM warning.
- **RDS**: 7-day automated backups + PITR ✅, **deletion protection enabled** ✅.
  Gaps (need a disruptive migration / cost, deferred): storage encryption-at-rest
  (snapshot→encrypted-restore), Multi-AZ failover, read replica.

---

## 🔌 Needs your accounts / keys (interfaces ready; flip an env var + wire the branch)

| Capability | Env | What you provide | Status |
|---|---|---|---|
| **Database** | `DATABASE_URL` | AWS RDS Postgres (pgvector) URL | ✅ wired (TLS auto) — set it + run `db:migrate` |
| **LLM drafting** | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` | OpenAI key | ✅ wired (gpt-4o-mini, graceful fallback). `anthropic` is the remaining branch |
| **Embeddings** | `EMBEDDINGS_PROVIDER=openai` + `OPENAI_API_KEY` | OpenAI key | ✅ wired (text-embedding-3-small @ EMBEDDING_DIM) — re-index after switching. `voyage` TODO |
| **Email** | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM` | Resend key + sender | ✅ wired (Postmark/SES are stubs) |
| **Billing** | `BILLING_PROVIDER=stripe` + secret/webhook secret/price ids | Stripe account | ✅ wired — signature-verified webhook + plan/seat gating |
| **App URL** | `NEXT_PUBLIC_APP_URL` | Your domain | ✅ consumed |
| **Error alerts** (opt) | `ERROR_WEBHOOK_URL` | Slack/Discord webhook | ✅ wired (logs always; alerts when set) |

Every provider falls back to a working keyless transport (mock/console/local/template),
so nothing crashes without a key — set the env var to go live.

---

## ⛏️ Remaining engineering

**Auth & accounts**
- ✅ Password reset (/forgot + /reset + tokens) and email verification — shipped.
- ✅ CSRF defense, per-account login throttle, timing-constant login — shipped.
- OAuth (Google) and SAML SSO/SCIM for the Scale tier — remaining.

**Channels (the actual ingestion)**
- ✅ Website chat widget (embed → message → ticket → reply back) — shipped, see above.
- Gmail OAuth + sync; Slack app (events API). The Integrations UI + setup panels exist;
  the OAuth flows and inbound webhooks are the work.
- Outbound send: ✅ delivered for web chat (reply streams to the widget). Email/Slack
  outbound delivery on approve is the remaining piece.

**RAG quality & scale**
- ✅ Real KB upload + ingestion for text/Markdown/CSV/JSON/HTML **and PDF/DOCX**
  (pdf-parse/mammoth) → chunk → embed → pgvector.
- ✅ Real semantic embeddings (`EMBEDDINGS_PROVIDER=openai`, text-embedding-3-small);
  local hashed vectors remain the free default. Re-index when switching.
- Background ingestion jobs (incremental re-sync) and a job queue (pg-boss/BullMQ)
  instead of synchronous ingestion on the request path — remaining.
- Re-ranking and evaluation harness for retrieval quality — remaining.

**Billing**
- ✅ Real Stripe provider: signature-verified webhook, checkout, persisted
  subscription, and seat-limit gating (Free 2 / Growth 10 / Scale 50).
- Customer portal, dunning, proration, usage-based metering — remaining.

**Compliance & legal**
- ✅ GDPR/CCPA data-export + account/workspace deletion endpoints.
- ✅ Audit log records invites + integration changes (extend to role changes,
  draft approvals, logins).
- Replace the templated Privacy/Terms/Security pages with counsel-reviewed copy.
- DPA + sub-processor list; SOC 2 program for enterprise deals — remaining.

**Ops**
- ✅ Graceful shutdown (SIGTERM drains the pool), `/api/health/ready` readiness
  probe, error reporting seam (`logger.reportError` → `ERROR_WEBHOOK_URL` + pluggable
  `setErrorSink` for Sentry/APM).
- ✅ Concurrency-safe ticket writes (row-locked); ✅ RDS backups/PITR + deletion
  protection; ✅ distributed rate-limit store seam (Upstash REST); ✅ strict-TLS via
  `DB_CA_CERT`.
- Remaining: activate Redis/Sentry by setting env (seams shipped); sessions across
  instances are already DB-backed; RDS storage encryption-at-rest + Multi-AZ + read
  replica (disruptive/cost — deferred); OTel metrics, load testing, autoscaling, CDN.

**Product polish**
- ✅ Real signed-in user in the app shell (name/email/initials/role) + real reply authorship.
- Onboarding first-run checklist for real (the demo checklist is the pattern).
- Accessibility audit to WCAG AA; the app is desktop-first by design (≥1240px) —
  decide whether a mobile app experience is in scope (marketing site is responsive).
- Analytics to a real sink (PostHog/Segment) via the existing `trackEvent` seam.

---

## Recommended sequence

The thin vertical slice that turns this into a sellable product, in order:

1. ✅ **Postgres (RDS) + `DATABASE_URL`** — live (TLS auto, migrations applied).
2. ✅ **LLM + embeddings** (`LLM_PROVIDER=openai`, optionally `EMBEDDINGS_PROVIDER=openai`).
3. ✅ **One real channel** — website chat widget, end-to-end (inbound + outbound).
4. ✅ **Stripe** — signature-verified webhook + plan/seat gating (set keys + price ids to charge).
5. ✅ **Email verification + password reset** — shipped (set `EMAIL_PROVIDER=resend` to deliver).
6. ✅ **Reliability hardened**: row-locked concurrent ticket writes (proven against
   real Postgres), RDS backups/PITR + deletion protection, distributed rate-limit
   (Upstash) + error-sink (Sentry) + strict-TLS seams.
7. ✅ **Gmail channel** (inbound + outbound) — dormant until Google OAuth creds; see DEPLOY.md.
8. **Remaining**: activate Redis/Sentry via env, Slack channel, OAuth/SSO,
   RDS encryption-at-rest + Multi-AZ, OTel metrics, counsel-reviewed legal copy.

Everything in steps 1–4 is already scaffolded with interfaces and tests; the work
is filling the marked TODO branches and connecting your accounts.
