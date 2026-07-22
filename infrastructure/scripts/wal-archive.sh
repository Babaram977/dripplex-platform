#!/usr/bin/env bash
# Archive a WAL file to B2 (hook from archive_command)
set -euo pipefail
WAL_PATH="${1:?wal path}"
WAL_NAME="${2:?wal name}"
: "${B2_BUCKET:=dripplex-backups}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT required}"

ENC="$(mktemp)"
trap 'rm -f "${ENC}"' EXIT
age -r "${AGE_RECIPIENT}" -o "${ENC}" "${WAL_PATH}"

if command -v b2 >/dev/null 2>&1; then
  b2 file upload "${B2_BUCKET}" "${ENC}" "wal/${WAL_NAME}.age"
fi
