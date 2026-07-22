# D1 — Security checklist

## Edge

- [ ] Cloudflare proxy enabled on all public hostnames
- [ ] SSL mode **Full (strict)**
- [ ] TLS 1.3 minimum at edge
- [ ] WAF managed rules enabled
- [ ] Rate limiting on auth endpoints
- [ ] DDoS automatic protection confirmed
- [ ] HSTS enabled
- [ ] `admin.dripplex.com` behind Cloudflare Access
- [ ] Origin firewall allows **only** Cloudflare IP ranges on 80/443

## Network

- [ ] Postgres not publicly reachable
- [ ] Redis not publicly reachable
- [ ] Private Hetzner network for app↔data
- [ ] SSH key-only; fail2ban; bastion or WireGuard
- [ ] Unattended security updates

## Application platform

- [ ] Portal security headers from C3 retained (CSP, HSTS, etc.)
- [ ] Secrets not in images or git
- [ ] Least-privilege IAM (Cloudflare, Hetzner, R2, B2, GitHub)
- [ ] Dependabot / `pnpm audit` in CI (from C4)

## Data

- [ ] Volume encryption for Postgres
- [ ] Encrypted backups to B2
- [ ] Backup restore drill scheduled
- [ ] NDPR-aware retention for private documents

## CI/CD

- [ ] Environment protection rules on `production`
- [ ] Required reviewers for prod deploy
- [ ] No plaintext secrets in workflow logs

Sign-off: _______________ Date: _______________
