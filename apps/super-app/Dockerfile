# syntax=docker/dockerfile:1.7
# DrippleX Super App — Vite SPA.
# VITE_* values are read by Vite at BUILD time, so they are baked here via ARG/ENV.
#
# It has exactly one workspace dependency: @dripplex/config, for the tsconfig the
# app extends. Vite resolves that tsconfig during the build, so the package has
# to be in the image — leaving it out fails the build with "Tsconfig not found
# @dripplex/config/typescript/react-library", which is what happened when the
# app gained a tsconfig and this file still said it had no workspace deps.
# `pnpm build` at the repo root cannot catch that: the workspace is present
# there and absent here, so the Docker build is its own gate.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config packages/config
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
# Cache policy. Without it `serve` sends index.html with an ETag and no
# Cache-Control at all, so a browser may hold it heuristically and stay pinned
# to the hashed bundle that copy references — the device keeps running an old
# build after a deploy has landed. The config must be COPYed and named on the
# command line; serve does not pick it up from the repo on its own.
COPY apps/super-app/serve.json ./serve.json
ENV PORT=3000
EXPOSE 3000
# SPA fallback (-s) so client-side routing resolves; listen on Railway's $PORT.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000} --config /app/serve.json"]
