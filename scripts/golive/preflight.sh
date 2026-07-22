#!/usr/bin/env bash
# D5 pre-launch verification — domains, TLS, secrets presence (no secret values logged).
# Exit 0 when all critical checks pass; non-zero when blockers remain.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../cicd/lib.sh
source "${ROOT}/scripts/cicd/lib.sh"

STRICT="${PREFLIGHT_STRICT:-0}"
FAILED=0
WARNED=0

pass() { log "PASS  $*"; }
warn() { log "WARN  $*"; WARNED=$((WARNED + 1)); }
fail_item() {
  log "FAIL  $*"
  FAILED=$((FAILED + 1))
}

check_http() {
  local name="$1"
  local url="$2"
  local critical="${3:-1}"
  local code
  code="$(curl -sS -o /tmp/dripplex-preflight-body -w '%{http_code}' --connect-timeout 8 --max-time 20 "${url}" 2>/dev/null || true)"
  [[ -z "${code}" ]] && code='000'
  if [[ "${code}" =~ ^2 ]]; then
    pass "${name} → ${code} (${url})"
  elif [[ "${critical}" == "1" ]]; then
    fail_item "${name} → ${code} (${url})"
  else
    warn "${name} → ${code} (${url})"
  fi
}

check_tls() {
  local host="$1"
  if echo | openssl s_client -servername "${host}" -connect "${host}:443" 2>/dev/null | openssl x509 -noout -dates >/tmp/dripplex-tls.txt 2>/dev/null; then
    pass "TLS ${host} ($(tr '\n' ' ' </tmp/dripplex-tls.txt))"
  else
    fail_item "TLS ${host} unreachable or invalid"
  fi
}

secret_set() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    pass "secret ${name} is set"
  else
    fail_item "secret ${name} missing (export or GitHub Environment)"
  fi
}

var_set() {
  local name="$1"
  local critical="${2:-1}"
  if [[ -n "${!name:-}" ]]; then
    pass "var ${name} is set"
  elif [[ "${critical}" == "1" ]]; then
    fail_item "var ${name} missing"
  else
    warn "var ${name} missing (optional)"
  fi
}

log "=== D5 Pre-launch verification ==="
log "version=$(node -p "require('${ROOT}/package.json').version" 2>/dev/null || echo unknown)"

# Domains (production defaults)
API_URL="${PROD_API_BASE_URL:-https://api.dripplex.com/api/v1}"
CUSTOMER_URL="${PROD_CUSTOMER_URL:-https://www.dripplex.com}"
MERCHANT_URL="${PROD_MERCHANT_URL:-https://merchant.dripplex.com}"
RIDER_URL="${PROD_RIDER_URL:-https://rider.dripplex.com}"
ADMIN_URL="${PROD_ADMIN_URL:-https://admin.dripplex.com}"
STATUS_URL="${PROD_STATUS_URL:-https://status.dripplex.com}"
APP_URL="${PROD_APP_URL:-https://app.dripplex.com}"

log "--- Production domains / SSL ---"
check_http "marketing-www" "${CUSTOMER_URL}" 0
check_http "api-health" "${API_URL%/}/health" 1
check_http "customer-app" "${APP_URL}" 0
check_http "merchant" "${MERCHANT_URL}" 1
check_http "rider" "${RIDER_URL}" 1
check_http "admin" "${ADMIN_URL}" 1
check_http "status-page" "${STATUS_URL}" 0

for host in api.dripplex.com www.dripplex.com merchant.dripplex.com rider.dripplex.com admin.dripplex.com; do
  check_tls "${host}" || true
done

log "--- GitHub / deploy secrets (presence only) ---"
# In local agent these are typically unset — report honestly
for s in PROD_DEPLOY_HOST PROD_DEPLOY_USER PROD_SSH_KEY DATABASE_URL REDIS_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  secret_set "${s}" || true
done
for s in SLACK_WEBHOOK_URL SENTRY_DSN PAYSTACK_SECRET_KEY SMTP_URL SMS_API_KEY R2_ACCESS_KEY_ID; do
  if [[ -n "${!s:-}" ]]; then
    pass "secret ${s} is set"
  else
    warn "secret ${s} missing"
  fi
done

log "--- Provider readiness (config files / env) ---"
if [[ -f "${ROOT}/apps/customer-mobile/android/app/google-services.json" ]]; then
  pass "Firebase google-services.json present"
else
  warn "Firebase google-services.json absent (mobile push deferred)"
fi
if [[ -f "${ROOT}/apps/customer-mobile/ios/App/App/GoogleService-Info.plist" ]]; then
  pass "Firebase GoogleService-Info.plist present"
else
  warn "APNS/Firebase iOS plist absent (mobile push deferred)"
fi

log "--- In-repo launch artifacts ---"
for f in \
  docs/ops/GO-LIVE.md \
  docs/ops/PRE-LAUNCH-CHECKLIST.md \
  docs/ops/PRODUCTION-VALIDATION.md \
  docs/RELEASE-v1.0.0.md \
  docs/releases/v1.0.0.json \
  scripts/cicd/pipeline.sh \
  scripts/cicd/smoke-test.sh \
  .github/workflows/deploy-production.yml; do
  if [[ -f "${ROOT}/${f}" ]]; then
    pass "artifact ${f}"
  else
    fail_item "missing artifact ${f}"
  fi
done

log "=== Summary: failed=${FAILED} warned=${WARNED} ==="
if [[ "${FAILED}" -gt 0 ]]; then
  if [[ "${STRICT}" == "1" ]]; then
    fail "Preflight blocked (${FAILED} critical failures)"
  fi
  log "RESULT: NOT READY FOR LIVE CUTOVER"
  exit 2
fi
log "RESULT: PREFLIGHT PASSED"
exit 0
