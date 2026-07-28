# Deploying Proofline

This is the runbook to take Proofline from "runs locally" to "live for real users."
The app is a standard Next.js 15 standalone build; the only stateful dependency is
Postgres (with pgvector). Pick **one** of the two paths below.

> TL;DR: provision Postgres → set env vars → run `npm run db:migrate` once → deploy
> the app → point `NEXT_PUBLIC_APP_URL` at your HTTPS domain → set the Stripe webhook.

---

## 0. Prerequisites (once)

- **Postgres 15+ with pgvector** — AWS RDS, Supabase, Neon, or self-hosted. A managed
  instance with automated backups is recommended.
- A **domain** with HTTPS (the platform below terminates TLS for you).
- API keys you want live (all optional — each falls back to a working keyless mode):
  OpenAI, Resend (+ a verified sender), Stripe (+ price ids), a Google OAuth client (Gmail).

## 1. Environment variables

Copy from `.env.example`. Minimum for a real deployment:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/proofline?sslmode=require` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your HTTPS domain, e.g. `https://app.proofline.com`. Used for email links + the widget embed. |
| `RATE_LIMIT_PROXY_HOPS` | ✅ (behind a proxy) | `1` for a single edge/ALB; lets the rate limiter read the real client IP. |
| `LLM_PROVIDER` + `OPENAI_API_KEY` | for real AI | `LLM_PROVIDER=openai`; without it, the grounded template drafter is used. |
| `EMBEDDINGS_PROVIDER` + `OPENAI_API_KEY` | for semantic RAG | `=openai`; re-index the KB after switching (lexical→semantic). |
| `EMAIL_PROVIDER` + `RESEND_API_KEY` + `EMAIL_FROM` | for email | `=resend`; verify your sending domain in Resend first. |
| `BILLING_PROVIDER` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_GROWTH` + `STRIPE_PRICE_SCALE` | to charge | see §5. |
| `INVITE_SECRET` | ✅ (prod) | HMAC-SHA256 signing key for invite tokens. Falls back to a hardcoded dev key if unset — **insecure in production; always set this**. Generate with `openssl rand -hex 32`. |
| `ERROR_WEBHOOK_URL` | optional | Slack/Discord webhook for error alerts. |
| `DB_SSL` | optional | `verify` (strict, with `NODE_EXTRA_CA_CERTS` = your provider CA) or `disable`. |

Everything not set runs in its safe keyless mode, so the app boots and works with just
`DATABASE_URL` + `NEXT_PUBLIC_APP_URL`.

## 2. Run migrations (once per deploy that adds migrations)

From a checkout (CI release step or your machine) pointed at the **production** database:

```bash
DATABASE_URL='postgresql://…?sslmode=require' npm run db:migrate
```

This creates the `vector` extension and applies everything in `drizzle/`. It's plain ESM
(`scripts/migrate.mjs`) so it runs on any Node 18+. Run it **before** the new app version
serves traffic. (Don't run it from inside the slim runtime image — its node_modules is
trimmed to the server.)

---

## Path 0 — stateless demo (no database, zero config)

Deploy the repo to Vercel (or any Node host) with **no env vars at all**: without
`DATABASE_URL` the app boots as the in-memory demo — every visitor gets a seeded
sandbox workspace, the AI is the deterministic mock, and nothing persists. The
production env validator logs its hard-fails as warnings in this mode (there is
nothing durable to protect). Sessions reset on cold starts/redeploys; visitors
are transparently re-entered through `/demo`. This is the mode to link from a
portfolio; Paths A/B below are for running it as a real product.

This build is also **embeddable** — it serves `frame-ancestors *` with no
`X-Frame-Options`, and its session cookie is `SameSite=None; Secure;
Partitioned` so a sandbox survives inside a cross-site iframe (partitioned per
embedding page). See the README for the snippet. Both relaxations are keyed
strictly to the absence of `DATABASE_URL`: a real deployment still denies
framing and keeps `SameSite=Lax`.

## Path A — Vercel (fastest)

1. Import the repo in Vercel. Framework preset: **Next.js** (auto-detected).
2. Add the env vars from §1 (Project → Settings → Environment Variables).
3. Deploy. Set `NEXT_PUBLIC_APP_URL` to your assigned/custom domain and redeploy.
4. Run §2 migrations (Vercel doesn't run them — do it from CI or locally).
5. Set `RATE_LIMIT_PROXY_HOPS=1` (Vercel is behind its edge).

**Serverless caveat:** sessions are DB-backed (fine on serverless), but the rate limiter is
in-process — on serverless it's per-instance and weak. For real rate limiting on Vercel,
set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (dep-free Upstash store).

## Path B — Docker (Fly.io / Render / ECS / Railway)

The `Dockerfile` produces a lean standalone, non-root image with a `/api/health` healthcheck.

```bash
docker build -t proofline .
docker run -p 3000:3000 --env-file .env.production proofline
# or docker-compose up   (bundles a pgvector Postgres for local/staging)
```

- Put it behind a TLS-terminating load balancer/proxy; set `RATE_LIMIT_PROXY_HOPS` to the
  number of proxies in front.
- Health: `GET /api/health` (liveness) and `GET /api/health/ready` (pings Postgres — use
  this as the readiness/rolling-deploy gate).
- Run §2 migrations as a release/init step (from a full checkout, not the slim image).
- Graceful shutdown is handled (SIGTERM drains the DB pool).

---

## 5. Go-live provider checklist

- **OpenAI:** fund the API account; set `LLM_PROVIDER=openai` + `OPENAI_API_KEY`. Optionally
  `EMBEDDINGS_PROVIDER=openai` (then re-index the KB).
- **Resend:** verify your domain; set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`.
- **Stripe:** create the Growth/Scale products + recurring prices; set the keys + price ids;
  add a webhook endpoint pointing at `https://<domain>/api/billing/webhook` (events:
  `checkout.session.completed`, `customer.subscription.created/updated/deleted`) and put its
  signing secret in `STRIPE_WEBHOOK_SECRET`.
