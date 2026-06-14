# Deploying Proofline

This is the runbook to take Proofline from "runs locally" to "live for real users."
The app is a standard Next.js 15 standalone build; the only stateful dependency is
Postgres (with pgvector). Pick **one** of the two paths below.

> TL;DR: provision Postgres → set env vars → run `npm run db:migrate` once → deploy
> the app → point `NEXT_PUBLIC_APP_URL` at your HTTPS domain → set the Stripe webhook.

---

## 0. Prerequisites (once)

- **Postgres 15+ with pgvector** — AWS RDS, Supabase, Neon, or self-hosted. You already
  have an RDS instance (`proofline`); a managed instance with automated backups is recommended.
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

## Path A — Vercel (fastest)

1. Import the repo in Vercel. Framework preset: **Next.js** (auto-detected).
2. Add the env vars from §1 (Project → Settings → Environment Variables).
3. Deploy. Set `NEXT_PUBLIC_APP_URL` to your assigned/custom domain and redeploy.
4. Run §2 migrations (Vercel doesn't run them — do it from CI or locally).
5. Set `RATE_LIMIT_PROXY_HOPS=1` (Vercel is behind its edge).

**Serverless caveat:** sessions are DB-backed (fine on serverless), but the rate limiter is
in-process — on serverless it's per-instance and weak. For real rate limiting on Vercel,
add the Redis-backed store (see Track-4 `RateStore`/`REDIS_URL`, e.g. Upstash).

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
- **Gmail (when built):** create a Google OAuth client; set the id/secret + callback
  `https://<domain>/api/integrations/gmail/callback`.

## 6. Post-deploy smoke test

1. `GET /api/health/ready` → `{"status":"ready","backend":"postgres"}`.
2. Sign up → land in an empty workspace with the onboarding home.
3. `/widget-preview` → send a chat → it appears in `/inbox` → reply → it returns to the widget.
4. Open a ticket → generate a draft → confirm it's grounded with citations + a confidence score.
5. Confirm session cookies are `Secure` (HTTPS) in the browser devtools.

## 7. Hardening before scale

- Redis-backed rate limiting + (optional) sessions across instances (`REDIS_URL`).
- `DB_SSL=verify` with your provider's CA bundle (`NODE_EXTRA_CA_CERTS`).
- Sentry/OTel error + metrics; uptime monitoring on `/api/health`.
- RDS automated backups + PITR (your instance already has 7-day retention) and a read replica.
