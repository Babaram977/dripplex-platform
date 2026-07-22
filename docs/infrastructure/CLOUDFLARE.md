# D1 — Cloudflare configuration

Zone: **dripplex.com**  
Mode: Proxied (orange cloud) for all public app hostnames.

Reference: [Full (strict) SSL](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

## DNS records

| Type  | Name              | Target                             | Proxy    | TTL  |
| ----- | ----------------- | ---------------------------------- | -------- | ---- |
| A     | `@`               | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| A     | `www`             | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| A     | `api`             | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| A     | `merchant`        | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| A     | `rider`           | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| A     | `admin`           | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| A     | `status`          | `<LB_FLOATING_IP>`                 | Proxied  | Auto |
| CNAME | `cdn` / R2 public | `<bucket>.r2.dev` or custom domain | Proxied  | Auto |
| TXT   | SPF / DMARC       | Email provider                     | DNS only | Auto |

Repo checklist: `infrastructure/cloudflare/dns.csv`.

## SSL / TLS

| Setting                    | Value                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Encryption mode            | **Full (strict)**                                                                   |
| Minimum TLS                | **1.3** (edge); origin supports 1.2+                                                |
| Edge certificates          | Universal SSL (or Advanced Certificate Manager)                                     |
| Origin certificates        | Cloudflare Origin CA installed on nginx (auto-renew via CF dashboard / API refresh) |
| HSTS                       | Enable; max-age ≥ 6 months; includeSubDomains; preload when ready                   |
| Always Use HTTPS           | On                                                                                  |
| Automatic HTTPS Rewrites   | On                                                                                  |
| Authenticated Origin Pulls | Recommended (optional launch+)                                                      |

## WAF & DDoS

| Control         | Action                                                         |
| --------------- | -------------------------------------------------------------- |
| Managed ruleset | Cloudflare Free/Pro managed WAF                                |
| Rate limiting   | `/api/v1/auth/*` stricter; general API limits                  |
| Bot Fight Mode  | On (tune false positives)                                      |
| DDoS            | Automatic L3/L4/L7                                             |
| Admin hostname  | Cloudflare Access (SSO / OTP) in front of `admin.dripplex.com` |

Example rules: `infrastructure/cloudflare/waf-rules.json`.

## CDN / cache

| Path              | Cache                      |
| ----------------- | -------------------------- |
| `/_next/static/*` | Cache Everything, long TTL |
| HTML documents    | Bypass / respect origin    |
| R2 media          | Cache via custom domain    |

## R2 object storage

| Bucket             | Public?        | Use                            |
| ------------------ | -------------- | ------------------------------ |
| `dripplex-uploads` | Via CDN domain | Product images, merchant logos |
| `dripplex-cms`     | Via CDN domain | CMS assets                     |
| `dripplex-private` | No             | User documents (presigned GET) |

Env placeholders (app wiring in later phases — **no app code in D1**):

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_UPLOADS=dripplex-uploads
R2_PUBLIC_BASE_URL=https://cdn.dripplex.com
```

## Page Rules / Redirects

- `dripplex.com/*` → `https://www.dripplex.com/$1` (301)
- Force HTTPS already via Always Use HTTPS

## Terraform variables

See `infrastructure/cloudflare/terraform/variables.tf` for IaC-ready zone settings (apply in D2 when credentials available).