- **Slack channel (inbound + outbound):** dormant until configured. Create a Slack
  app: bot scopes `channels:history, groups:history, im:history, chat:write,
  users:read`; enable OAuth with redirect `https://<domain>/api/integrations/slack/callback`;
  enable the Events API with request URL `https://<domain>/api/integrations/slack/events`
  and subscribe to `message.channels`. Set `SLACK_SIGNING_SECRET` (verifies inbound)
  + `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET` (install flow). An admin then clicks
  **Integrations → Slack → Connect**. Messages in subscribed channels become tickets;
  agent replies post back to the thread. Inbound is push (no polling) and idempotent
  (deduped by event ts); the webhook verifies every request's Slack signature.
- **Gmail channel (inbound + outbound email):** dormant until configured.
  1. In Google Cloud: create a project, enable the **Gmail API**, configure the
     OAuth consent screen, and create an **OAuth client (Web application)**.
  2. Add the redirect URI `https://<domain>/api/integrations/gmail/callback` to
     the client's authorized redirects.
  3. Set `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` (and `GMAIL_REDIRECT_URI` if it
     differs from the default `${NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`).
  4. An admin connects the support mailbox in **Integrations → Gmail → Connect**
     (OAuth consent). Outbound replies then send from that mailbox, threaded.
  5. **Inbound** is pull-based: `POST /api/integrations/gmail/poll`. An admin can
     hit "Sync inbound" in the panel; for always-on intake, run the poll on a
     schedule (cron/Cloud Scheduler) with header `x-gmail-poll-secret: $GMAIL_POLL_SECRET`
     and `?workspaceId=<id>`, or point a Gmail push (Pub/Sub) at the endpoint.
     Ingestion is idempotent (deduped by Message-ID), so re-polling is safe.

## 6. Post-deploy smoke test

1. `GET /api/health/ready` → `{"status":"ready","backend":"postgres"}`.
2. Sign up → land in an empty workspace with the onboarding home.
3. `/widget-preview` → send a chat → it appears in `/inbox` → reply → it returns to the widget.
4. Open a ticket → generate a draft → confirm it's grounded with citations + a confidence score.
5. Confirm session cookies are `Secure` (HTTPS) in the browser devtools.
6. **Invite flow:** Settings → Members → invite a second email → accept via the link in the email → confirm the new user lands in the workspace. (Validates `INVITE_SECRET` is wired correctly; a broken secret silently rejects all invite tokens.)

## 7. Scheduled cleanup (recommended if `/demo` is public)

Each `/demo` visit seeds a throwaway workspace and embeds the seed KB into pgvector.
Reap them so the database (and embedding cost) doesn't grow without bound:

```bash
# Set a secret, then hit the endpoint on a schedule (cron / Cloud Scheduler / a GitHub Action):
CLEANUP_SECRET=$(openssl rand -hex 32)
curl -fsS -X POST https://<domain>/api/admin/cleanup -H "x-cleanup-secret: $CLEANUP_SECRET"
```

It purges expired sessions and demo workspaces past the demo TTL with no live session
(cascading their embeddings). Hourly is plenty. Inert (401) until `CLEANUP_SECRET` is set.

## 8. Hardening before scale

- Redis-backed rate limiting across instances (`UPSTASH_REDIS_REST_URL`/`_TOKEN`).
- `DB_CA_CERT` (provider CA bundle) or `DB_SSL=verify` for strict database TLS.
- Sentry/OTel error + metrics; uptime monitoring on `/api/health`.
- Automated backups + PITR on your Postgres, and a read replica at scale.
