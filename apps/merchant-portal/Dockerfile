# syntax=docker/dockerfile:1.7
# DPX-LAUNCH-001.5 rollback drill marker (2026-08-05) -- harmless comment,
# deployed then reverted to prove the git-revert-and-redeploy path works.
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
COPY apps/merchant-portal/package.json apps/merchant-portal/
RUN pnpm install --filter @dripplex/merchant-portal... --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY packages packages
COPY apps/merchant-portal apps/merchant-portal
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
ARG NEXT_PUBLIC_APP_URL=http://localhost:3002
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DOCKER_BUILD=1
RUN pnpm --filter @dripplex/types build && pnpm --filter @dripplex/utils build && pnpm --filter @dripplex/sdk build
RUN pnpm --filter @dripplex/merchant-portal build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN groupadd --system --gid 1001 dripplex \
  && useradd --system --uid 1001 --gid dripplex dripplex
COPY --from=build --chown=dripplex:dripplex /app/apps/merchant-portal/.next/standalone ./
COPY --from=build --chown=dripplex:dripplex /app/apps/merchant-portal/.next/static ./apps/merchant-portal/.next/static
COPY --from=build --chown=dripplex:dripplex /app/apps/merchant-portal/public ./apps/merchant-portal/public
USER dripplex
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/merchant-portal/server.js"]
