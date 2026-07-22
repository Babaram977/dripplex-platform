#!/usr/bin/env bash
# Monorepo-aware OpenNext build for Cloudflare Workers Builds.
# Run from apps/customer-web OR invoke via: pnpm --filter @dripplex/customer-web cf:build
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${APP_DIR}/../.." && pwd)"

cd "${ROOT_DIR}"

if [[ ! -d node_modules ]]; then
  echo "Installing workspace dependencies from monorepo root…"
  pnpm install --frozen-lockfile
fi

# Ensure workspace packages consumed by customer-web are built
pnpm --filter @dripplex/types build
pnpm --filter @dripplex/utils build
pnpm --filter @dripplex/sdk build

cd "${APP_DIR}"
exec pnpm exec opennextjs-cloudflare build
