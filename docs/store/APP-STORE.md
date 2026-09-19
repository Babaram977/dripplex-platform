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

| Field                   | Value                                | Basis                                                                            |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| **Name**                | **DrippleX**                         | ✅ verified — `Info.plist` `CFBundleDisplayName`                                 |
| **Subtitle** (30 chars) | life, Simplified                     | draft                                                                            |
| **Bundle ID**           | `com.dripplex.customer`              | ✅ verified — `project.pbxproj`, and registered with Apple (see note)            |
| **SKU**                 | `dripplex-customer-ios`              | draft — free text, App Store Connect only                                        |
| **Marketing version**   | `1.0.0`                              | ✅ verified — `MARKETING_VERSION`                                                |
| **Build**               | `1000101`                            | ✅ verified — `CURRENT_PROJECT_VERSION`; `1000100` is spent, uploaded 2026-09-17 |
| **Primary category**    | Travel                               | ✅ founder ruling, 2026-09-18                                                    |
| **Secondary**           | Utilities                            | ✅ founder ruling, 2026-09-18                                                    |
| **Content rights**      | Does not contain third-party content | draft                                                                            |
| **Age rating**          | **16+**                              | ✅ founder ruling, 2026-09-18 — see "Age rating and betting" below               |

**On the categories.** Travel primary, Utilities secondary — founder ruling,
2026-09-18. Both are **App Store Connect fields, not repository ones**: there is
no `LSApplicationCategoryType` anywhere in this repo, and on iOS that key does
not drive the store category anyway (it is a macOS/Catalyst setting). So there
is nothing to change in the Xcode project for this, and nothing to re-archive —
it is entered once in App Store Connect under App Information. "Utilities" is
Apple's spelling of the category; the ruling said "utility".

**On the name.** This page previously said "Dripplex". The founder decision of
2026-08-29 is **DrippleX** — the capital X is the brand — and `Info.plist`
already carries it correctly. The doc was the only place still flat.

**On the bundle ID.** iOS keeps `com.dripplex.customer`; Android moved to
`com.dripplex.app` after the original Play package name was spent by a deleted
app (`docs/store/GOOGLE-PLAY.md`). The two stores have independent namespaces, so
the divergence is harmless — but do not "fix" it to match Android, and do not
assume the Android rename applies here. **Reaffirmed by the founder 2026-09-17**
after exactly that was proposed.

This paragraph used to end "and `com.dripplex.customer` was never registered with
Apple". That is no longer true and was the specific sentence that made the
identifier look free to change: the App ID **is** registered, the App Store
Connect record exists as _DrippleX · iOS 1.0 Prepare for Submission_, and build
1.0.0 (1000100) has been uploaded against it. A Play package name being burned
says nothing about Apple's namespace — the two are independent, which is the
whole reason the divergence is fine.

**On the category.** Google Play was set to **Travel & Local** (founder-selected
2026-09-06). This page still says Shopping. Different stores may legitimately
carry different categories, so this is recorded as a decision to confirm rather
than a discrepancy to correct.

## Age rating and betting — RULED 16+, 2026-09-18

**Founder ruling:** **16+**, on the basis that DrippleX does not sell bets. The
customer funds an account they already hold with a licensed operator; that
operator holds the licence and carries the regulatory obligation.

This page previously said 4+, which was wrong and is superseded.

### What the app actually does, for whoever answers the questionnaire

`utilitiesScreen.tsx:60` renders a customer-facing **Betting — "Fund your
account"** tile alongside airtime, data, electricity, cable TV and exam pins. The
flow calls `GET /customer/utilities/betting/providers`, verifies the named
account with the operator, and funds it. No odds are shown, no bet is placed, no
wager is settled and no winnings are paid inside DrippleX. The money moves from
the customer's DrippleX wallet to their own account at a third party.

That is the factual basis of the ruling, recorded here so the questionnaire is
answered from what the code does rather than from a summary of it.

### What is still worth checking before submitting, and why it is not a rejection of the ruling

The ruling settles what DrippleX's position is. What it cannot settle is how
Apple's own questionnaire classifies it, because that is Apple's judgement and
not ours:

1. **Apple's age-rating questionnaire may force a higher rating than 16+.** The
   gambling questions are answered in App Store Connect, and the rating is
   computed from the answers rather than typed in. If the questionnaire's
   gambling question is answered yes, the tool may set 18+ regardless of this
   ruling. Answer it honestly and take the rating it computes — do not work
   backwards from 16+.
2. **App Review Guideline 5.3 (gaming, gambling and lotteries)** attaches
   obligations to apps that _facilitate_ real-money gambling, which can include
   geographic restriction and evidence of the operator's licensing. Whether
   funding a licensed operator's wallet counts as facilitating is Apple's call,
   and it is the likeliest single cause of a review question on this
   submission.
3. **Be ready to answer it in review notes** rather than be surprised by it. The
   argument is the one above: no odds, no wager, no settlement, no payout — a
   wallet transfer to a licensed third party the customer already holds an
   account with.

None of this changes what to enter. It is here so that if review pushes back,
the answer is already written down and nobody has to reconstruct it.

**The same question applies to Google Play**, whose content-rating note in
`docs/store/GOOGLE-PLAY.md` anticipates a low-maturity outcome on the reasoning
"shopping, no user-generated public content". That reasoning does not survive
this ruling either, and it is recorded here as a cross-platform observation
only. **No Android action is proposed or taken** — the Play release is live and
must not be disturbed on the strength of a note in an iOS document.

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

