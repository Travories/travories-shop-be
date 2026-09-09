# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY apps/vendor-dashboard/package.json apps/vendor-dashboard/package.json

RUN npm ci

COPY . .

ARG MEDUSA_BACKEND_URL=http://backend:9000
ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build --workspace @dtc/vendor-dashboard

FROM node:20-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8100 \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder --chown=node:node /app/apps/vendor-dashboard/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/vendor-dashboard/.next/static ./apps/vendor-dashboard/.next/static

USER node

EXPOSE 8100

CMD ["node", "apps/vendor-dashboard/server.js"]
