# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder — install the workspace deps and produce the Medusa server bundle.
# `medusa build` emits a self-contained app (incl. the admin dashboard) into
# apps/backend/.medusa/server, which we then install production deps for.
# ---------------------------------------------------------------------------
FROM node:20-slim AS builder

# Toolchain for native deps (sharp, etc.) that get compiled during install.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g npm@11.4.2

WORKDIR /app

# Copy manifests first so `npm ci` stays cached until dependencies change.
# All workspace manifests are required or npm ci rejects the lockfile.
COPY package.json package-lock.json turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY apps/vendor-dashboard/package.json apps/vendor-dashboard/package.json

RUN npm ci

# Build the backend -> apps/backend/.medusa/server
COPY . .
RUN npm run build --workspace @dtc/backend

# Install only production deps inside the built server bundle.
WORKDIR /app/apps/backend/.medusa/server
RUN npm install --omit=dev

# ---------------------------------------------------------------------------
# Runner — ship just the built server + its production node_modules.
# Redis, Postgres and all secrets come from the environment at runtime.
# ---------------------------------------------------------------------------
FROM node:20-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

# Copy the standalone server bundle produced by the builder.
COPY --from=builder --chown=node:node /app/apps/backend/.medusa/server ./

USER node

EXPOSE 9000

# Run pending migrations against the external DB, then boot Medusa.
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
