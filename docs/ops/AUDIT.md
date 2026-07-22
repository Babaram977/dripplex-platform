# Audit verification (Program D3)

Backend Core already records audit events via `AuditService`. D3 verifies operational visibility — no schema/API changes.

## Event classes to verify in Loki / DB

| Class              | Examples                        | Where                   |
| ------------------ | ------------------------------- | ----------------------- |
| Security           | Failed logins, lockouts         | Auth logs + audit table |
| Authentication     | Login / logout / refresh        | `auth/*` logs, audit    |
| Permission changes | RBAC denials (403)              | API logs                |
| Financial          | Wallet credit/debit, payments   | Wallet/payment audit    |
| Merchant actions   | KYC, business updates           | Merchant audit          |
| Admin actions      | CMS, fraud review, wallet admin | Admin audit             |

## Verification checklist

- [ ] Loki query `{service="backend"} |= "audit"` returns events in staging
- [ ] Wallet admin mutation creates audit row (staging smoke)
- [ ] Failed login does not leak PII in logs (redaction in pino)
- [ ] Authorization headers redacted by Promtail
- [ ] Sentry does not receive password/OTP fields (`sendDefaultPii: false`)

## Retention

| Store    | Retention                                              |
| -------- | ------------------------------------------------------ |
| Loki     | 30 days (config)                                       |
| Audit DB | per Backend Core policy (retain ≥ 90 days recommended) |
| Sentry   | per plan                                               |
