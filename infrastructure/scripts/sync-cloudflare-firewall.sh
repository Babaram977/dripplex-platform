#!/usr/bin/env bash
# Restrict origin firewall to Cloudflare IP ranges (iptables example)
# Prefer Hetzner Cloud Firewall UI with the same CIDRs.
set -euo pipefail

CF_IPS_URL='https://www.cloudflare.com/ips-v4'
PORT="${1:-443}"

echo "[cf-firewall] fetching Cloudflare IPv4…"
mapfile -t CIDRS < <(curl -fsSL "${CF_IPS_URL}")

# Example: allow established + SSH from bastion separately
# iptables -A INPUT -p tcp --dport "${PORT}" -j DROP  # after allowing CF

for cidr in "${CIDRS[@]}"; do
  echo "allow ${cidr} → :${PORT}"
  # iptables -I INPUT -p tcp -s "${cidr}" --dport "${PORT}" -j ACCEPT
done

echo "[cf-firewall] dry-run complete — uncomment iptables lines or sync to Hetzner Firewall"
