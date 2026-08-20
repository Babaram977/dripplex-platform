#!/usr/bin/env bash
#
# DPX-LAUNCH-010 — server-side confirmation for the live five-persona test.
#
# The device half of the test is driven by a human in the real Super App. This
# is the other half: after each device action, it reads what the backend
# actually holds, so a screen that says "Completed" is never taken as evidence
# that the operation happened.
#
# It only ever READS, except for `login`, which creates a session the same way
# the app does. It cannot approve, activate, or advance anything — those must
# go through the real Ops workflow on a real screen. Nothing here bypasses
# activation or edits state to make a test proceed.
#
#   ./verify-flow.sh login    customer  ada@example.com 'password'   # -> token
#   DX_TOKEN=<token> ./verify-flow.sh customer
#   DX_TOKEN=<token> ./verify-flow.sh order    <orderId>
#   DX_TOKEN=<token> ./verify-flow.sh merchant
#   DX_TOKEN=<token> ./verify-flow.sh rider
#   DX_TOKEN=<token> ./verify-flow.sh driver
#   DX_TOKEN=<token> ./verify-flow.sh ops
#   DX_TOKEN=<opsToken> ./verify-flow.sh driver-record <driverId>
#
# Tokens are short-lived. Re-run `login` when calls start returning 401.

set -uo pipefail

API="${DX_API:-https://api.dripplex.com/api/v1}"
TOKEN="${DX_TOKEN:-}"

c_dim=$'\033[2m'; c_bold=$'\033[1m'; c_red=$'\033[31m'; c_grn=$'\033[32m'; c_off=$'\033[0m'

die() { printf '%s\n' "$*" >&2; exit 1; }

# get <path> <label> — GET and pretty-print, marking the HTTP outcome.
get() {
  local path="$1" label="${2:-$1}" code body
  body=$(curl -sS -m 25 -w $'\n%{http_code}' "$API$path" \
          ${TOKEN:+-H "Authorization: Bearer $TOKEN"} 2>/dev/null)
  code="${body##*$'\n'}"; body="${body%$'\n'*}"

  case "$code" in
    200) printf '%s  %-34s%s %s200%s\n' "$c_bold" "$label" "$c_off" "$c_grn" "$c_off" ;;
    401) printf '  %-34s %s401 — token expired or wrong persona%s\n' "$label" "$c_red" "$c_off"; return ;;
    *)   printf '  %-34s %s%s%s\n' "$label" "$c_red" "$code" "$c_off" ;;
  esac

  printf '%s' "$body" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print("    (non-JSON response)"); sys.exit()
d = d.get("data", d)
if isinstance(d, dict) and "items" in d:
    items = d["items"]
    print("    %d item(s), hasMore=%s" % (len(items), d.get("hasMore")))
    d = items[:5]
if isinstance(d, list):
    for it in d[:5]:
        if isinstance(it, dict):
            keys = [k for k in ("id","status","state","name","businessName","reference",
                                "orderNumber","totalAmount","amount","createdAt") if k in it]
            print("    " + "  ".join(f"{k}={it[k]}" for k in keys) or "    " + str(it)[:120])
        else:
            print("    " + str(it)[:120])
elif isinstance(d, dict):
    for k, v in list(d.items())[:14]:
        if isinstance(v, (dict, list)):
            v = f"<{type(v).__name__}, {len(v)}>"
        print(f"    {k} = {v}")
else:
    print("    " + str(d)[:200])
'
}

need_token() { [ -n "$TOKEN" ] || die "Set DX_TOKEN first (see: $0 login <persona> <email> <password>)"; }

section() { printf '\n%s── %s%s\n' "$c_dim" "$1" "$c_off"; }

cmd="${1:-}"; shift || true

case "$cmd" in
  login)
    persona="${1:-}"; email="${2:-}"; password="${3:-}"
    [ -n "$persona" ] && [ -n "$email" ] && [ -n "$password" ] \
      || die "usage: $0 login <customer|merchant|rider|driver|operations> <email> <password>"
    resp=$(curl -sS -m 25 -X POST "$API/auth/login/$persona" \
             -H 'Content-Type: application/json' \
             -d "$(python3 -c 'import json,sys; print(json.dumps({"email":sys.argv[1],"password":sys.argv[2]}))' "$email" "$password")")
    printf '%s' "$resp" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success"):
    print("LOGIN FAILED:", d.get("message")); sys.exit(1)
s = d["data"]; u = s["user"]
print("signed in  %s %s  status=%s  roles=%s" % (u["firstName"], u["lastName"], u["status"], u["roles"]))
print("session    %s  expires=%s" % (s["session"]["portal"], s["session"]["expiresAt"]))
print()
print("export DX_TOKEN=" + s["accessToken"])
'
    ;;

  customer)
    need_token
    section "CUSTOMER — what the backend holds"
    get /auth/me                 "identity"
    get /customer/cart           "cart"
    get /customer/orders         "orders"
    get /customer/wallet         "wallet"
    ;;

  order)
    need_token; id="${1:-}"; [ -n "$id" ] || die "usage: DX_TOKEN=… $0 order <orderId>"
    section "ORDER $id — did the transition actually land?"
    get "/customer/orders/$id"           "order"
    get "/customer/orders/$id/tracking"  "tracking"
    get "/customer/orders/$id/delivery"  "delivery"
    get "/customer/orders/$id/payment"   "payment"
    ;;

  merchant)
    need_token
    section "MERCHANT — what the backend holds"
    get /auth/me                 "identity"
    get /merchant/orders         "incoming orders"
    ;;

  rider)
    need_token
    section "RIDER — what the backend holds"
    get /auth/me                 "identity"
    get /rider/profile           "profile / documents"
    get /rider/availability      "availability"
    get /rider/jobs              "delivery jobs"
    get /rider/wallet            "wallet"
    ;;

  driver)
    need_token
    section "DRIVER — what the backend holds"
    get /auth/me                        "identity"
    get /driver/kyc                     "kyc"
    get /driver/vehicles                "vehicles"
    get /driver/activation-eligibility  "activation eligibility"
    get /driver/rides/availability      "online state"
    get /driver/rides/offers            "ride offers"
    get /driver/rides/active            "active ride"
    get /driver/wallet                  "earnings"
    ;;

  ops)
    need_token
    section "OPERATIONS — is the platform seeing it?"
    get /auth/me                              "identity + permissions"
    get /operations/dashboard/counters        "counters"
    get /operations/dashboard/activity-feed   "activity feed"
    get /operations/rides                     "rides"
    ;;

  driver-record)
    need_token; id="${1:-}"; [ -n "$id" ] || die "usage: DX_TOKEN=<opsToken> $0 driver-record <driverId>"
    section "OPS view of driver $id"
    get "/admin/driver/$id" "driver record"
    printf '\n  %sApproval is deliberately not automated here — approve through the real\n  Ops Console workflow, then re-run this to confirm the state actually moved.%s\n' "$c_dim" "$c_off"
    ;;

  *)
    sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
