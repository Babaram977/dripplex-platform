#!/usr/bin/env bash
# D5 go-live orchestrator — preflight → (optional) deploy pipeline → validation.
#
# Modes:
#   DRY_RUN=1 (default when no PROD_DEPLOY_HOST) — document-only pipeline dry-run
#   EXECUTE=1 + secrets — real production cutover via scripts/cicd/pipeline.sh
#
# Never invents credentials. Exits non-zero if live cutover is requested but blocked.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../cicd/lib.sh
source "${ROOT}/scripts/cicd/lib.sh"

VERSION="$(node -p "require('${ROOT}/package.json').version")"
EXECUTE="${EXECUTE:-0}"
IMAGE_TAG="${IMAGE_TAG:-v${VERSION}}"
export DRIPPLEX_ENV=production
export IMAGE_TAG
export REGISTRY="${REGISTRY:-ghcr.io/babaram977}"
export API_BASE_URL="${API_BASE_URL:-https://api.dripplex.com/api/v1}"
export CUSTOMER_URL="${CUSTOMER_URL:-https://www.dripplex.com}"
export MERCHANT_URL="${MERCHANT_URL:-https://merchant.dripplex.com}"
export RIDER_URL="${RIDER_URL:-https://rider.dripplex.com}"
export SMOKE_STRICT="${SMOKE_STRICT:-1}"

log "=== Dripplex Go-Live v${VERSION} (tag=${IMAGE_TAG}) ==="

chmod +x "${ROOT}/scripts/golive/"*.sh "${ROOT}/scripts/cicd/"*.sh

# 1) Preflight (non-strict — report blockers)
set +e
PREFLIGHT_STRICT=0 "${ROOT}/scripts/golive/preflight.sh"
PRE_EC=$?
set -e

if [[ "${EXECUTE}" != "1" ]]; then
  log "EXECUTE=0 — running deploy pipeline in dry-run only"
  export DEPLOY_MODE=dry-run DRY_RUN=1 SKIP_ROLLBACK=1
  # Health/smoke will fail against missing API — skip full pipeline in dry doc mode
  set +e
  DEPLOY_MODE=dry-run DRY_RUN=1 SKIP_BACKUP=1 "${ROOT}/scripts/cicd/deploy.sh"
  set -e
  log "Dry-run deploy sequence emitted. Live cutover requires:"
  log "  export EXECUTE=1 PROD_DEPLOY_HOST=... PROD_DEPLOY_USER=... PROD_SSH_KEY=..."
  log "  export DATABASE_URL=... REDIS_URL=... JWT_* ..."
  log "  bash scripts/golive/go-live.sh"
  if [[ "${PRE_EC}" -ne 0 ]]; then
    log "RESULT: GO-LIVE PACKAGE READY — LIVE CUTOVER BLOCKED (preflight failures)"
    exit 0
  fi
  log "RESULT: GO-LIVE PACKAGE READY — awaiting EXECUTE=1"
  exit 0
fi

# Live path
if [[ -z "${PROD_DEPLOY_HOST:-}${DEPLOY_HOST:-}" ]]; then
  fail "EXECUTE=1 requires PROD_DEPLOY_HOST (or DEPLOY_HOST)"
fi

export DEPLOY_HOST="${DEPLOY_HOST:-${PROD_DEPLOY_HOST}}"
export DEPLOY_USER="${DEPLOY_USER:-${PROD_DEPLOY_USER:?PROD_DEPLOY_USER required}}"
export DEPLOY_MODE="${DEPLOY_MODE:-ssh}"

if [[ "${PRE_EC}" -ne 0 ]]; then
  fail "Refusing live cutover — preflight still failing (run scripts/golive/preflight.sh)"
fi

log "Executing production pipeline…"
"${ROOT}/scripts/cicd/pipeline.sh"
"${ROOT}/scripts/golive/validate-production.sh"

log "=== GO-LIVE COMPLETE v${VERSION} ==="
notify "success" "Production go-live complete tag=${IMAGE_TAG}"
