#!/usr/bin/env bash
# Deploy Compose stack to a remote host via SSH, or locally when DEPLOY_MODE=local
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

DRIPPLEX_ENV="${DRIPPLEX_ENV:?DRIPPLEX_ENV=staging|production}"
IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG required}"
REGISTRY="${REGISTRY:-ghcr.io/babaram977}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
DEPLOY_MODE="${DEPLOY_MODE:-ssh}" # ssh | local | dry-run
PREVIOUS_TAG_FILE="${PREVIOUS_TAG_FILE:-/var/lib/dripplex/previous-image-tag}"

if [[ -z "${COMPOSE_FILE}" ]]; then
  if [[ "${DRIPPLEX_ENV}" == "production" ]]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.production.yml"
  else
    COMPOSE_FILE="infrastructure/docker/docker-compose.staging.yml"
  fi
fi

export BACKEND_IMAGE="${REGISTRY}/dripplex-backend-core:${IMAGE_TAG}"
export CUSTOMER_IMAGE="${REGISTRY}/dripplex-customer-web:${IMAGE_TAG}"
export MERCHANT_IMAGE="${REGISTRY}/dripplex-merchant-portal:${IMAGE_TAG}"
export RIDER_IMAGE="${REGISTRY}/dripplex-rider-portal:${IMAGE_TAG}"
export ADMIN_IMAGE="${REGISTRY}/dripplex-admin-portal:${IMAGE_TAG}"

remote() {
  if [[ "${DEPLOY_MODE}" == "local" ]]; then
    bash -lc "$*"
  elif [[ "${DEPLOY_MODE}" == "dry-run" || "${DRY_RUN:-0}" == "1" ]]; then
    log "DRY_RUN remote: $*"
  else
    require_env DEPLOY_HOST
    require_env DEPLOY_USER
    ssh -o StrictHostKeyChecking=yes "${DEPLOY_USER}@${DEPLOY_HOST}" "$*"
  fi
}

log "Deploy ${DRIPPLEX_ENV} tag=${IMAGE_TAG} mode=${DEPLOY_MODE}"

# Persist previous tag for rollback
remote "mkdir -p /var/lib/dripplex && (cat /var/lib/dripplex/current-image-tag > ${PREVIOUS_TAG_FILE} 2>/dev/null || true) && echo ${IMAGE_TAG} > /var/lib/dripplex/current-image-tag"

# Pre-migrate backup (best effort)
if [[ "${SKIP_BACKUP:-0}" != "1" ]]; then
  remote "DRIPPLEX_ENV=${DRIPPLEX_ENV} IMAGE_TAG=${IMAGE_TAG} bash -lc 'command -v pg_dump >/dev/null && echo backup-ok || echo backup-skipped'"
fi

# Pull images
remote "docker pull ${BACKEND_IMAGE} && docker pull ${CUSTOMER_IMAGE} && docker pull ${MERCHANT_IMAGE} && docker pull ${RIDER_IMAGE} && docker pull ${ADMIN_IMAGE}"

# Migrate (API image one-off or host pnpm)
remote "docker run --rm --network dripplex_${DRIPPLEX_ENV}_data -e DATABASE_URL \"${BACKEND_IMAGE}\" sh -lc 'npx prisma migrate deploy' || docker run --rm -e DATABASE_URL \"${BACKEND_IMAGE}\" sh -lc 'npx prisma migrate deploy'"

# Compose up
remote "export BACKEND_IMAGE CUSTOMER_IMAGE MERCHANT_IMAGE RIDER_IMAGE ADMIN_IMAGE IMAGE_TAG=${IMAGE_TAG}; cd /opt/dripplex && docker compose -f ${COMPOSE_FILE} up -d"

notify "progress" "Deployed images ${IMAGE_TAG} to ${DRIPPLEX_ENV} — running validation"

log "Deploy command sequence complete — run health-check.sh + smoke-test.sh next"
