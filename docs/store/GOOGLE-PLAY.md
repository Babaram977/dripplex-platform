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

| Asset                   | Spec               | Status                  |
| ----------------------- | ------------------ | ----------------------- |
| App icon                | 512×512 PNG        | ⏳ Placeholder          |
| Feature graphic         | 1024×500           | ⏳ Not created          |
| Phone screenshots       | 2–8, min 1080×1920 | ⏳ Capture from staging |
| 7-inch / 10-inch tablet | Optional           | ⏳                      |

## Content rating

Complete IARC questionnaire — expect **Everyone** / low maturity (shopping, no user-generated public content in shell).

## Data safety

Declare: account info, purchase history, device identifiers (push token), crash logs — align with Privacy Policy and backend data map.

## Release

Upload AAB from `mobile-build` workflow artifact → Production / Closed / Internal track per `BETA-DISTRIBUTION.md`.
