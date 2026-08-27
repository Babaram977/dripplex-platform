# syntax=docker/dockerfile:1.7
# DrippleX Super App — Vite SPA.
# VITE_* values are read by Vite at BUILD time, so they are baked here via ARG/ENV.
#
# THE WHOLE packages/ TREE IS COPIED, ON PURPOSE. Do not narrow it back to a
# hand-listed subset.
#
# It used to copy @dripplex/config and @dripplex/types and nothing else, with a
# comment above saying "it has two workspace dependencies". That was true when
# it was written. On 2026-08-26 push.ts added a third — @dripplex/hooks — and
# nobody thought to edit this file, because nothing makes you.
#
# The result: every super-app deploy failed for twelve hours with "Rolldown
# failed to resolve import @dripplex/hooks/notifications/native-push", while
# app.dripplex.com quietly went on serving the last image that built. CI was
# green throughout — `pnpm build` at the repo root has the whole workspace on
# disk, so it cannot see what this file leaves out. Twenty-four commits sat
# merged and undeployed, including the one that registers a device for push,
# which is why a driver's phone never rang and why there was no clue anywhere
# that it had not been asked to.
#
# Copying the tree costs a slightly larger build context. A selective list
# costs a silent production outage the next time somebody adds an import, and
# there is no version of that list which stays correct on its own.
#
# @dripplex/types still has to be BUILT below rather than merely copied: it
# resolves to ./dist, the same as apps/customer-web/Dockerfile does it.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages packages
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
# @dripplex/types resolves to ./dist — build it before the app that imports it.
RUN pnpm --filter @dripplex/types build
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