`apps/customer-mobile/scripts/capture-screenshots.mjs` takes a device profile.
(This page previously gave the path as `scripts/capture-screenshots.mjs`, which
does not exist — it is inside the `customer-mobile` package, and the wrong path
is the first thing anyone following these instructions hits.) It signs in as a
real customer against the real backend and photographs whatever that account
actually has — nothing is mocked, seeded or dressed up, which is both why the
shots are honest and why they need live credentials:

```
cd apps/customer-mobile
pnpm install                      # playwright-core is a devDependency here
npx playwright install chromium   # once per machine — the browser itself

DPX_BASE=https://app.dripplex.com \
DPX_CUSTOMER_EMAIL=... DPX_CUSTOMER_PASSWORD=... \
DPX_DEVICE=ios-6.7 pnpm screenshots

DPX_BASE=https://app.dripplex.com \
DPX_CUSTOMER_EMAIL=... DPX_CUSTOMER_PASSWORD=... \
DPX_DEVICE=ios-6.5 pnpm screenshots
```

`CHROMIUM_PATH=/path/to/chrome` overrides the browser if `playwright install`
is not wanted or a system Chrome is preferred.

Output lands in `resources/ios-screenshots/6.7` and `.../6.5` at exactly
1290×2796 and 1284×2778. Apple rejects anything that is not the exact size.

**The script did not run at all until 2026-09-18.** It imports `playwright-core`,
which was declared in no `package.json` and installed nowhere, so following
these instructions produced `ERR_MODULE_NOT_FOUND` before a browser ever opened.
The page said "capture command ready" the whole time. It is now a declared
devDependency of `@dripplex/customer-mobile` with a `pnpm screenshots` script,
and the corrected command was run to the point where it stops and asks for
credentials:

```
device ios-6.7: 430x932 @3x -> 1290x2796
device ios-6.5: 428x926 @3x -> 1284x2778
```

— both exactly what Apple requires. A capture of `app.dripplex.com` at the 6.7"
profile was taken to prove the whole path end to end (browser, live site, exact
pixel size) and came back 1290×2796 showing the real welcome screen.

**What still needs the founder: the signed-in shots.** The script signs in as a
real customer and photographs what that account actually has — nothing is
mocked or seeded, which is why the shots are honest and why they need live
credentials. Those belong to the founder and must not be pasted into a chat or
a CI log. Run the two commands above from a machine that already holds them;
the existing `resources/play-screenshots/` set was captured the same way.

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

**Established from the Apple account, 2026-09-17** — these were open questions on
this page and are now answered: enrolment is complete as **AFNAN HOMES LTD**; the
Team ID is **`X9MCF93WB7`** (read from `DEVELOPMENT_TEAM` after Xcode wrote it,
and matching the value already served in the hosted AASA); the app record
**exists**, as _DrippleX · iOS 1.0 Prepare for Submission_; `com.dripplex.customer`
is registered as an App ID with Push Notifications and Associated Domains enabled
— Apple's validation of the entitlements proves both; an Apple Distribution
certificate and an App Store provisioning profile exist; and **build 1.0.0
(1000100) was uploaded** on 2026-09-17. See `docs/mobile/IOS.md` "First archive"
for how it was done and what went wrong on the way.

**Still not establishable from this repository:** whether an APNs key exists, the
EU Digital Services Act trader status, and anything about review outcomes.

## Push notifications — which key, and where it goes

Asked by the founder, 2026-09-18: _which APNs key is needed?_

**An APNs Authentication Key — the `.p8` — not a certificate.** One key works for
every app on the team, for both sandbox and production, and it does not expire.
The older `.p12` push certificates are per-app, per-environment and expire
annually; there is no reason to use one here.

Create it at **developer.apple.com → Certificates, Identifiers & Profiles →
Keys → +**, tick **Apple Push Notifications service (APNs)**, register, and
download. Three things come out of that screen and all three are needed:

| Value                   | Where it comes from                                             |
| ----------------------- | --------------------------------------------------------------- |
| `AuthKey_XXXXXXXXXX.p8` | downloaded **once** — Apple will not let it be downloaded again |
| **Key ID** (10 chars)   | shown beside the key, and in its filename                       |
| **Team ID**             | `X9MCF93WB7` — already established                              |

**It goes to Firebase, not to this repository.** Push is sent through Firebase
Cloud Messaging (`firebase-admin` in the backend,
`notification-center/providers/firebase-push.provider.ts`), so FCM is what talks
to Apple. Upload it at **Firebase Console → Project Settings → Cloud Messaging →
Apple app configuration → APNs Authentication Key → Upload**, with the Key ID and
Team ID. Nothing is added to the repo, no environment variable changes, no
redeploy — the backend's existing `FIREBASE_*` credentials keep working
unchanged.

**What is already done:** the `aps-environment` entitlement is `production` in
`App.entitlements` (sandbox in `AppDebug.entitlements`), Push Notifications is
enabled on the `com.dripplex.customer` App ID — Apple's validation of the
uploaded build proves it — and the client registers its token through
`@capacitor/push-notifications`. The key is the one missing link: without it FCM
has no way to reach APNs, so an iOS device registers a token successfully and
then silently receives nothing.

**Not a submission blocker.** The build uploads and reviews without it. It is a
blocker on the feature working, which is worse to discover after launch.

## TestFlight

See `docs/mobile/BETA-DISTRIBUTION.md`. Note that the first external build of a
version goes through App Review, and external testing needs its own test
information — so TestFlight is not a way to skip review, only a way to reach
testers before public release.
