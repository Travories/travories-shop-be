#!/usr/bin/env bash
#
# Two-phase deploy. `docker compose up --build` on its own does NOT work here:
#
#   - `depends_on` orders CONTAINER STARTUP, not image builds. Compose builds
#     every service up front, in parallel.
#   - The storefront image is built by `next build`, which pre-renders pages
#     (generateStaticParams, sitemap.ts) by calling the Store API over
#     NEXT_PUBLIC_MEDUSA_BACKEND_URL. sitemap.ts has no fallback, so a backend
#     that is not answering fails the build outright.
#
# So: bring the backend up and wait for it to be healthy, then build the
# storefront against the running backend.
#
# Requires nginx on the host to already be proxying api.<domain> to PORT_BE,
# because the build resolves the PUBLIC url, not the container name.
#
#   ./scripts/deploy.sh              # both apps
#   ./scripts/deploy.sh backend      # backend only
#   ./scripts/deploy.sh storefront   # storefront only (backend must be healthy)

set -euo pipefail

cd "$(dirname "$0")/.."

target="${1:-all}"

if [ ! -f .env ]; then
  echo "error: .env is missing — run 'cp .env.example .env' and fill it in." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

wait_for_backend() {
  echo "==> waiting for the backend to report healthy"
  for _ in $(seq 1 60); do
    status="$(docker inspect -f '{{.State.Health.Status}}' medusashop-backend 2>/dev/null || echo missing)"
    case "$status" in
      healthy) echo "==> backend is healthy"; return 0 ;;
      unhealthy) echo "error: backend is unhealthy" >&2; docker compose logs --tail 50 backend; exit 1 ;;
    esac
    sleep 5
  done
  echo "error: timed out waiting for the backend to become healthy" >&2
  docker compose logs --tail 50 backend
  exit 1
}

if [ "$target" = "all" ] || [ "$target" = "backend" ]; then
  echo "==> phase 1: build + start the backend (migrations run on boot)"
  docker compose up -d --build backend
  wait_for_backend
fi

if [ "$target" = "all" ] || [ "$target" = "storefront" ]; then
  if [ "$target" = "storefront" ]; then
    wait_for_backend
  fi

  # The build bakes NEXT_PUBLIC_* in, so fail early with a clear message
  # instead of shipping a storefront that 401s on every Store API call.
  if [ -z "${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-}" ]; then
    echo "error: NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is empty in .env." >&2
    echo "       Create one in the admin (Settings -> Publishable API Keys) first:" >&2
    echo "       docker compose exec backend npx medusa user -e you@example.com -p yourpassword" >&2
    exit 1
  fi

  backend_url="${NEXT_PUBLIC_MEDUSA_BACKEND_URL:-}"
  echo "==> checking the storefront build can reach ${backend_url}"
  if ! curl -fsS -m 10 -o /dev/null "${backend_url}/health"; then
    echo "error: ${backend_url}/health is not reachable." >&2
    echo "       The storefront build renders pages against this URL, so nginx" >&2
    echo "       must already be proxying it to 127.0.0.1:${PORT_BE:-7342}." >&2
    exit 1
  fi

  echo "==> phase 2: build + start the storefront"
  docker compose up -d --build storefront
fi

docker compose ps
