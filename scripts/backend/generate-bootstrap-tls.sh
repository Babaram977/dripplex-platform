#!/usr/bin/env bash
# Generate a short-lived self-signed cert for api.dripplex.com bootstrap.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERT_DIR="${1:-${ROOT_DIR}/infrastructure/docker/certs}"
mkdir -p "${CERT_DIR}"
openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
  -keyout "${CERT_DIR}/origin.key" \
  -out "${CERT_DIR}/origin.pem" \
  -subj "/CN=api.dripplex.com/O=Dripplex Bootstrap/C=NG" \
  -addext "subjectAltName=DNS:api.dripplex.com"
chmod 600 "${CERT_DIR}/origin.key"
echo "Wrote ${CERT_DIR}/origin.pem (+ key)"
