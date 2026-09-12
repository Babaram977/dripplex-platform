# Apple App Store — metadata (draft)

**Status: pre-enrolment.** No Apple Developer Program account, no App Store Connect
record, no signed archive, no upload. Every value below is either **verified from
the repository** or **pending an Apple-account action** — the two are marked
apart deliberately, because this page is what someone copies into App Store
Connect and an invented value here becomes a misstatement to Apple.

Corrected 2026-09-07 against the iOS release preflight. What changed and why is
recorded inline where it matters.

## Developer account — legal entity

Apple Developer Program **organization** enrolment verifies the applicant against
the Dun & Bradstreet record. The legal name below is what goes in the
application; _DrippleX_ is the app name, not the applicant.

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

The name matches: the D-U-N-S was issued to AFNAN HOMES LTD, the same entity that
`docs/legal/DPX-LEGAL-001-TERMS-OF-USE.md` §1 names as the contracting party. A
mismatch here is the usual cause of a stalled enrolment, so it was worth checking.

Enrolment itself is **parked** — founder decision 2026-08-28. `docs/mobile/IOS.md`
lists the blockers the D-U-N-S does not remove (no macOS build host,
`aps-environment` still `development`, no signing team, no distribution identity).

## App Information

| Field                   | Value                                | Basis                                                                 |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| **Name**                | **DrippleX**                         | ✅ verified — `Info.plist` `CFBundleDisplayName`                      |
| **Subtitle** (30 chars) | life, Simplified                     | draft                                                                 |
| **Bundle ID**           | `com.dripplex.customer`              | ✅ verified — `project.pbxproj` `PRODUCT_BUNDLE_IDENTIFIER`; see note |
| **SKU**                 | `dripplex-customer-ios`              | draft — free text, App Store Connect only                             |
| **Marketing version**   | `1.0.0`                              | ✅ verified — `MARKETING_VERSION`                                     |
| **Build**               | `1000100`                            | ✅ verified — `CURRENT_PROJECT_VERSION`                               |
| **Primary category**    | Shopping                             | ⚠️ **pending founder confirmation** — see note                        |
| **Secondary**           | Food & Drink                         | ⚠️ pending founder confirmation                                       |
| **Content rights**      | Does not contain third-party content | draft                                                                 |
| **Age rating**          | ⚠️ **OPEN — do not enter 4+**        | 🚨 see "Age rating and betting" below                                 |

**On the name.** This page previously said "Dripplex". The founder decision of
2026-08-29 is **DrippleX** — the capital X is the brand — and `Info.plist`
already carries it correctly. The doc was the only place still flat.

**On the bundle ID.** iOS keeps `com.dripplex.customer`; Android moved to
`com.dripplex.app` after the original Play package name was spent by a deleted
app (`docs/store/GOOGLE-PLAY.md`). The two stores have independent namespaces
and `com.dripplex.customer` was never registered with Apple, so the divergence
is harmless — but do not "fix" it to match Android, and do not assume the
Android rename applies here.

**On the category.** Google Play was set to **Travel & Local** (founder-selected
2026-09-06). This page still says Shopping. Different stores may legitimately
carry different categories, so this is recorded as a decision to confirm rather
than a discrepancy to correct.

## Age rating and betting — OPEN, needs a founder and legal decision

This page previously stated **4+**. That is very unlikely to be correct and it
must not be entered as-is.

**The app funds third-party betting accounts.** `utilitiesScreen.tsx:60` renders
a customer-facing **Betting — "Fund your account"** tile alongside airtime, data,
electricity, cable TV and exam pins; the SDK calls
`GET /customer/utilities/betting/providers` and the purchase flow verifies the
betting account before funding it. This is live, shipped customer functionality,
not a plan.

Apple treats real-money gambling and gambling-adjacent functionality strictly:
it drives the age rating, and depending on how "funding a licensed operator's
wallet" is classified it can also bring geographic-restriction and licensing
requirements. Nothing in this repository establishes which classification
applies.

**Required before the rating questionnaire is answered:**

1. A founder/legal determination of whether funding a licensed Nigerian betting
   operator constitutes gambling functionality under Apple's guidelines.
2. The age rating that follows from it — entered from that determination, never
   from this page.

**The same question applies to Google Play**, whose content-rating note in
`docs/store/GOOGLE-PLAY.md` also anticipates a low-maturity outcome on the
reasoning "shopping, no user-generated public content". That is recorded here as
a cross-platform observation only. **No Android action is proposed or taken** —
the Play release is in review and must not be disturbed.

