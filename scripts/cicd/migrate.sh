#!/usr/bin/env bash
# Run Prisma migrate deploy with verification
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_env DATABASE_URL
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "DRY_RUN: would run prisma migrate deploy"
  exit 0
fi

cd "${ROOT}/apps/backend"
log "prisma migrate deploy…"
pnpm exec prisma migrate deploy

log "prisma migrate status…"
pnpm exec prisma migrate status

log "Migration verification OK"
