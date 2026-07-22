#!/usr/bin/env bash
# Orchestrate deploy → health → smoke → auto-rollback on failure
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

DRIPPLEX_ENV="${DRIPPLEX_ENV:?}"
IMAGE_TAG="${IMAGE_TAG:?}"
export DRIPPLEX_ENV IMAGE_TAG

cleanup_rollback() {
  local ec=$?
  if [[ "${ec}" -ne 0 && "${SKIP_ROLLBACK:-0}" != "1" ]]; then
    log "Pipeline failed (exit ${ec}) — initiating rollback"
    "${SCRIPT_DIR}/rollback.sh" "pipeline failure exit=${ec}" || true
    notify "failure" "Deploy ${IMAGE_TAG} to ${DRIPPLEX_ENV} failed; rollback attempted"
  fi
  exit "${ec}"
}
trap cleanup_rollback EXIT

"${SCRIPT_DIR}/deploy.sh"
"${SCRIPT_DIR}/health-check.sh"
SMOKE_STRICT="${SMOKE_STRICT:-1}" "${SCRIPT_DIR}/smoke-test.sh"
notify "success" "Release ${IMAGE_TAG} promoted to ${DRIPPLEX_ENV}"
trap - EXIT
log "Pipeline OK"
