#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Dripplex workspace setup"
echo "    Root: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required (>= 22)." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 22 )); then
  echo "ERROR: Node.js >= 22 required. Found $(node -v)." >&2
  exit 1
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is required. Install via Corepack or https://pnpm.io/installation" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Created .env from .env.example"
fi

pnpm install

echo "==> Validating environment template"
pnpm validate:env

echo "==> Verifying workspace packages"
pnpm list -r --depth -1

echo "==> Setup complete"
echo "    Local API: pnpm --filter @dripplex/backend dev"
echo "    Customer web: pnpm --filter @dripplex/customer-web dev"
echo "    Full stack: docker compose up --build"