## URLs

| Field          | URL                                | Basis                        |
| -------------- | ---------------------------------- | ---------------------------- |
| Privacy Policy | `https://www.dripplex.com/privacy` | ✅ probed 2026-09-07 — `200` |
| Support        | `https://www.dripplex.com/contact` | ✅ probed 2026-09-07 — `200` |
| Marketing      | `https://www.dripplex.com`         | ✅ probed 2026-09-07 — `200` |

**Use the `www` form.** This page previously listed the apex `dripplex.com`,
which answers **308** and redirects to `www`. Both reach the page, but store
metadata should carry the URL that actually serves it rather than one that
bounces.

The privacy policy carries an outstanding gap of its own: the registered office
address is still a placeholder in the page source (`DPX-LEGAL-001` §1/§22), and
Nigerian legal review is not complete.

## Description (template)

Same body as `docs/store/GOOGLE-PLAY.md` full description.

**Promotional text** (170 chars):
`Shop, eat, ride, and pay across Nigeria. One Super Platform. life, Simplified.`

**Keywords** (100 chars):
`nigeria,marketplace,food,delivery,wallet,rides,shopping,parcel,pharmacy`

> The keyword list contains `parcel` and `pharmacy`. Neither is a shipped
> feature — the Play full description was rewritten in #349 for exactly this
> reason, having advertised parcels and home services that do not exist. Trim
> both before submission unless they have shipped by then.

## Screenshots

| Device         | Size      | Count    | Status                               |
| -------------- | --------- | -------- | ------------------------------------ |
| iPhone 6.7"    | 1290×2796 | 3–10     | ⚙️ capture command ready — see below |
| iPhone 6.5"    | 1284×2778 | 3–10     | ⚙️ capture command ready — see below |
| iPad Pro 12.9" | 2048×2732 | Optional | ❌ none — see the iPad note          |

None exist. They cannot be captured until a build installs on hardware, so this
is downstream of enrolment and a macOS host.

**iPad.** `TARGETED_DEVICE_FAMILY = "1,2"` in `project.pbxproj` means the app
declares iPad support, so Apple will review it on iPad and will expect iPad
screenshots. Dropping to `"1"` is a one-line project change that removes an
entire review surface. Founder decision, not yet taken; tracked in the iOS
preflight as D6.

### Capturing them

`scripts/capture-screenshots.mjs` now takes a device profile. It signs in as a
real customer against the real backend and photographs whatever that account
actually has — nothing is mocked, seeded or dressed up, which is both why the
shots are honest and why they need live credentials:

```
DPX_BASE=https://app.dripplex.com \
DPX_CUSTOMER_EMAIL=... DPX_CUSTOMER_PASSWORD=... \
DPX_DEVICE=ios-6.7 node scripts/capture-screenshots.mjs

DPX_BASE=https://app.dripplex.com \
DPX_CUSTOMER_EMAIL=... DPX_CUSTOMER_PASSWORD=... \
DPX_DEVICE=ios-6.5 node scripts/capture-screenshots.mjs
```

Output lands in `resources/ios-screenshots/6.7` and `.../6.5` at exactly
1290×2796 and 1284×2778. Apple rejects anything that is not the exact size.

**This has not been run.** It needs a real customer account's credentials, which
belong to the founder and should not be pasted into a chat or a CI log. Run it
from a machine that already has them.

## App Preview

Optional 15–30s video — deferred.

## Privacy nutrition labels

**Source of truth: `apps/customer-mobile/ios/App/App/PrivacyInfo.xcprivacy`.**
Fill the App Store Connect questionnaire from the manifest, not from this table,
and keep the two in step — Apple requires the declaration to match what the app
collects.

The manifest declares **eleven** collected types, all **linked to the user**,
all **not used for tracking**, all for **App Functionality**. `NSPrivacyTracking`
is `false` and `NSPrivacyTrackingDomains` is empty.

| #   | Manifest type     | What it is in DrippleX                       |
| --- | ----------------- | -------------------------------------------- |
| 1   | `Name`            | account holder                               |
| 2   | `EmailAddress`    | account                                      |
| 3   | `PhoneNumber`     | primary identity                             |
| 4   | `PhysicalAddress` | delivery addresses                           |
| 5   | `PreciseLocation` | rides, delivery, nearby merchants            |
| 6   | `PhotosorVideos`  | profile, store listings, KYC documents       |
| 7   | `AudioData`       | live in-app calls — never recorded or stored |
| 8   | `OtherDataTypes`  | government ID, date of birth                 |
| 9   | `PaymentInfo`     | bank account for payouts                     |
| 10  | `PurchaseHistory` | orders                                       |
| 11  | `DeviceID`        | push token                                   |

