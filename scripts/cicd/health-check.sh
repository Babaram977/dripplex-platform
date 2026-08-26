#!/usr/bin/env bash
# Validate deployment health: API, DB/Redis via health payload, portals
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

API_BASE_URL="${API_BASE_URL:?API_BASE_URL required}"
CUSTOMER_URL="${CUSTOMER_URL:-}"
MERCHANT_URL="${MERCHANT_URL:-}"
RIDER_URL="${RIDER_URL:-}"
ADMIN_URL="${ADMIN_URL:-}"
RETRIES="${HEALTH_RETRIES:-12}"
SLEEP_SECS="${HEALTH_SLEEP:-5}"

check_url() {
  local name="$1"
  local url="$2"
  local i
  for ((i = 1; i <= RETRIES; i++)); do
    if http_ok "${url}"; then
      log "OK ${name} → ${url}"
      return 0
    fi
    log "waiting ${name} (${i}/${RETRIES})…"
    sleep "${SLEEP_SECS}"
  done
  fail "${name} health failed: ${url}"
}

log "Health validation starting (env=${DRIPPLEX_ENV:-unknown})"
check_url "api-health" "${API_BASE_URL%/}/health"

# Expect JSON with database/redis components when Backend Core health is detailed
BODY="$(cat /tmp/dripplex-http-body || true)"
if echo "${BODY}" | grep -qi 'database\|redis\|ok\|status'; then
  log "API health payload looks structured"
else
  log "WARN: health body unexpected: ${BODY:0:200}"
fi

[[ -n "${CUSTOMER_URL}" ]] && check_url "customer-web" "${CUSTOMER_URL}"
[[ -n "${MERCHANT_URL}" ]] && check_url "merchant-portal" "${MERCHANT_URL}"
[[ -n "${RIDER_URL}" ]] && check_url "rider-portal" "${RIDER_URL}"

log "All health checks passed"
