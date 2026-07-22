#!/usr/bin/env bash
# Rollback to previous image tag (or ROLLBACK_TAG)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

DRIPPLEX_ENV="${DRIPPLEX_ENV:?DRIPPLEX_ENV required}"
REGISTRY="${REGISTRY:-ghcr.io/babaram977}"
DEPLOY_MODE="${DEPLOY_MODE:-ssh}"
PREVIOUS_TAG_FILE="${PREVIOUS_TAG_FILE:-/var/lib/dripplex/previous-image-tag}"
REASON="${1:-automated failure}"

if [[ -n "${ROLLBACK_TAG:-}" ]]; then
  TAG="${ROLLBACK_TAG}"
elif [[ "${DEPLOY_MODE}" == "dry-run" || "${DRY_RUN:-0}" == "1" ]]; then
  TAG="${ROLLBACK_TAG:-previous}"
else
  require_env DEPLOY_HOST
  require_env DEPLOY_USER
  TAG="$(ssh -o StrictHostKeyChecking=yes "${DEPLOY_USER}@${DEPLOY_HOST}" "cat ${PREVIOUS_TAG_FILE}")"
fi

[[ -n "${TAG}" ]] || fail "No previous tag available for rollback"

log "ROLLBACK ${DRIPPLEX_ENV} → ${TAG} (${REASON})"
notify "rollback" "Rolling back ${DRIPPLEX_ENV} to ${TAG}: ${REASON}"

export IMAGE_TAG="${TAG}"
export DEPLOY_MODE
export DRIPPLEX_ENV
export SKIP_BACKUP=1
"${SCRIPT_DIR}/deploy.sh"

notify "rollback" "Rollback to ${TAG} completed (validation still required)"
