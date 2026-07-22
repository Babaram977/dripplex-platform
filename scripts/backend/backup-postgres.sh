#!/usr/bin/env bash
# Daily Postgres dump for the API Compose stack.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-infrastructure/docker/docker-compose.api.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
OUT_DIR="${BACKUP_DIR:-/var/lib/dripplex/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${OUT_DIR}"

cd "${ROOT_DIR}"
# shellcheck disable=SC1090
set -a && source "${ENV_FILE}" && set +a

FILE="${OUT_DIR}/dripplex-pg-${STAMP}.sql.gz"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -c >"${FILE}"
ln -sfn "${FILE}" "${OUT_DIR}/dripplex-pg-latest.sql.gz"
# Retain 14 days
find "${OUT_DIR}" -name 'dripplex-pg-*.sql.gz' -mtime +14 -delete || true
echo "Backup written ${FILE}"
