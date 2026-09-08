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
| **Storefront** | `@dtc/storefront` | Next.js (App Router), React 19, Tailwind | Self-hosted (Docker) or Vercel |

The backend serves the Store/Admin APIs and the admin dashboard (`/app`). The storefront is a server-rendered Next.js app that talks to the backend over the Store API using a publishable key.

- **Region:** defaults to `np` (Nepal); prices are NPR, VAT-inclusive.
- **Payments:** eSewa ePay v2 (hosted checkout) via a custom `payment-nepal` module.
- **Media:** local-file provider by default; optional S3-compatible (Garage) storage.

> Repo conventions, directory layout, and commands for contributors live in [AGENTS.md](./AGENTS.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ (or 22.12+)
- [npm](https://www.npmjs.com/) 11+ (this repo uses npm — see `packageManager` in `package.json`; do not introduce a second lockfile)
- [PostgreSQL](https://www.postgresql.org/) 15+ — **external**, not managed by this repo
- [Redis](https://redis.io/) — **external**, not managed by this repo
- [Docker](https://www.docker.com/) (only for the containerised deploy of the two apps)

> PostgreSQL, Redis, and the reverse proxy / TLS terminator all live **outside** this repo. `compose.yaml` builds and runs the backend and the storefront, and nothing else — point `DATABASE_URL` and `REDIS_URL` at wherever those services actually run.

## Local development

**1. Install dependencies** (from the repo root):

```bash
git clone <your-repo-url> medusashop
cd medusashop
npm install
```

**2. Configure the environment** — one file for both apps:

```bash
cp .env.example .env
```

There is a **single `.env` at the repo root**; the backend and storefront both read it (there are no per-app `.env` files). Set at least:

```bash
DATABASE_URL=postgres://postgres:@localhost:5432/medusa-backend
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
```

Make sure your external PostgreSQL and Redis are running and reachable at those URLs.

**3. Run migrations and create an admin user:**

```bash
cd apps/backend
npm exec medusa db:migrate
npm exec medusa user -e admin@test.com -p supersecret
cd ../..
npm run backend:seed        # optional: seed demo catalogue data
```

**4. Add a publishable key:**

Start the backend, open the admin at `http://localhost:9000/app`, and grab a key from
**Settings → Publishable API Keys**. Put it in the root `.env`:

```bash
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
```

**5. Run both apps** (from the repo root):

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
│   └── storefront/     # @dtc/storefront — Next.js storefront
├── deploy/nginx/       # One host nginx file per public domain (external)
├── scripts/deploy.sh   # Two-phase deploy: backend first, then storefront
├── .env                # Single env file for BOTH apps (gitignored)
├── .env.example        # Template for the above — the full list of variables
├── compose.yaml        # Runs just the two apps: backend + storefront
├── Dockerfile          # Multi-stage build for the Medusa backend
├── turbo.json          # Turborepo task graph
└── AGENTS.md           # Contributor guide: structure, commands, conventions
```

## Environment variables

All variables for **both apps** live in a single `.env` at the repo root — copy it from [`.env.example`](./.env.example), which documents every supported variable with defaults. The backend loads it via `loadEnv` in `apps/backend/medusa-config.ts`; the storefront loads it via `loadEnvConfig` in `apps/storefront/next.config.js`. Do not create `apps/backend/.env` or `apps/storefront/.env.local`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | External PostgreSQL connection string |
| `REDIS_URL` | External Redis connection string |
| `JWT_SECRET` / `COOKIE_SECRET` | Session/auth secrets |
| `STORE_CORS` | Allowed storefront origins (comma-separated) |
| `ADMIN_CORS` / `AUTH_CORS` | Allowed admin/auth origins |
| `S3_*` | Optional S3-compatible media storage (leave blank for local files) |
| `ESEWA_*` | eSewa ePay v2 checkout config (`EPAYTEST` = sandbox) |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable API key from the backend — **required** |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | URL of the Medusa backend |
| `NEXT_PUBLIC_BASE_URL` | Base URL of the storefront |
| `NEXT_PUBLIC_DEFAULT_REGION` | Default region country code (`np`) |
| `PORT_FE` / `PORT_BE` | Host ports published by `compose.yaml` |

Every `NEXT_PUBLIC_*` value is baked into the client bundle at **build** time, so changing one requires a storefront rebuild (`compose.yaml` also passes them as build args).

## Deployment

Both apps ship as Docker images built from this repo. Deploy the backend first — the storefront's build pre-renders pages by fetching from it.

### Topology

| Public domain | Host port | Serves |
|---|---|---|
| `shop.travories.com` | `7341` (`PORT_FE`) | storefront (`:8000`) |
| `api.shop.travories.com` | `7342` (`PORT_BE`) | backend API (`:9000`) |
| `admin.shop.travories.com` | `7342` (`PORT_BE`) | admin dashboard — same backend, `/` → `/app` |

Two apps, **two ports**, three domains. The admin dashboard is not a separate
process: Medusa serves it from the same server as the API, routed by path —
`/store`, `/admin` and `/auth` are the API, `/app` is the dashboard. `api.` and
`admin.` are two front doors onto the same port, which is why no third port
exists.

`medusa-config.ts` pins `admin.backendUrl` to `"/"`. That value is baked into
the dashboard bundle at build time, and leaving it at the default
(`MEDUSA_BACKEND_URL`, i.e. `api.shop.travories.com`) would make every admin API
call cross-origin when the dashboard is reached at `admin.shop.travories.com` —
CORS preflights plus cross-site cookies on login. With `"/"` the dashboard calls
whichever host served it, so both domains work with no CORS involved.
`MEDUSA_BACKEND_URL` is still used, separately, by `src/lib/store-media.ts` to
build absolute media URLs.

nginx runs **on the host**, not in `compose.yaml` — one file per domain in
[`deploy/nginx/`](./deploy/nginx), each just pointing the domain at its port:

```bash
sudo cp deploy/nginx/shop.travories.com \
        deploy/nginx/api.shop.travories.com \
        deploy/nginx/admin.shop.travories.com  /etc/nginx/sites-available/

for d in shop.travories.com api.shop.travories.com admin.shop.travories.com; do
  sudo ln -sf /etc/nginx/sites-available/$d /etc/nginx/sites-enabled/
done

sudo nginx -t && sudo systemctl reload nginx
```

They are plain `listen 80` proxies — add TLS however you normally do it.

### Deploying the apps

> **Do not run `docker compose up --build` on its own.** `depends_on` orders
> container *startup*, not image *builds* — compose builds both services in
> parallel. But `next build` pre-renders pages by calling the Store API over
> `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (`sitemap.ts` has no fallback), so the
> storefront image cannot be built until the backend is live. Use the script,
> which sequences the two phases:

```bash
cp .env.example .env
openssl rand -base64 32   # run for JWT_SECRET, COOKIE_SECRET, AUTH_MFA_ENCRYPTION_KEY
nano .env

./scripts/deploy.sh backend      # phase 1: build + start, wait for healthcheck
docker compose exec backend npx medusa user -e you@example.com -p yourpassword
# https://admin.shop.travories.com -> Settings -> Publishable API Keys -> pk_... into .env
./scripts/deploy.sh storefront   # phase 2: build against the live backend
```

Afterwards `./scripts/deploy.sh` (no argument) redeploys both in order. Because
every `NEXT_PUBLIC_*` value is baked in at build time, changing one in `.env`
requires re-running phase 2 — a restart is not enough.

Ordering constraints in short:

1. External PostgreSQL + Redis reachable → 2. nginx serving `api.shop.travories.com` → 3. backend (runs migrations on boot, must report healthy) → 4. publishable key exists → 5. storefront build.

### Storefront — Vercel (alternative)

The storefront can also be deployed to Vercel instead of via compose. Set the root directory to `apps/storefront` and add these environment variables in the Vercel project, then deploy:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL` = `https://api.yourdomain.com`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` = the `pk_...` from the step above

The storefront pre-renders category/collection/product pages at build time, so the backend must be live and reachable before the storefront build runs.

## Resources

- [Medusa Documentation](https://docs.medusajs.com)
- [Next.js Documentation](https://nextjs.org/docs)
