# Merchant & Rider mobile packaging (planned)

D4 delivers a **full Capacitor scaffold for Customer** only. Merchant and Rider portals remain responsive web apps with Docker deployment (D2).

## Recommended approach (post-D4)

Duplicate `apps/customer-mobile` pattern:

| App      | Directory              | Package / Bundle        | Remote URL                      |
| -------- | ---------------------- | ----------------------- | ------------------------------- |
| Merchant | `apps/merchant-mobile` | `com.dripplex.merchant` | `https://merchant.dripplex.com` |
| Rider    | `apps/rider-mobile`    | `com.dripplex.rider`    | `https://rider.dripplex.com`    |
| Admin    | Web-only (tablet)      | —                       | `https://admin.dripplex.com`    |

## Beta testing today

- **Merchant / Rider / Admin**: mobile browser or “Add to Home Screen” (no PWA manifest in D4)
- **Customer**: Capacitor shell + PWA

## Rider-specific note

If background GPS is required for production rider tracking, add `@capacitor/geolocation` in a rider shell and update `PERMISSIONS.md` — requires product + legal review for background location.

## Quality gates (when scaffolded)

Same as customer: signing, icons, push, deep links, Play/App Store listings per portal.
