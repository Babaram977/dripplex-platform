# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --filter @dripplex/backend... --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages/config packages/config
COPY packages/types packages/types
COPY apps/backend apps/backend
RUN pnpm --filter @dripplex/types build
WORKDIR /app/apps/backend
RUN pnpm prisma generate
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 1001 dripplex \
  && useradd --system --uid 1001 --gid dripplex dripplex
COPY --from=build --chown=dripplex:dripplex /app/apps/backend/dist ./dist
COPY --from=build --chown=dripplex:dripplex /app/apps/backend/package.json ./package.json
COPY --from=build --chown=dripplex:dripplex /app/apps/backend/prisma ./prisma
COPY --from=build --chown=dripplex:dripplex /app/apps/backend/node_modules ./node_modules
COPY --from=build --chown=dripplex:dripplex /app/node_modules /app/node_modules
USER dripplex
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
