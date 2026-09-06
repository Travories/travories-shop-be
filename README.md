<h1 align="center">Medusashop</h1>

<p align="center">
  The souvenir storefront for <a href="https://travories.com">Travories</a> — Nepal's trek-booking marketplace.<br/>
  A Medusa v2 backend and a Next.js storefront in one Turborepo, built for NPR (VAT-inclusive) pricing and eSewa checkout.
</p>

---

## Overview

Medusashop is a monorepo with two apps:

| App | Package | Stack | Runs on |
|-----|---------|-------|---------|
| **Backend** | `@dtc/backend` | Medusa v2, Node 20+, PostgreSQL, Redis | Self-hosted (Docker) |
| **Storefront** | `@dtc/storefront` | Next.js (App Router), React 19, Tailwind | Vercel |

The backend serves the Store/Admin APIs and the admin dashboard (`/app`). The storefront is a server-rendered Next.js app that talks to the backend over the Store API using a publishable key.

- **Region:** defaults to `np` (Nepal); prices are NPR, VAT-inclusive.
- **Payments:** eSewa ePay v2 (hosted checkout) via a custom `payment-nepal` module.
- **Media:** local-file provider by default; optional S3-compatible (Garage) storage.

> Repo conventions, directory layout, and commands for contributors live in [AGENTS.md](./AGENTS.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ (or 22.12+)
- [npm](https://www.npmjs.com/) 11+ (this repo uses npm — see `packageManager` in `package.json`; do not introduce a second lockfile)
- [PostgreSQL](https://www.postgresql.org/) 15+
- [Docker](https://www.docker.com/) (for local Redis, and for the production backend deploy)

## Local development

**1. Install dependencies** (from the repo root):

```bash
git clone <your-repo-url> medusashop
cd medusashop
npm install
```

**2. Configure the backend:**

```bash
cp apps/backend/.env.template apps/backend/.env
```

Edit `apps/backend/.env` and set at least:

```bash
DATABASE_URL=postgres://postgres:@localhost:5432/medusa-backend
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
```

**3. Start Redis** (Postgres is expected to run on your host):

```bash
docker compose up -d redis
```

**4. Run migrations and create an admin user:**

```bash
cd apps/backend
npm exec medusa db:migrate
npm exec medusa user -e admin@test.com -p supersecret
cd ../..
npm run backend:seed        # optional: seed demo catalogue data
```

**5. Configure the storefront:**

```bash
cp apps/storefront/.env.template apps/storefront/.env.local
```

Start the backend, open the admin at `http://localhost:9000/app`, and grab a key from
**Settings → Publishable API Keys**. Put it in `apps/storefront/.env.local`:

```bash
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
```

**6. Run both apps** (from the repo root):

```bash
npm run dev
```

- Storefront → http://localhost:8000
- Backend / Admin → http://localhost:9000 (admin at `/app`)

Run just one app with `npm run backend:dev` or `npm run storefront:dev`.

## Project structure

```text
.
├── apps/
│   ├── backend/        # @dtc/backend — Medusa v2 app (API, admin, custom modules)
│   └── storefront/     # @dtc/storefront — Next.js storefront (deployed to Vercel)
├── compose.yaml        # Production VPS stack: postgres + redis + backend + caddy
├── Dockerfile          # Multi-stage build for the Medusa backend
├── Caddyfile           # Reverse proxy + automatic HTTPS for the backend
├── turbo.json          # Turborepo task graph
└── AGENTS.md           # Contributor guide: structure, commands, conventions
```

## Environment variables

### Storefront (`apps/storefront/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable API key from the backend | — |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | URL of the Medusa backend | `http://localhost:9000` |
| `NEXT_PUBLIC_DEFAULT_REGION` | Default region country code | `np` |
| `NEXT_PUBLIC_BASE_URL` | Base URL of the storefront | `http://localhost:8000` |
| `NEXT_PUBLIC_STRIPE_KEY` | Stripe publishable key (optional) | — |

### Backend (`apps/backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` / `COOKIE_SECRET` | Session/auth secrets |
| `STORE_CORS` | Allowed storefront origins (comma-separated) |
| `ADMIN_CORS` / `AUTH_CORS` | Allowed admin/auth origins |
| `S3_*` | Optional S3-compatible media storage (leave blank for local files) |
| `ESEWA_*` | eSewa ePay v2 checkout config (`EPAYTEST` = sandbox) |

See each app's `.env.template` for the full list.

## Deployment

The backend is **self-hosted with Docker Compose**; the storefront is **deployed on Vercel**. Deploy the backend first — the storefront's build fetches from it.

### Backend — VPS (Docker Compose)

The root `compose.yaml` runs the full stack: **Caddy (auto-HTTPS) → backend → PostgreSQL + Redis**, with persistent volumes.

1. **DNS:** point an A-record (e.g. `api.yourdomain.com`) at the VPS IP, and open ports **80** and **443**.
2. **Domain:** replace `api.yourdomain.com` in `Caddyfile` with your subdomain.
3. **Environment:** create the root `.env` from the template and fill it in (secrets, `DATABASE_URL`, and CORS — `STORE_CORS` = your Vercel URL, `ADMIN_CORS`/`AUTH_CORS` = your backend domain):

   ```bash
   cp .env.template .env
   openssl rand -base64 32   # run twice — for JWT_SECRET and COOKIE_SECRET
   nano .env
   ```

4. **Launch** (migrations run automatically on boot):

   ```bash
   docker compose up -d --build
   docker compose logs -f backend        # wait for "Server is ready"
   ```

5. **Create an admin user** (and optionally seed data):

   ```bash
   docker compose exec backend npx medusa user -e you@email.com -p yourpassword
   ```

6. **Publishable key:** log into `https://api.yourdomain.com/app` → **Settings → Publishable API Keys** → copy the new `pk_...`.

### Storefront — Vercel

Set these environment variables in the Vercel project, then deploy:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL` = `https://api.yourdomain.com`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` = the `pk_...` from the step above

The storefront pre-renders category/collection/product pages at build time, so the backend must be live and reachable before the storefront build runs.

## Resources

- [Medusa Documentation](https://docs.medusajs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Caddy Documentation](https://caddyserver.com/docs/)
