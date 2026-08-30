# Google Play — store listing (draft)

Use this draft when creating the Play Console listing. Replace placeholders before public release.

## Developer account — legal entity

**Founder decision 2026-08-30: DrippleX publishes under an *organization* Play
developer account**, in the name of AFNAN HOMES LTD — not an individual account.
That is what makes the D-U-N-S below required rather than optional.

These are the values the Play Console asks for on an organization account. They
must match the Dun & Bradstreet record exactly, character for character — Google
verifies against it.

| Field                  | Value                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Legal entity           | **AFNAN HOMES LTD** — not "DrippleX", which is its trading name             |
| RC number              | RC 9387949                                                                   |
| Entity type            | Private Limited Liability Company                                            |
| **D-U-N-S number**     | **352296291**                                                                |
| Registered address     | No. 58–60 UDB Road, By Tarauni Primary, Nasarawa, Kano, Kano State, Nigeria |
| Telephone of record    | +234 803 973 9780                                                            |

The D-U-N-S was issued by Dun & Bradstreet on **2026-08-28 10:09 UTC** (case
10859055, tracking 10797660, request key BVD5Z3B3P9) and verified through the
national registry. D&B says the record becomes visible **2–3 business working
days** after resolution — so from **2026-09-02**. Do not start verification
before then: a lookup against a record that has not propagated returns nothing,
which stalls the application rather than queuing it.

⚠️ **One consequence to check at enrolment.** Google publishes a verified
developer's contact details on the store listing, which for an organization
account means the legal name and, depending on the current policy, the
registered address and a contact email are shown to anyone viewing the app on
Play. If that address being public is not wanted, the time to raise it is before
verification, not after. This paragraph is a prompt to check the Console's
current requirements — it is not authority on them, and no Play policy text is
quoted anywhere in this repo.

The internal-testing track in `docs/mobile/BETA-DISTRIBUTION.md` runs on whatever
account is already in use and is **not** blocked by any of this.

## App details

| Field                            | Value                                                                   |
| -------------------------------- | ----------------------------------------------------------------------- |
| **Title**                        | Dripplex                                                                |
| **Short description** (80 chars) | Nigeria’s Super Platform — shop, food, rides, wallet. life, Simplified. |
| **Full description**             | See below                                                               |
| **Category**                     | Shopping                                                                |
| **Tags / keywords**              | marketplace, food delivery, Nigeria, wallet, rides, parcel, pharmacy    |
| **Privacy Policy URL**           | `https://www.dripplex.com/privacy`                                      |
| **Account deletion URL**         | `https://www.dripplex.com/account-deletion`                             |
| **Support URL**                  | `https://www.dripplex.com/contact`                                      |
| **Email**                        | support@dripplex.com                                                    |

Listing URLs use **www**, because the bare apex 308-redirects to it
(`apps/customer-web/next.config.ts`). The apex forms still resolve — Google
follows the redirect — but pointing the Console straight at the destination
avoids a needless hop and keeps the value stable if the redirect is ever
tightened.

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

| Asset                   | Spec               | Status                                                               |
| ----------------------- | ------------------ | -------------------------------------------------------------------- |
| App icon                | 512×512 PNG        | ✅ `resources/play-store-icon-512.png`                               |
| Feature graphic         | 1024×500           | ✅ `resources/play-feature-graphic-1024x500.png`                     |
| Phone screenshots       | 2–8, min 1080×1920 | ✅ `resources/play-screenshots/` — 5 captured, **2 worth uploading** |
| 7-inch / 10-inch tablet | Optional           | ⏳                                                                   |

The icon and the feature graphic are generated from `resources/dripplex-mark.svg`,
not drawn by hand. Regenerate with `node scripts/generate-icons.mjs` and check
with `node scripts/verify-icons.mjs` from `apps/customer-mobile`. A dirty git
tree after a regenerate means someone edited a PNG directly.

Screenshots are different: they photograph live production data through the
real app (`node scripts/capture-screenshots.mjs`), so they are **not** byte
reproducible and CI does not check them. `resources/play-screenshots/README.md`
grades each one and says why. In short: home and marketplace are listing
quality; wallet (₦0.00, no transactions) and orders (a single order on an empty
screen) are thin because the data is thin, and the fix is real usage, not
seeded rows.

The feature graphic's type no longer depends on the machine: Poppins and Inter
are vendored in `resources/fonts/` and the generator points fontconfig there, so
it renders identically everywhere. (This page previously said to install them —
that stopped being true once they were pinned.) The verifier still checks the
text actually drew, because a missing face fails silently rather than loudly.

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
