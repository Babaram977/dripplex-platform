#!/usr/bin/env bash
# Static checks for mobile packaging (no SDK required).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "== customer-mobile config =="
node "${ROOT}/apps/customer-mobile/scripts/verify-config.mjs"

echo "== PWA manifest JSON =="
node -e "JSON.parse(require('fs').readFileSync('${ROOT}/apps/customer-web/public/manifest.webmanifest','utf8')); console.log('OK manifest.webmanifest')"

echo "== Deep link templates =="
test -f "${ROOT}/apps/customer-mobile/resources/deep-linking/README.md"

echo "== Store asset specs =="
test -f "${ROOT}/store-assets/README.md"

echo "Mobile packaging static verification passed."
