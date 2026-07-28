# D1 — Estimated monthly infrastructure cost

Estimates in **EUR** (Hetzner) + **USD** (Cloudflare/B2/Sentry). Prices fluctuate; treat as planning envelope for launch, not a quote.

## Compute & storage (Hetzner — approx.)

| Resource             | Spec                   | Est. €/mo     |
| -------------------- | ---------------------- | ------------- |
| lb-01 CX22           | 2 vCPU / 4 GB          | ~8            |
| app-01 CX32          | 4 / 8 GB               | ~15           |
| app-02 CX32          | 4 / 8 GB               | ~15           |
| data-01 CX42         | 8 / 16 GB              | ~30           |
| obs-01 CX22          | 2 / 4 GB               | ~8            |
| Volume 200 GB        | pg-data                | ~10           |
| Volume 20 GB         | redis                  | ~1            |
| Volume 100 GB        | backup scratch         | ~5            |
| Floating IP          | 1                      | ~3            |
| Traffic              | 20 TB included typical | 0–20          |
| **Subtotal Hetzner** |                        | **~95–115 €** |

**Budget launch (2 nodes):** ~45–60 €/mo (higher risk).

## Cloudflare

| Item                                | Est.     |
| ----------------------------------- | -------- |
| Pro plan (WAF, better SSL, caching) | ~$20/mo  |
| R2 storage 50 GB + Class A/B ops    | ~$1–5    |
| R2 egress                           | $0       |
| **Subtotal CF**                     | **~$25** |

Free plan possible at extreme budget; Pro recommended for WAF/rate-limit UX.

## Backups & SaaS

| Item                | Est.     |
| ------------------- | -------- |
| Backblaze B2 200 GB | ~$1–2    |
| Sentry Team         | ~$26     |
| Domain / email DNS  | existing |
| **Subtotal**        | **~$30** |

## Totals (launch production)

| Profile                                       | Monthly                                    |
| --------------------------------------------- | ------------------------------------------ |
| Recommended (5 nodes + CF Pro + Sentry)       | **≈ $160–200** (mixed EUR/USD ≈ 150–190 €) |
| Budget (2 nodes + CF Free + Sentry free tier) | **≈ $60–90**                               |

## Scaling cost drivers

- Second data node / managed Postgres
- Extra app replicas under load
- R2 growth (storage only; no egress)
- Grafana Cloud / larger obs disk for Loki retention

Revisit after first 90 days of real traffic.
