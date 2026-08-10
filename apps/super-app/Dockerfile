# syntax=docker/dockerfile:1.7
# DrippleX Super App — Vite SPA (self-contained, no workspace deps).
# VITE_* values are read by Vite at BUILD time, so they are baked here via ARG/ENV.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/super-app/package.json apps/super-app/
RUN pnpm install --filter @dripplex/super-app... --no-frozen-lockfile
COPY apps/super-app apps/super-app
# Baked at build time (Railway passes matching service variables as build args).
ARG VITE_API_BASE=https://api.dripplex.com/api/v1
ARG VITE_SOCKET_URL=https://api.dripplex.com
ARG VITE_GOOGLE_MAPS_KEY=""
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY
RUN pnpm --filter @dripplex/super-app build

FROM base AS runner
WORKDIR /app
RUN pnpm add -g serve@14
COPY --from=build /app/apps/super-app/dist ./dist
ENV PORT=3000
EXPOSE 3000
# SPA fallback (-s) so client-side routing resolves; listen on Railway's $PORT.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