Accessed-API reasons declared: `NSPrivacyAccessedAPICategoryUserDefaults`.

**Crash and performance data are deliberately NOT declared.** This page
previously listed "Diagnostics (crashes) — Analytics" and said it matched the
manifest. It did not. Sentry's hook returns early unless `SENTRY_DSN` is set,
that variable is absent from the production backend, and the super-app has no
Sentry at all — so nothing collects crash data today. The manifest carries a
comment saying `NSPrivacyCollectedDataTypeCrashData` and `...PerformanceData`
must come back if a DSN is ever set. `docs/store/GOOGLE-PLAY.md` reaches the
same conclusion for Play; the two declarations change together or not at all.

**No tracking.** No advertising, attribution or analytics SDK is in the
dependency tree.

## Review notes

The block below is a **template with a required founder action**, not a finished
note. It replaces an earlier version that told Apple the app needed no camera or
location at the native layer — which was false, and is exactly the kind of
discrepancy between a review note and the binary that draws a rejection.

```
DrippleX is a Capacitor shell that loads https://app.dripplex.com — our
production web application. One binary serves customers, merchants, riders and
drivers; the reviewer will see the customer experience.

DEMO ACCOUNT — REQUIRED
  Email:    [FOUNDER/APPLE ACTION — provide a pre-verified account]
  Password: [FOUNDER/APPLE ACTION — provide]

The app has NO guest mode. The first screen offers only Get Started, Sign In
and Partner, so a reviewer cannot see any functionality without credentials.
Sign-in accepts email + password (POST /auth/login/customer) and does not
require an OTP once the account is verified, so a pre-verified account is
sufficient. Registration alone is NOT, because it sends an OTP to a Nigerian
number.

REGIONAL SCOPE
DrippleX operates in Nigeria. Pricing is in naira, payouts go to Nigerian bank
accounts, merchants and mobile networks are Nigerian, and the emergency number
is 112. Reviewing from outside Nigeria will show an app whose commerce, rides
and bill payments have no local counterpart.

DEVICE CAPABILITIES THE APP USES, and why
  Location (When In Use) — set a delivery address, find nearby merchants, and
    match a customer with a nearby rider or driver.
  Camera                 — photograph an ID document and take a verification
                           selfie during account verification (KYC).
  Photo Library          — choose photos for a profile, a store listing, or a
                           verification document.
  Microphone             — speak to a driver or rider about a trip or delivery
                           in progress, over an in-app call. Audio is relayed
                           live and is never recorded or stored.
Each has a usage description in Info.plist and is requested only at the point of
use. There is no background location: UIBackgroundModes declares
remote-notification only.

ACCOUNT DELETION
A signed-in customer can delete their own account in-app from Settings, which
calls DELETE /auth/me. No support contact or web form is required.

ENCRYPTION
Standard HTTPS only. ITSAppUsesNonExemptEncryption = false.

NETWORK
The app requires a network connection. Push notifications are optional.
```

**Before submitting**, replace both credential placeholders with the same
pre-verified demo account prepared for Google Play App access, and re-read the
capability list against `Info.plist` in case it has changed.

## What is verified, and what needs App Store Connect

**Verified from the repository (2026-09-07):** app name, bundle ID, marketing
version, build number, the four permission usage strings, the eleven privacy
manifest types, tracking = false, `ITSAppUsesNonExemptEncryption = false`, the
in-app account deletion path (`DELETE /auth/me`, live and returning 401
unauthenticated), the app icon at 1024×1024 alpha-free, the splash assets, and
the three store URLs.

**Cannot be established from this repository — requires App Store Connect or the
Apple Developer account:** whether enrolment has completed, the Team ID, whether
an app record exists, whether `com.dripplex.customer` is free on Apple, which
certificates and profiles exist, and whether any build was ever uploaded. Nothing
on this page should be read as an answer to those.

## TestFlight

See `docs/mobile/BETA-DISTRIBUTION.md`. Note that the first external build of a
version goes through App Review, and external testing needs its own test
information — so TestFlight is not a way to skip review, only a way to reach
testers before public release.
