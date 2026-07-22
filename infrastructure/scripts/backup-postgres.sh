#!/usr/bin/env bash
# Daily Postgres logical backup → encrypted local file → Backblaze B2
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL required}"
: "${B2_BUCKET:=dripplex-backups}"
: "${BACKUP_DIR:=/var/backups/dripplex}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT required for encryption}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW="${BACKUP_DIR}/postgres-${STAMP}.dump"
ENC="${RAW}.age"

echo "[backup-postgres] dumping…"
pg_dump "${DATABASE_URL}" --format=custom --file="${RAW}"

echo "[backup-postgres] encrypting…"
age -r "${AGE_RECIPIENT}" -o "${ENC}" "${RAW}"
rm -f "${RAW}"

if command -v b2 >/dev/null 2>&1; then
  echo "[backup-postgres] uploading to B2…"
  b2 file upload "${B2_BUCKET}" "${ENC}" "postgres/postgres-${STAMP}.dump.age"
elif command -v rclone >/dev/null 2>&1; then
  rclone copyto "${ENC}" "b2:${B2_BUCKET}/postgres/postgres-${STAMP}.dump.age"
else
  echo "[backup-postgres] WARN: no b2/rclone; left encrypted file at ${ENC}"
fi

# Retain local encrypted copies 3 days
find "${BACKUP_DIR}" -name 'postgres-*.dump.age' -mtime +3 -delete
echo "[backup-postgres] done ${STAMP}"
