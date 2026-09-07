#!/usr/bin/env bash
#
# reseed.sh - rebuild the local Medusa database from scratch.
#
# Wraps the manual sequence in INFO.md section 11 so the two steps people
# forget - recreating the admin user and copying the NEW publishable key - can
# never be skipped:
#
#   drop -> create -> db:migrate -> seed -> admin user -> print publishable key
#
# db:migrate also runs the custom souvenir module migrations (the *_key media
# columns), so a reseed leaves the schema fully current.
#
# This is DESTRUCTIVE: it drops the database. It asks for confirmation unless
# run with --yes, and it refuses to touch anything other than the local
# DATABASE_URL in apps/backend/.env.
#
# Usage:
#   cd apps/backend && npm run reseed
#   ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=secret npm run reseed -- --yes
#
set -euo pipefail

# Always operate from the backend app root, regardless of where it was invoked.
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

ENV_FILE="$BACKEND_DIR/.env"
ASSUME_YES=false
[[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]] && ASSUME_YES=true

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found. Copy .env.template to .env first." >&2
  exit 1
fi

# --- Parse DATABASE_URL from .env (never hardcode connection details) --------
DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
DB_URL="${DB_URL%\"}"; DB_URL="${DB_URL#\"}"   # strip optional surrounding quotes
DB_URL="${DB_URL%\'}"; DB_URL="${DB_URL#\'}"

if [[ -z "$DB_URL" ]]; then
  echo "error: DATABASE_URL is empty in $ENV_FILE." >&2
  exit 1
fi

after_proto="${DB_URL#*://}"
creds_host="${after_proto%%/*}"          # user:pass@host:port
path_part="${after_proto#*/}"            # dbname?query
DB_NAME="${path_part%%\?*}"
hostport="${creds_host##*@}"             # host:port  (drops user:pass@ if present)
export PGHOST="${hostport%%:*}"
export PGPORT="${hostport##*:}"
[[ "$PGPORT" == "$hostport" ]] && export PGPORT=5432   # no explicit port

if [[ "$creds_host" == *"@"* ]]; then
  userpass="${creds_host%@*}"
  export PGUSER="${userpass%%:*}"
  [[ "$userpass" == *":"* ]] && export PGPASSWORD="${userpass#*:}"
fi

# Only ever touch a local database. Refuse remote hosts to avoid nuking prod.
if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" ]]; then
  echo "error: refusing to reseed a non-local database (host: $PGHOST)." >&2
  echo "       reseed is for local development only." >&2
  exit 1
fi

# --- Admin credentials (from env, else prompt; never hardcoded) --------------
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
if [[ -z "$ADMIN_EMAIL" ]]; then
  read -r -p "Admin email: " ADMIN_EMAIL
fi
if [[ -z "$ADMIN_PASSWORD" ]]; then
  read -r -s -p "Admin password: " ADMIN_PASSWORD; echo
fi
if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "error: admin email and password are required." >&2
  exit 1
fi

# --- Confirm before the destructive part -------------------------------------
echo "About to DROP and rebuild database '$DB_NAME' on $PGHOST:$PGPORT."
echo "Stop the dev servers first - open connections will block the drop."
if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type the database name to continue: " CONFIRM
  if [[ "$CONFIRM" != "$DB_NAME" ]]; then
    echo "aborted." >&2
    exit 1
  fi
fi

# --- 0. Type-check first: catches errors before anything is dropped ----------
echo "==> Type-checking (tsc --noEmit)"
npx tsc --noEmit

# --- 1. Rebuild the database -------------------------------------------------
echo "==> Dropping and recreating '$DB_NAME'"
dropdb --if-exists "$DB_NAME"
createdb "$DB_NAME"

# --- 2. Migrations (core + custom souvenir module) ---------------------------
echo "==> Running migrations"
npx medusa db:migrate

# --- 3. Seed initial data (also creates the publishable API key) -------------
echo "==> Seeding initial data"
npx medusa exec ./src/migration-scripts/initial-data-seed.ts

# --- 4. Recreate the admin user (it died with the old database) --------------
echo "==> Creating admin user $ADMIN_EMAIL"
npx medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD"

# --- 5. Print the NEW publishable key for apps/storefront/.env.local ---------
echo "==> New publishable key (paste into apps/storefront/.env.local):"
NEW_KEY="$(psql -d "$DB_NAME" -tAc "select token from api_key where type='publishable' order by created_at desc limit 1;")"
echo
echo "  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEW_KEY"
echo
echo "Done. Restart with: npm run dev (from the repo root)."
