#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Checking DrippleX workspace health"

pnpm format:check
pnpm --filter @dripplex/config lint
pnpm --filter @dripplex/config typecheck

echo "==> Workspace health OK"
