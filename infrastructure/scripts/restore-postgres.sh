#!/usr/bin/env bash
# Restore Postgres from age-encrypted custom dump
set -euo pipefail

ENC_PATH="${1:?usage: restore-postgres.sh <file.dump.age>}"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${AGE_IDENTITY:?AGE_IDENTITY path to age private key required}"

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

echo "[restore-postgres] decrypting…"
age -d -i "${AGE_IDENTITY}" -o "${TMP}" "${ENC_PATH}"

echo "[restore-postgres] restoring (destructive clean)…"
pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL}" "${TMP}"

echo "[restore-postgres] complete — run API health checks"
