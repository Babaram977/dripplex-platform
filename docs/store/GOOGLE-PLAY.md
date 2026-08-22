# Google Play — store listing (draft)

Use this draft when creating the Play Console listing. Replace placeholders before public release.

## App details

| Field                            | Value                                                                   |
| -------------------------------- | ----------------------------------------------------------------------- |
| **Title**                        | Dripplex                                                                |
| **Short description** (80 chars) | Nigeria’s Super Platform — shop, food, rides, wallet. life, Simplified. |
| **Full description**             | See below                                                               |
| **Category**                     | Shopping                                                                |
| **Tags / keywords**              | marketplace, food delivery, Nigeria, wallet, rides, parcel, pharmacy    |
| **Privacy Policy URL**           | `https://dripplex.com/privacy`                                          |
| **Account deletion URL**         | `https://dripplex.com/account-deletion`                                 |
| **Support URL**                  | `https://dripplex.com/contact`                                          |
| **Email**                        | support@dripplex.com                                                    |

### Full description (template)

```
Dripplex is Nigeria’s Super Platform for everyday life — marketplace, food delivery, parcels, rides, pharmacy, home services, and wallet in one app.

life, Simplified.

• Shop local merchants and essentials
• Order food with live delivery tracking
• Send parcels and book rides
• Pay and manage money with Dripplex Wallet
• Track orders and notifications in one place

Built for Nigeria. Secure sign-in, device-aware sessions, and a fast mobile experience.

Questions? support@dripplex.com
```

## Graphics (required)

| Asset                   | Spec               | Status                                           |
| ----------------------- | ------------------ | ------------------------------------------------ |
| App icon                | 512×512 PNG        | ✅ `resources/play-store-icon-512.png`           |
| Feature graphic         | 1024×500           | ✅ `resources/play-feature-graphic-1024x500.png` |
| Phone screenshots       | 2–8, min 1080×1920 | ⏳ Capture from staging                          |
| 7-inch / 10-inch tablet | Optional           | ⏳                                               |

Both finished assets are generated from `resources/dripplex-mark.svg`, not drawn
by hand. Regenerate with `node scripts/generate-icons.mjs` and check with
`node scripts/verify-icons.mjs` from `apps/customer-mobile`. A dirty git tree
after a regenerate means someone edited a PNG directly.

The feature graphic needs **Poppins and Inter installed** on the machine that
runs the generator — without them the text silently does not draw. The verifier
fails with a message naming the missing font rather than letting a wordless
graphic reach the listing.

## Content rating

Complete IARC questionnaire — expect **Everyone** / low maturity (shopping, no user-generated public content in shell).

## Data safety

**`DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md` is the source of truth.** Declare
from it, not from this page, and keep it in step with
`ios/App/App/PrivacyInfo.xcprivacy` — Play requires the declaration to match what
the app actually collects.

Ten types, matching the Apple manifest one for one:

| Play category      | Type                                                          |
| ------------------ | ------------------------------------------------------------- |
| Personal info      | Name, Email address, Phone number, Address                    |
| Location           | Precise location                                              |
| Photos and videos  | Photos (receipts, KYC documents)                              |
| Financial info     | Payment info (merchant payout bank account), Purchase history |
| Device or other ID | Device ID (push token)                                        |
| App info           | Other data types                                              |

**Do not declare crash logs or performance data.** An earlier version of this
page said to, and it was wrong: Sentry's hook returns early unless `SENTRY_DSN`
is set, that variable is absent from the production backend, and the super-app
has no Sentry at all. The Apple manifest documents the same reasoning. If a DSN
is ever set, both declarations change together.

**No tracking.** No advertising, attribution or analytics SDK is in the
dependency tree.

Card numbers are never collected — Paystack and Flutterwave hold them, and the
schema has no `cardNumber`/`cvv`/`pan`. "Payment info" above is the merchant
bank account used for payouts.

## Release

Upload AAB from `mobile-build` workflow artifact → Production / Closed / Internal track per `BETA-DISTRIBUTION.md`.
