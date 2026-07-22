#!/usr/bin/env bash
# Warm application caches after production deploy (best-effort).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../cicd/lib.sh
source "${ROOT}/scripts/cicd/lib.sh"

API="${API_BASE_URL:-https://api.dripplex.com/api/v1}"
API="${API%/}"

warm() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${url}" || echo '000'
}

log "Warming production caches…"
for path in /health /search/popular; do
  code="$(warm "${API}${path}")"
  log "  ${path} → ${code}"
done

for url in \
  "${CUSTOMER_URL:-https://www.dripplex.com}" \
  "${MERCHANT_URL:-https://merchant.dripplex.com}" \
  "${RIDER_URL:-https://rider.dripplex.com}" \
  "${ADMIN_URL:-https://admin.dripplex.com}"; do
  code="$(warm "${url}")"
  log "  portal ${url} → ${code}"
done

log "Cache warm complete (best-effort)"
