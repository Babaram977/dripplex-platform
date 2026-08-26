#!/usr/bin/env bash
# Attempt Cloudflare Workers deploys for all OpenNext portal apps.
# Continues past individual failures and prints a summary.
# Requires: CLOUDFLARE_API_TOKEN (or wrangler login) on a Free+ account.
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

APPS=(
  customer-web
  merchant-portal
  rider-portal
  operations-console
)

MODE="${1:-deploy}" # deploy | dry-run | temporary
FAILED=()
SUCCEEDED=()
SKIPPED=()

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "WARNING: CLOUDFLARE_API_TOKEN is unset. Wrangler will use interactive login or temporary preview."
  echo "         Temporary preview accounts enforce a 1 MiB Worker limit (OpenNext bundles exceed this)."
fi

for app in "${APPS[@]}"; do
  APP_DIR="${ROOT_DIR}/apps/${app}"
  if [[ ! -f "${APP_DIR}/wrangler.jsonc" ]]; then
    echo "SKIP ${app}: no wrangler.jsonc"
    SKIPPED+=("${app}")
    continue
  fi

  echo ""
  echo "════════════════════════════════════════"
  echo " Deploying ${app} (mode=${MODE})"
  echo "════════════════════════════════════════"

  (
    set -euo pipefail
    cd "${APP_DIR}"
    if [[ ! -d .open-next ]]; then
      echo "Building OpenNext bundle via scripts/cf-build.sh…"
      bash scripts/cf-build.sh
    fi
    case "${MODE}" in
      dry-run)
        pnpm exec wrangler deploy --dry-run
        ;;
      temporary)
        pnpm exec wrangler deploy --temporary
        ;;
      *)
        pnpm exec wrangler deploy
        ;;
    esac
  )
  rc=$?
  if [[ ${rc} -eq 0 ]]; then
    SUCCEEDED+=("${app}")
  else
    echo "FAILED ${app} (exit ${rc})"
    FAILED+=("${app}")
  fi
done

echo ""
echo "════════════════════════════════════════"
echo " Cloudflare deploy summary"
echo "════════════════════════════════════════"
echo "Succeeded: ${SUCCEEDED[*]:-none}"
echo "Failed:    ${FAILED[*]:-none}"
echo "Skipped:   ${SKIPPED[*]:-none}"

if [[ ${#FAILED[@]} -gt 0 ]]; then
  exit 1
fi
exit 0
