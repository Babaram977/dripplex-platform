#!/usr/bin/env bash
# Deploy NestJS Backend Core API stack to a Linux host (Docker Compose).
# Intended to run ON the host (or via SSH from CI) from the repo root.
#
# Required env (or .env.production):
#   POSTGRES_*, REDIS_PASSWORD, DATABASE_URL, REDIS_URL,
#   JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CORS_ORIGINS
# Optional:
#   BACKEND_IMAGE, LETSENCRYPT_EMAIL, SKIP_CERTBOT=1
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="${COMPOSE_FILE:-infrastructure/docker/docker-compose.api.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKEND_IMAGE="${BACKEND_IMAGE:-ghcr.io/babaram977/dripplex-backend-core:1.0.0}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-ops@dripplex.com}"
DOMAIN="api.dripplex.com"

log() { echo "[deploy-api] $*"; }
fail() { echo "[deploy-api] ERROR: $*" >&2; exit 1; }

[[ -f "${ENV_FILE}" ]] || fail "Missing ${ENV_FILE}"

# shellcheck disable=SC1090
set -a
# Export compose vars from env file (passwords etc.)
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

export BACKEND_IMAGE ENV_FILE
export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB REDIS_PASSWORD

command -v docker >/dev/null || fail "docker not installed"
docker compose version >/dev/null || fail "docker compose v2 required"

log "Generating bootstrap TLS (if missing)"
bash scripts/backend/generate-bootstrap-tls.sh infrastructure/docker/certs

export NGINX_CONF="${NGINX_CONF:-infrastructure/nginx/api.dripplex.com.bootstrap.conf}"

log "Pulling images: ${BACKEND_IMAGE}"
docker pull "${BACKEND_IMAGE}" || log "WARN: pull failed — will try local/build"

log "Starting data plane + API (bootstrap nginx)"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d postgres redis pgbouncer
sleep 5
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d backend worker nginx uptime-kuma

log "Waiting for backend health"
for i in $(seq 1 36); do
  if curl -fsS "http://127.0.0.1/api/v1/health" >/tmp/api-health.json 2>/dev/null || \
     curl -fsS "http://127.0.0.1:3000/api/v1/health" >/tmp/api-health.json 2>/dev/null; then
    log "Backend healthy: $(head -c 200 /tmp/api-health.json)"
    break
  fi
  # Hit via compose network
  if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T backend \
    node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>r.text()).then(t=>{console.log(t);process.exit(0)}).catch(()=>process.exit(1))" \
    >/tmp/api-health.json 2>/dev/null; then
    log "Backend healthy (exec): $(head -c 200 /tmp/api-health.json)"
    break
  fi
  [[ "$i" -eq 36 ]] && fail "Backend health timeout"
  sleep 5
done

log "Running Prisma migrate deploy + idempotent RBAC bootstrap"
# seed-rbac.cjs runs `prisma migrate deploy` itself (via node_modules/.bin/prisma)
# and then upserts the Permission/Role/RolePermission catalog. It MUST be the
# single command run here — see prisma/seed-rbac.cjs header and
# docs/ops/DPX-LAUNCH-004-PRODUCTION-VERIFICATION.md. A bare `prisma migrate
# deploy` migrates but never seeds RBAC, leaving a fresh production database
# unable to register or log in (PrismaRegistrationRepository throws "Role … is
# not configured"). The seed is upsert-only, so re-running it on every deploy is
# idempotent. `prisma` is a production dependency, so node_modules/.bin/prisma
# survives `pnpm prune --prod` in the image.
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --entrypoint sh backend -lc \
  'node prisma/seed-rbac.cjs'

if [[ "${SKIP_CERTBOT:-0}" != "1" ]]; then
  log "Issuing Let's Encrypt certificate for ${DOMAIN}"
  # Ensure HTTP challenge path works on :80
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" \
    --email "${LETSENCRYPT_EMAIL}" \
    --agree-tos --non-interactive --keep-until-expiring \
    || log "WARN: certbot failed — keeping bootstrap TLS (set Cloudflare SSL to Full)"

  if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --entrypoint sh certbot -c \
    "test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"; then
    log "Switching nginx to Let's Encrypt config"
    export NGINX_CONF=infrastructure/nginx/api.dripplex.com.conf
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d nginx
  fi
fi

log "Installing daily backup + certbot renew cron (host)"
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO mkdir -p /var/lib/dripplex/backups
$SUDO tee /etc/cron.d/dripplex-api >/dev/null <<CRON
# Dripplex API maintenance
15 3 * * * root cd ${ROOT_DIR} && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T nginx nginx -s reload >/dev/null 2>&1 || true
30 3 * * * root ${ROOT_DIR}/scripts/backend/backup-postgres.sh >> /var/log/dripplex-backup.log 2>&1
CRON
$SUDO chmod 644 /etc/cron.d/dripplex-api || true

log "Deploy complete"
curl -fsS "https://${DOMAIN}/api/v1/health" || curl -fsS "http://127.0.0.1/api/v1/health" || true
echo
