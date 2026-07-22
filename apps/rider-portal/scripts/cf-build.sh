#!/usr/bin/env bash
# Monorepo-aware OpenNext build for Cloudflare Workers Builds.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${APP_DIR}/../.." && pwd)"

export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://api.dripplex.com/api/v1}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://rider.dripplex.com}"
export NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN:-}"

echo "cf-build (rider-portal): NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}"
echo "cf-build (rider-portal): NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}"
echo "cf-build (rider-portal): NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN:+set}"

cd "${ROOT_DIR}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Installing pnpm via corepack…"
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi

if [[ ! -d node_modules ]]; then
  echo "Installing workspace dependencies from monorepo root…"
  pnpm install --frozen-lockfile
fi

pnpm --filter @dripplex/types build
pnpm --filter @dripplex/utils build
pnpm --filter @dripplex/sdk build
pnpm --filter @dripplex/ui build || true
pnpm --filter @dripplex/hooks build || true

cd "${APP_DIR}"
exec pnpm exec opennextjs-cloudflare build
