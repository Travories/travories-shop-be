# syntax=docker/dockerfile:1
#
# Self-hosted Docker image for the Next.js storefront (@dtc/storefront).
# For Vercel you do NOT need this file — just import the repo, set the root
# directory to apps/storefront, and add the env vars in the project settings.
#
# Build context MUST be the repo root (the monorepo lockfile lives there):
#   docker build -f apps/storefront/Dockerfile \
#     --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_... \
#     --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com \
#     -t medusashop-storefront .
#
# NOTE: every NEXT_PUBLIC_* value is baked in at build time, so it must be
# passed as a --build-arg (not just at runtime).

# ---------------------------------------------------------------------------
# Builder — install workspace deps and produce the standalone Next.js bundle.
# ---------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Copy manifests first so `npm ci` stays cached until dependencies change.
# All workspace manifests are required or npm ci rejects the lockfile.
COPY package.json package-lock.json turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY apps/vendor-dashboard/package.json apps/vendor-dashboard/package.json

RUN npm ci

COPY . .

# Build-time public envs (baked into the client bundle).
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_DEFAULT_REGION=np
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_MEDIA_HOSTNAME
ARG NEXT_PUBLIC_STRIPE_KEY
# Optional SEO/social values. NEXT_PUBLIC_* is inlined at build time even in
# server components, so anything not passed here is permanently empty in the
# image — runtime env_file cannot fill it back in.
ARG NEXT_PUBLIC_TWITTER_HANDLE
ARG NEXT_PUBLIC_FACEBOOK_URL
ARG NEXT_PUBLIC_INSTAGRAM_URL
ARG NEXT_PUBLIC_TWITTER_URL
ARG NEXT_PUBLIC_YOUTUBE_URL
ARG NEXT_PUBLIC_FACEBOOK_APP_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_PINTEREST_SITE_VERIFICATION
ENV NEXT_OUTPUT_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_MEDIA_HOSTNAME=$NEXT_PUBLIC_MEDIA_HOSTNAME \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY \
    NEXT_PUBLIC_TWITTER_HANDLE=$NEXT_PUBLIC_TWITTER_HANDLE \
    NEXT_PUBLIC_FACEBOOK_URL=$NEXT_PUBLIC_FACEBOOK_URL \
    NEXT_PUBLIC_INSTAGRAM_URL=$NEXT_PUBLIC_INSTAGRAM_URL \
    NEXT_PUBLIC_TWITTER_URL=$NEXT_PUBLIC_TWITTER_URL \
    NEXT_PUBLIC_YOUTUBE_URL=$NEXT_PUBLIC_YOUTUBE_URL \
    NEXT_PUBLIC_FACEBOOK_APP_ID=$NEXT_PUBLIC_FACEBOOK_APP_ID \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_PINTEREST_SITE_VERIFICATION=$NEXT_PUBLIC_PINTEREST_SITE_VERIFICATION

RUN npm run build --workspace @dtc/storefront

# ---------------------------------------------------------------------------
# Runner — minimal image with just the standalone server + static assets.
# ---------------------------------------------------------------------------
FROM node:20-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# Standalone bundle mirrors the monorepo layout from the tracing root, so the
# server entrypoint lives at apps/storefront/server.js.
COPY --from=builder --chown=node:node /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=node:node /app/apps/storefront/public ./apps/storefront/public

USER node

EXPOSE 8000

CMD ["node", "apps/storefront/server.js"]
