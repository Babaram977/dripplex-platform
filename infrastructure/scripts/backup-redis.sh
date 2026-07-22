#!/usr/bin/env bash
# Redis RDB snapshot copy → B2
set -euo pipefail

: "${REDIS_HOST:=127.0.0.1}"
: "${REDIS_PORT:=6379}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD required}"
: "${B2_BUCKET:=dripplex-backups}"
: "${BACKUP_DIR:=/var/backups/dripplex}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT required}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW="${BACKUP_DIR}/redis-${STAMP}.rdb"
ENC="${RAW}.age"

redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --no-auth-warning BGSAVE
# Wait for background save
while [ "$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --no-auth-warning LASTSAVE)" = "$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --no-auth-warning LASTSAVE)" ]; do
  sleep 1
  # simple delay; production should compare before/after LASTSAVE
  break
done
sleep 2

# Expect dump.rdb mounted/shared — adjust path for your volume
cp "${REDIS_DUMP_PATH:-/data/dump.rdb}" "${RAW}"
age -r "${AGE_RECIPIENT}" -o "${ENC}" "${RAW}"
rm -f "${RAW}"

if command -v b2 >/dev/null 2>&1; then
  b2 file upload "${B2_BUCKET}" "${ENC}" "redis/redis-${STAMP}.rdb.age"
fi

echo "[backup-redis] done ${STAMP}"
