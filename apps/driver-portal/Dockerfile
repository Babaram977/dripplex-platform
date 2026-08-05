# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/sdk/package.json packages/sdk/
COPY packages/ui/package.json packages/ui/
COPY packages/hooks/package.json packages/hooks/
COPY apps/driver-portal/package.json apps/driver-portal/
RUN pnpm install --filter @dripplex/driver-portal... --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY packages packages
COPY apps/driver-portal apps/driver-portal
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=1
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
ARG NEXT_PUBLIC_APP_URL=http://localhost:3005
ARG NEXT_PUBLIC_CUSTOMER_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CUSTOMER_APP_URL=$NEXT_PUBLIC_CUSTOMER_APP_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
RUN pnpm --filter @dripplex/types build && pnpm --filter @dripplex/utils build && pnpm --filter @dripplex/sdk build
RUN pnpm --filter @dripplex/driver-portal build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN groupadd --system --gid 1001 dripplex \
  && useradd --system --uid 1001 --gid dripplex dripplex
COPY --from=build --chown=dripplex:dripplex /app/apps/driver-portal/.next/standalone ./
COPY --from=build --chown=dripplex:dripplex /app/apps/driver-portal/.next/static ./apps/driver-portal/.next/static
COPY --from=build --chown=dripplex:dripplex /app/apps/driver-portal/public ./apps/driver-portal/public
USER dripplex
EXPOSE 3005
ENV PORT=3005
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/driver-portal/server.js"]
