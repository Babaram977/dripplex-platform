#!/usr/bin/env bash
# D5 production validation — expands HTTP smoke with portal + observability probes.
# Requires live production URLs. Use after deploy pipeline succeeds.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../cicd/lib.sh
source "${ROOT}/scripts/cicd/lib.sh"

export DRIPPLEX_ENV="${DRIPPLEX_ENV:-production}"
export API_BASE_URL="${API_BASE_URL:-${PROD_API_BASE_URL:-https://api.dripplex.com/api/v1}}"
export CUSTOMER_URL="${CUSTOMER_URL:-${PROD_CUSTOMER_URL:-https://www.dripplex.com}}"
export MERCHANT_URL="${MERCHANT_URL:-${PROD_MERCHANT_URL:-https://merchant.dripplex.com}}"
export RIDER_URL="${RIDER_URL:-${PROD_RIDER_URL:-https://rider.dripplex.com}}"
export ADMIN_URL="${ADMIN_URL:-${PROD_ADMIN_URL:-https://admin.dripplex.com}}"
export SMOKE_STRICT="${SMOKE_STRICT:-1}"

GRAFANA_URL="${GRAFANA_URL:-https://grafana.dripplex.com}"
PROMETHEUS_URL="${PROMETHEUS_URL:-https://prometheus.dripplex.com}"
STATUS_URL="${STATUS_URL:-https://status.dripplex.com}"

FAILED=0
pass() { log "PASS  $*"; }
soft_fail() {
  log "FAIL  $*"
  FAILED=$((FAILED + 1))
}

log "=== D5 Production validation (env=${DRIPPLEX_ENV}) ==="

# Core CI smoke (auth gates, health, portals)
if ! "${ROOT}/scripts/cicd/smoke-test.sh"; then
  soft_fail "core smoke-test.sh failed"
fi

# Customer PWA assets
for path in /manifest.webmanifest /sw.js /offline.html; do
  url="${CUSTOMER_URL%/}${path}"
  # Customer may be on www; app shell may be app.dripplex.com
  if http_ok "${url}" || http_ok "https://app.dripplex.com${path}"; then
    pass "PWA asset ${path}"
  else
    soft_fail "PWA asset ${path} missing"
  fi
done

# Observability (best-effort; may be VPN-only)
for pair in "grafana:${GRAFANA_URL}" "prometheus:${PROMETHEUS_URL}" "status:${STATUS_URL}"; do
  name="${pair%%:*}"
  url="${pair#*:}"
  if http_ok "${url}"; then
    pass "${name} reachable"
  else
    log "WARN  ${name} not publicly reachable (${url}) — verify on obs host / VPN"
  fi
done

# Sentry env gate
if [[ -n "${SENTRY_DSN:-}" ]]; then
  pass "SENTRY_DSN configured for this run"
else
  log "WARN  SENTRY_DSN unset — error capture may be disabled"
fi

if [[ "${FAILED}" -gt 0 ]]; then
  notify "failure" "Production validation failed (${FAILED})"
  exit 1
fi

log "Production validation passed"
notify "success" "Production validation passed for ${DRIPPLEX_ENV}"
