# D1 — Object storage (Cloudflare R2)

## Buckets

| Bucket             | Access                        | Contents                       |
| ------------------ | ----------------------------- | ------------------------------ |
| `dripplex-uploads` | Public via `cdn.dripplex.com` | Product images, merchant logos |
| `dripplex-cms`     | Public via CDN                | CMS media                      |
| `dripplex-private` | Private                       | User documents KYC             |

## CDN

- Attach custom domain `cdn.dripplex.com` to R2.
- Cache long-TTL immutable object keys (`…/{uuid}-{hash}.webp`).
- No egress fees (R2) — preferred for Nigeria growth economics.

## Lifecycle

| Rule                    | Action                         |
| ----------------------- | ------------------------------ |
| Incomplete multipart    | Abort after 7 days             |
| Noncurrent private docs | Review retention policy (NDPR) |

## IAM

- Separate R2 API tokens: `upload-writer`, `backup-reader` (none), least privilege.
- Never embed tokens in frontend; use backend presigned URLs (when app phase enables uploads).

## Replication / backup

- R2 has high durability; additionally sync critical private objects weekly to Backblaze B2 for independence from Cloudflare account lock-out.

Env inventory: `infrastructure/secrets/inventory.md`.
