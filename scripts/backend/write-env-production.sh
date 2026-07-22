#!/usr/bin/env bash
# Write .env.production from environment variables (used by CI on the host).
set -euo pipefail
OUT="${1:-.env.production}"

require() { [[ -n "${!1:-}" ]] || { echo "Missing env: $1" >&2; exit 1; }; }

require POSTGRES_USER
require POSTGRES_PASSWORD
require POSTGRES_DB
require REDIS_PASSWORD
require JWT_ACCESS_SECRET
require JWT_REFRESH_SECRET

DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:5432/${POSTGRES_DB}?schema=public&pgbouncer=true}"
REDIS_URL="${REDIS_URL:-redis://:${REDIS_PASSWORD}@redis:6379/0}"
CORS_ORIGINS="${CORS_ORIGINS:-https://www.dripplex.com,https://app.dripplex.com,https://dripplex.com,https://merchant.dripplex.com,https://rider.dripplex.com,https://admin.dripplex.com,https://ops.dripplex.com}"

umask 077
cat >"${OUT}" <<EOF
NODE_ENV=production
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=${DATABASE_URL}
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=${REDIS_URL}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
CORS_ORIGINS=${CORS_ORIGINS}
API_HOST=0.0.0.0
API_PORT=3000
API_GLOBAL_PREFIX=api/v1
LOG_LEVEL=${LOG_LEVEL:-info}
PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY:-}
PAYSTACK_PUBLIC_KEY=${PAYSTACK_PUBLIC_KEY:-}
PAYMENT_DEFAULT_PROVIDER=${PAYMENT_DEFAULT_PROVIDER:-PAYSTACK}
SENTRY_DSN=${SENTRY_DSN:-}
SENTRY_ENVIRONMENT=production
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASSWORD=${SMTP_PASSWORD:-}
EMAIL_FROM=${EMAIL_FROM:-noreply@dripplex.com}
TERMII_API_KEY=${TERMII_API_KEY:-}
TERMII_SENDER_ID=${TERMII_SENDER_ID:-Dripplex}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY:-}
EOF
chmod 600 "${OUT}"
echo "Wrote ${OUT}"
