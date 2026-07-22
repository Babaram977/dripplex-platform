#!/usr/bin/env bash
# Shared helpers for Dripplex CI/CD scripts
set -euo pipefail

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
      log "DRY_RUN: missing ${name} (continuing)"
      return 0
    fi
    fail "${name} is required"
  fi
}

notify() {
  local status="$1"
  local message="$2"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -fsS -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"*[Dripplex ${DRIPPLEX_ENV:-ci}]* ${status}: ${message}\"}" \
      "${SLACK_WEBHOOK_URL}" >/dev/null || log "notify failed (non-fatal)"
  else
    log "notify[${status}]: ${message}"
  fi
}

http_ok() {
  local url="$1"
  local code
  code="$(curl -sS -o /tmp/dripplex-http-body -w '%{http_code}' --max-time 30 "${url}" || true)"
  [[ "${code}" =~ ^2 ]]
}
