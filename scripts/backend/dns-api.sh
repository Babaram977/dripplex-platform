#!/usr/bin/env bash
# Point api.dripplex.com at the production host via Cloudflare DNS API.
# Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, API_ORIGIN_IP
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?}"
: "${CLOUDFLARE_ZONE_ID:?}"
: "${API_ORIGIN_IP:?}"

CF_API="https://api.cloudflare.com/client/v4"
NAME="api.dripplex.com"
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

echo "Ensuring A record ${NAME} → ${API_ORIGIN_IP} (proxied)"

existing=$(curl -sS "${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=A&name=${NAME}" "${auth[@]}")
id=$(echo "${existing}" | python3 -c "import sys,json; r=json.load(sys.stdin).get('result') or []; print(r[0]['id'] if r else '')")

payload=$(python3 -c "import json; print(json.dumps({'type':'A','name':'${NAME}','content':'${API_ORIGIN_IP}','ttl':1,'proxied':True}))")

if [[ -n "${id}" ]]; then
  curl -sS -X PUT "${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${id}" "${auth[@]}" --data "${payload}"
else
  curl -sS -X POST "${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/dns_records" "${auth[@]}" --data "${payload}"
fi
echo
echo "DNS update requested for ${NAME}"
