#!/usr/bin/env bash
# Program D2 — attempt full production Cloudflare Workers deploy + domain attach.
# Requires CLOUDFLARE_API_TOKEN in the environment (Workers Edit + Zone DNS Edit).
set -u
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

REPORT="${ROOT_DIR}/docs/ops/reports/D2-DEPLOYMENT-REPORT.md"
mkdir -p "$(dirname "${REPORT}")"

declare -A APP_WORKER=(
  [customer-web]=dripplex-customer-web
  [merchant-portal]=dripplex-merchant
  [rider-portal]=dripplex-rider
  [admin-portal]=dripplex-admin
  [operations-console]=dripplex-ops
)

APPS=(customer-web merchant-portal rider-portal admin-portal operations-console)
SUCCEEDED=()
FAILED=()
WORKER_URLS=()

echo "=== Wrangler auth ==="
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "BLOCKER: CLOUDFLARE_API_TOKEN is not set in this environment."
  echo "Set a token with: Account → Workers Scripts Edit, Account Settings Read, Zone → DNS Edit"
  AUTH_OK=0
else
  if pnpm --filter @dripplex/customer-web exec wrangler whoami; then
    AUTH_OK=1
  else
    AUTH_OK=0
  fi
fi

if [[ "${AUTH_OK}" -eq 1 ]]; then
  for app in "${APPS[@]}"; do
    echo ""
    echo "=== Deploy ${app} → ${APP_WORKER[$app]} ==="
    if (
      set -euo pipefail
      bash "apps/${app}/scripts/cf-build.sh"
      cd "apps/${app}"
      pnpm exec wrangler deploy
    ); then
      SUCCEEDED+=("${app}")
      WORKER_URLS+=("https://${APP_WORKER[$app]}.<subdomain>.workers.dev")
    else
      FAILED+=("${app}")
    fi
  done

  # Best-effort: delete obsolete Worker if present
  echo ""
  echo "=== Migrate obsolete dripplex-platform (best effort) ==="
  pnpm --filter @dripplex/customer-web exec wrangler delete dripplex-platform --force 2>/dev/null || \
    echo "Obsolete worker dripplex-platform not deleted (missing or no permission)."
fi

# Probe live URLs
echo ""
echo "=== Live HTTP probes ==="
PROBES=(
  https://dripplex.com
  https://www.dripplex.com
  https://app.dripplex.com
  https://merchant.dripplex.com
  https://rider.dripplex.com
  https://admin.dripplex.com
  https://ops.dripplex.com
  https://api.dripplex.com/api/v1/health
)
PROBE_LINES=()
for u in "${PROBES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>/dev/null || echo "000")
  tls=$(echo | openssl s_client -connect "$(echo "$u" | sed -E 's#https://##' | cut -d/ -f1):443" -servername "$(echo "$u" | sed -E 's#https://##' | cut -d/ -f1)" 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null | tr '\n' ' ' || echo "tls-check-failed")
  echo "$code $u | $tls"
  PROBE_LINES+=("| \`$u\` | $code | $tls |")
done

# Write report
{
  echo "# D2 Deployment Report"
  echo ""
  echo "**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "## Auth"
  echo ""
  if [[ "${AUTH_OK}" -eq 1 ]]; then
    echo "- Wrangler authenticated: **yes**"
  else
    echo "- Wrangler authenticated: **no** — \`CLOUDFLARE_API_TOKEN\` missing or invalid"
  fi
  echo ""
  echo "## Workers"
  echo ""
  echo "| App | Worker name | Deploy |"
  echo "| --- | --- | --- |"
  for app in "${APPS[@]}"; do
    status="not attempted"
    for s in "${SUCCEEDED[@]:-}"; do [[ "$s" == "$app" ]] && status="succeeded"; done
    for f in "${FAILED[@]:-}"; do [[ "$f" == "$app" ]] && status="failed"; done
    echo "| \`$app\` | \`${APP_WORKER[$app]}\` | $status |"
  done
  echo ""
  echo "## Custom domains (configured in wrangler.jsonc)"
  echo ""
  echo "| Worker | Domains |"
  echo "| --- | --- |"
  echo "| dripplex-customer-web | dripplex.com, www.dripplex.com, app.dripplex.com |"
  echo "| dripplex-merchant | merchant.dripplex.com |"
  echo "| dripplex-rider | rider.dripplex.com |"
  echo "| dripplex-admin | admin.dripplex.com |"
  echo "| dripplex-ops | ops.dripplex.com |"
  echo ""
  echo "## Live probes"
  echo ""
  echo "| URL | HTTP | TLS |"
  echo "| --- | --- | --- |"
  for line in "${PROBE_LINES[@]}"; do echo "$line"; done
  echo ""
  echo "## Remaining blockers"
  echo ""
  if [[ "${AUTH_OK}" -ne 1 ]]; then
    echo "1. Set \`CLOUDFLARE_API_TOKEN\` (and optional \`CLOUDFLARE_ACCOUNT_ID\`) in the cloud agent / GitHub Actions secrets."
    echo "2. Ensure the Cloudflare zone for dripplex.com is **Active** (NS jake/molly must answer authoritatively — currently REFUSED until zone activates)."
    echo "3. Re-run: \`bash scripts/cloudflare/d2-deploy-production.sh\`"
  elif [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "1. Fix failed deploys: ${FAILED[*]}"
  else
    echo "- None for frontend Workers (re-check API backend separately)."
  fi
} > "${REPORT}"

echo ""
echo "Report written to ${REPORT}"
[[ "${AUTH_OK}" -eq 1 && ${#FAILED[@]} -eq 0 ]]
