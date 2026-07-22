#!/usr/bin/env bash
# Post-deploy smoke tests (HTTP-level). Aligns with Backend Core routes.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

API_BASE_URL="${API_BASE_URL:?API_BASE_URL required}"
API="${API_BASE_URL%/}"
STRICT="${SMOKE_STRICT:-0}"
FAILED=0

pass() { log "PASS  $*"; }
skip() { log "SKIP  $*"; }
soft_fail() {
  log "FAIL  $*"
  FAILED=$((FAILED + 1))
}

req() {
  local method="$1"
  local path="$2"
  local expect="$3"
  local data="${4:-}"
  local url="${API}${path}"
  local code
  local args=(-sS -o /tmp/dripplex-smoke-body -w '%{http_code}' -X "${method}"
    -H 'Accept: application/json' -H 'Content-Type: application/json'
    --max-time 30)
  if [[ -n "${data}" ]]; then
    args+=(-d "${data}")
  fi
  code="$(curl "${args[@]}" "${url}" || echo '000')"
  if [[ "${code}" == "${expect}" ]]; then
    pass "${method} ${path} → ${code}"
  elif [[ "${expect}" == "4xx" && "${code}" =~ ^4 ]]; then
    pass "${method} ${path} → ${code} (client error as expected)"
  else
    soft_fail "${method} ${path} → ${code} (expected ${expect})"
  fi
}

log "Smoke suite (env=${DRIPPLEX_ENV:-unknown})"

# Health — DB + Redis connectivity
req GET /health 200

# Authentication
req GET /auth/sessions 401
req POST /auth/login/customer 4xx '{}'
req POST /auth/login/merchant 4xx '{}'
req POST /auth/login/rider 4xx '{}'

# Customer (auth required)
req GET /customer/notifications 401
req GET /customer/wallet 401
req GET /customer/orders 401
req GET /customer/cart 401
req GET /search/popular 401

# OTP / password / session (unauthenticated shape checks)
req POST /auth/otp/request 4xx '{}'
req POST /auth/otp/verify 4xx '{}'
req POST /auth/password/forgot 4xx '{}'
req POST /auth/refresh 4xx '{}'
req POST /auth/logout 401 '{}'

# Merchant
req GET /merchant/business 401
req GET /merchant/wallet 401
req GET /merchant/analytics/overview 401
req GET /merchant/kyc 401

# Rider
req GET /rider/jobs 401
req GET /rider/wallet 401

# Payments / webhooks (auth or signature required)
req POST /customer/orders/00000000-0000-0000-0000-000000000000/pay 401 '{}'
req POST /webhooks/paystack 4xx '{}'

# Admin — CMS, analytics, wallet, fraud
req GET /admin/cms/contents 401
req GET /admin/analytics/overview 401
req GET /admin/wallets/reconciliation 401
req GET /admin/fraud/queue 401

# Public CMS probe
req GET /cms/banners 200

# Portal shells
for pair in \
  "customer:${CUSTOMER_URL:-}" \
  "merchant:${MERCHANT_URL:-}" \
  "rider:${RIDER_URL:-}" \
  "admin:${ADMIN_URL:-}"; do
  name="${pair%%:*}"
  url="${pair#*:}"
  if [[ -z "${url}" ]]; then
    skip "${name} portal URL not set"
    continue
  fi
  if http_ok "${url}"; then
    pass "${name} portal reachable"
  else
    soft_fail "${name} portal unreachable (${url})"
  fi
done

if [[ "${FAILED}" -gt 0 ]]; then
  notify "failure" "Smoke failed (${FAILED}) for ${DRIPPLEX_ENV:-env}"
  if [[ "${STRICT}" == "1" ]]; then
    fail "${FAILED} smoke assertion(s) failed"
  fi
  log "WARN: ${FAILED} soft failures (STRICT=0)"
  exit 1
fi

log "Smoke suite passed"
notify "success" "Smoke tests passed for ${DRIPPLEX_ENV:-env}"
