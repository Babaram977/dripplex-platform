#!/usr/bin/env bash
# Bootstrap an Ubuntu 24.04 host for the DrippleX API Compose stack.
# Safe to run as a sudo-capable deploy user.
set -euo pipefail

run() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

export DEBIAN_FRONTEND=noninteractive
run apt-get update -y
run apt-get install -y ca-certificates curl gnupg ufw fail2ban jq openssl cron rsync

# Docker Engine
if ! command -v docker >/dev/null; then
  run install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  run chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | run tee /etc/apt/sources.list.d/docker.list >/dev/null
  run apt-get update -y
  run apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

run systemctl enable --now docker
# Allow deploy user to run docker without root when possible
if [[ "$(id -u)" -ne 0 ]]; then
  run usermod -aG docker "$(id -un)" || true
fi

# Firewall — SSH + HTTP/S (Cloudflare will hit 80/443)
run ufw allow OpenSSH || true
run ufw allow 80/tcp || true
run ufw allow 443/tcp || true
run ufw --force enable || true

run mkdir -p /opt/dripplex /var/lib/dripplex/backups
run chown -R "$(id -un):$(id -gn)" /opt/dripplex || true
echo "Host bootstrap complete. Next: sync repo to /opt/dripplex and run scripts/backend/deploy-api.sh"
