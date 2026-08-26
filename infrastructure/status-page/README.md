# Public status page (Program D3)

Served via Uptime Kuma status page at **https://status.dripplex.com**.

## Components to publish

| Component       | Monitor                           |
| --------------- | --------------------------------- |
| Website         | www.dripplex.com                  |
| API             | api.dripplex.com `/api/v1/health` |
| Merchant Portal | merchant.dripplex.com             |
| Rider Portal    | rider.dripplex.com                |
| Status itself   | status.dripplex.com               |

## Capabilities

- Component status (up / degraded / down)
- Incident history
- Scheduled maintenance announcements
- Subscribe (email/webhook) via Kuma if enabled

## Setup

1. Open Uptime Kuma admin (VPN / Access only).
2. Import monitors from `infrastructure/uptime-kuma/monitors.json` (manual create acceptable).
3. Create Status Page → domain `status.dripplex.com` (already routed in D1 nginx).
4. Keep admin UI off the public internet.

## Incident posts (template)

```text
Title: [Investigating] Elevated API errors
Impact: Customers may see delays placing orders
Start: YYYY-MM-DD HH:MM WAT
Updates: every 30 minutes until resolved
```
