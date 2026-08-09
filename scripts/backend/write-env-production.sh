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
CORS_ORIGINS="${CORS_ORIGINS:-https://www.dripplex.com,https://app.dripplex.com,https://dripplex.com,https://merchant.dripplex.com,https://rider.dripplex.com,https://driver.dripplex.com,https://admin.dripplex.com,https://ops.dripplex.com}"

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
# Payments — Paystack primary; Flutterwave dormant until approved; OPay disabled.
PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY:-}
PAYSTACK_PUBLIC_KEY=${PAYSTACK_PUBLIC_KEY:-}
FLUTTERWAVE_SECRET_KEY=${FLUTTERWAVE_SECRET_KEY:-}
FLUTTERWAVE_PUBLIC_KEY=${FLUTTERWAVE_PUBLIC_KEY:-}
FLUTTERWAVE_WEBHOOK_HASH=${FLUTTERWAVE_WEBHOOK_HASH:-}
PAYMENT_DEFAULT_PROVIDER=${PAYMENT_DEFAULT_PROVIDER:-PAYSTACK}
# Observability
SENTRY_DSN=${SENTRY_DSN:-}
SENTRY_ENVIRONMENT=production
# Transactional email — the backend reads RESEND_*, not SMTP_*.
RESEND_API_KEY=${RESEND_API_KEY:-}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-DrippleX <no-reply@dripplex.com>}
# SMS (Termii)
TERMII_API_KEY=${TERMII_API_KEY:-}
TERMII_SENDER_ID=${TERMII_SENDER_ID:-Dripplex}
# Push notifications (Firebase Cloud Messaging)
FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID:-}
FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL:-}
FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY:-}
# Maps / geocoding — the backend reads GOOGLE_MAPS_SERVER_API_KEY.
GOOGLE_MAPS_SERVER_API_KEY=${GOOGLE_MAPS_SERVER_API_KEY:-}
# Google Sign-In (optional; stays off until all three are set)
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL:-}
CUSTOMER_APP_URL=${CUSTOMER_APP_URL:-https://app.dripplex.com}
# Object storage (uploads). Leave empty to keep uploads safely disabled.
# NOTE: the KYC / identity-verification bucket MUST be a PRIVATE-ACL bucket —
# sensitive objects are served only via short-lived signed GET (DPX-STORAGE-001).
OBJECT_STORAGE_ENDPOINT=${OBJECT_STORAGE_ENDPOINT:-}
OBJECT_STORAGE_REGION=${OBJECT_STORAGE_REGION:-auto}
OBJECT_STORAGE_BUCKET=${OBJECT_STORAGE_BUCKET:-}
OBJECT_STORAGE_ACCESS_KEY_ID=${OBJECT_STORAGE_ACCESS_KEY_ID:-}
OBJECT_STORAGE_SECRET_ACCESS_KEY=${OBJECT_STORAGE_SECRET_ACCESS_KEY:-}
OBJECT_STORAGE_PUBLIC_BASE_URL=${OBJECT_STORAGE_PUBLIC_BASE_URL:-}
# Driver identity verification is DrippleX-native (device biometric + the
# DrippleX driver record). Smile ID is intentionally NOT a launch dependency,
# so no SMILE_ID_* keys are required here.
EOF
chmod 600 "${OUT}"
echo "Wrote ${OUT}"
