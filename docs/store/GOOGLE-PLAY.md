# Google Play — store listing (draft)

Use this draft when creating the Play Console listing. Replace placeholders before public release.

## Developer account — legal entity

**Founder decision 2026-08-30: DrippleX publishes under an _organization_ Play
developer account**, in the name of AFNAN HOMES LTD — not an individual account.
That is what makes the D-U-N-S below required rather than optional.

These are the values the Play Console asks for on an organization account. They
must match the Dun & Bradstreet record exactly, character for character — Google
verifies against it.

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Legal entity        | **AFNAN HOMES LTD** — not "DrippleX", which is its trading name             |
| RC number           | RC 9387949                                                                  |
| Entity type         | Private Limited Liability Company                                           |
| **D-U-N-S number**  | **352296291**                                                               |
| Registered address  | No. 58–60 UDB Road, By Tarauni Primary, Nasarawa, Kano, Kano State, Nigeria |
| Telephone of record | +234 803 973 9780                                                           |

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

### D-U-N-S propagation window has passed

The record resolved 2026-08-28 and D&B quoted 2–3 business days to become visible, so
**2026-09-02 is the earliest date a Google lookup can succeed**. That date has arrived.
Starting verification earlier would have stalled the application rather than queuing it.

### ⚠️ `com.dripplex.customer` is already claimed — settle this before creating anything

**A new organization account cannot publish the existing app.** On Play an
`applicationId` is globally unique and permanently bound to the account that first
published it, and `com.dripplex.customer` has already been published: `versionCode`
`1000100` reached internal testing on 2026-08-27 (recorded in
`scripts/mobile/build-android.sh`). A brand-new account is a different account.

So the signed AAB built for submission — `versionCode 29805597`, run 33606040775 — can
only be uploaded from **the account that already holds the app**, unless one of the
routes below is taken first.

**Check this before creating a second account:** whether the existing developer account
can simply be **converted** to an organization account. If Google allows it, that is
strictly better than everything below — the package name, the Play App Signing key, the
internal testing track and the built AAB all survive untouched, with no transfer and no
rebuild. Look under the account's identity/verification settings in the Console.

> Not verified here. Play's account-identity policy is not quoted anywhere in this repo,
> it changes, and no agent session can read the Console. Treat this as the first thing to
> check, not as an assurance that it is available.

**If conversion is not available**, order matters:

1. Create the organization account with the identity values above.
2. **Complete verification first.** Do not transfer into an unverified account.
3. Transfer `com.dripplex.customer` to it via Google's app-transfer process.
4. Only then upload `versionCode 29805597`.

**Do not create a second app under a new `applicationId`** unless transfer is genuinely
closed off. It costs the internal testing track, the Play App Signing key and any install
base, it starts a fresh listing with no history, and it invalidates the current AAB —
`applicationId` is compiled in, so it needs a code change and a rebuild.

### Recorded gap — which account holds the app today

**Nothing in this repository records which Play account currently owns
`com.dripplex.customer`.** That detail becomes load-bearing during a transfer or a
conversion, and it currently lives only in the founder's memory. Write it here when
known.

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

The seven Play categories below cover the same collection the Apple manifest
describes in its eleven types. They are **not** row-for-row: Play splits
government ID and date of birth out of "Other data" and has an App activity
category Apple has no equivalent for, so match on substance, not on count.

This table used to claim ten types and omit **Audio** entirely — the app
declares `RECORD_AUDIO` for in-app voice calls, so a Data Safety form filled in
from the old table under-declared a dangerous permission:

| Play category       | Type                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| Personal info       | Name, Email address, Phone number, Address, Government ID, Other (date of birth) |
| Location            | Precise location                                                                 |
| Photos and videos   | Photos — profile, store listings, KYC documents                                  |
| Audio               | Voice or sound recordings — live in-app calls only, never recorded or stored     |
| Financial info      | Purchase history, Other (bank account for merchant payouts)                      |
| App activity        | Other actions — order and in-app activity                                        |
| Device or other IDs | Device ID (push token)                                                           |

**On Audio.** Nothing is recorded and nothing is stored. The microphone track
exists only while a call is joined, LiveKit relays it, and the backend holds who
called whom, when and for how long — never the audio. Declare it as collected,
not shared, in-app functionality. It is declared rather than treated as
transient because the honest answer survives a reviewer's second look and
"transient, therefore not collected" does not.

**Do not declare crash logs or performance data.** An earlier version of this
page said to, and it was wrong: Sentry's hook returns early unless `SENTRY_DSN`
is set, that variable is absent from the production backend, and the super-app
has no Sentry at all. The Apple manifest documents the same reasoning. If a DSN
is ever set, both declarations change together.

**No tracking.** No advertising, attribution or analytics SDK is in the
dependency tree.

**Service providers, not sharing.** Payments, SMS, email, push, object storage,
geocoding and call relay all run through processors acting on our instructions
under contract — Paystack, Flutterwave and Peyflex, Termii, Resend, Firebase,
Cloudflare R2, Google Maps and LiveKit. Play distinguishes that from sharing;
declare them as service providers. `DPX-MOBILE-003` §3 carries the full list.

Card numbers are never collected — Paystack and Flutterwave hold them, and the
schema has no `cardNumber`/`cvv`/`pan`. "Payment info" above is the merchant
bank account used for payouts.

## Release

Upload AAB from `mobile-build` workflow artifact → Production / Closed / Internal track per `BETA-DISTRIBUTION.md`.
