# DPX-MOBILE-003 — Store privacy declarations

The canonical answers we give Apple and Google. Read straight into the console forms.

Derived from the evidence in `DPX-MOBILE-002-PRIVACY-PERMISSIONS-AUDIT.md`; kept in step with
`apps/customer-mobile/ios/App/App/PrivacyInfo.xcprivacy`, which
`apps/customer-mobile/scripts/verify-config.mjs` asserts on every CI run. If this document and
that manifest disagree, CI fails.

**Scope: one binary, five personas.** `com.dripplex.customer` serves customer, merchant, rider,
driver and operations from a single bundle (`apps/super-app/src/app/App.tsx:454-458` routes
`/ops`, `/merchant`, `/rider`, `/driver`). Both stores ask what **the app** collects, not what a
typical user sees, so driver KYC and merchant bank details are declared even though most installs
never reach them. Founder decision 2026-08-21: keep one binary, declare the full footprint.

---

## 1. Correction to the audit — crash and performance data are NOT collected

The audit's §6 carried forward `CrashData` and `PerformanceData` from the previous manifest. That
was wrong, and this document supersedes it.

Sentry is present in `apps/customer-web` (`@sentry/nextjs`, `src/instrumentation.ts`) but the hook
returns early unless a DSN is set:

```ts
const dsn = process.env['SENTRY_DSN'] ?? process.env['NEXT_PUBLIC_SENTRY_DSN'];
if (!dsn) {
  return;
}
```

Neither variable exists on the production `@dripplex/customer-web` service (verified 2026-08-21 —
the service carries `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and Railway's own injected variables, and nothing else). The
super-app has no Sentry dependency at all. **No crash or performance data leaves the app.**

The old manifest declared those two types and nothing else — so it was simultaneously
over-declaring diagnostics and omitting ten types actually collected.

**Trap:** setting `SENTRY_DSN`, or adding Sentry to the super-app, makes both store declarations
false the same day. `verify-config.mjs` fails the build if those types reappear without this
document changing. Note also that the Sentry config carries `replaysOnErrorSampleRate: 0.1` —
session replay would be a materially larger disclosure than crash data, so switching it on is a
privacy decision, not an ops one.

The same trap applies to **Smile Identity**: the provider exists at
`apps/backend/src/drivers/identity-verification/smile-id.provider.ts`, but `SMILE_ID_PARTNER_ID`,
`SMILE_ID_API_KEY` and `SMILE_ID_BASE_URL` are absent from the production backend service. No
identity data is sent there, so it is not declared as a recipient.

## 2. Apple — privacy nutrition labels

Ten types, all **linked to the user**, none used for **tracking**, all for **App Functionality**
unless noted.

| App Store category | Type             | Backed by                                               |
| ------------------ | ---------------- | ------------------------------------------------------- |
| Contact Info       | Name             | `User.firstName`, `User.lastName`                       |
| Contact Info       | Email Address    | `User.email`                                            |
| Contact Info       | Phone Number     | `User.phone` — primary identity                         |
| Contact Info       | Physical Address | `CustomerAddress.addressLine1/2`, `Business.address`    |
| Location           | Precise Location | `CustomerAddress.latitude/longitude` — `Decimal(10,7)`  |
| User Content       | Photos or Videos | profile, store and KYC images incl. verification selfie |
| Other Data         | Other Data Types | government ID number, date of birth                     |
| Financial Info     | Payment Info     | `BankAccount.accountNumber` — merchant payouts          |
| Purchases          | Purchase History | `Order`, `OrderItem`, wallet and settlement models      |
| Identifiers        | Device ID        | `DeviceToken.token` — push delivery only                |

`NSPrivacyTracking` = **false**, `NSPrivacyTrackingDomains` = **empty**. No advertising,
attribution or analytics SDK is in the dependency tree.

**Say explicitly that card details are not collected.** `cardNumber`, `cvv`, `pan`, `expiryMonth`,
`cardLast` and `authorizationCode` return zero matches across `schema.prisma`. Paystack and
Flutterwave hold card data; we never see it. Payment Info above is a bank account for payouts.

`NSPrivacyAccessedAPITypes` declares `UserDefaults` with reason `CA92.1` (app's own storage) —
unchanged.

## 3. Google Play — Data Safety

| Question                             | Answer                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Encrypted in transit                 | **Yes** — `allowMixedContent: false`, `androidScheme: 'https'`, HTTPS only |
| Users can request data deletion      | **See §5 — currently No**                                                  |
| Data used for tracking / advertising | **No**                                                                     |

Collected, **not shared**, in every case below. All required rather than optional except where the
feature itself is optional.

| Category            | Types                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Personal info       | Name · Email address · Phone number · Address · Government ID · Other (date of birth)     |
| Financial info      | Purchase history · Other (bank account for merchant payouts). **Card data not collected** |
| Location            | Precise location — required for delivery, pickup and dispatch                             |
| Photos and videos   | Photos — profile, store listings, KYC documents                                           |
| App activity        | Other actions — order and in-app activity                                                 |
| Device or other IDs | Push token                                                                                |

**On "shared":** payments, SMS, email, push and object storage run through processors acting on
our instructions under contract. Play distinguishes that from sharing; declare them as service
providers, not as data sharing.

Recipients: Paystack, Flutterwave, Peyflex (payments) · Termii (SMS OTP) · Resend (email) ·
Firebase (push) · Cloudflare R2 (object storage, includes KYC images) · Google Maps (server-side
geocoding of merchant addresses).

Content rating: Shopping; no user-generated public content in the shell. Expect Everyone / low
maturity.

## 4. Native permissions, and why each one

| Platform | Declared                              | Reason                                           |
| -------- | ------------------------------------- | ------------------------------------------------ |
| Android  | `INTERNET`                            | Remote-URL shell                                 |
| Android  | `POST_NOTIFICATIONS`                  | Order and dispatch push                          |
| Android  | `ACCESS_FINE_LOCATION`                | Delivery address, pickup, dispatch heartbeat     |
| Android  | `ACCESS_COARSE_LOCATION`              | Same, degraded fallback                          |
| iOS      | `NSLocationWhenInUseUsageDescription` | As above                                         |
| iOS      | `NSCameraUsageDescription`            | KYC document photo and verification selfie       |
| iOS      | `NSPhotoLibraryUsageDescription`      | Choosing existing photos for profile, store, KYC |

**Not declared, deliberately:**

- **`ACCESS_BACKGROUND_LOCATION`.** The heartbeat runs on `navigator.geolocation` in a WebView,
  which only executes in the foreground. Declaring it invites a Play policy review we would fail,
  for a capability we do not have. `verify-config.mjs` fails the build if it appears.
- **`NSLocationAlwaysAndWhenInUseUsageDescription`.** Same reasoning on iOS.
- **Android `CAMERA`.** The KYC screens use `<input type="file" accept="image/*" capture>`, which
  Android satisfies by intent to the camera app — no permission needed from us, and declaring it
  while ungranted can break `ACTION_IMAGE_CAPTURE`. **Open pending a real-device test of the KYC
  capture flow.** iOS is the opposite case and does need its strings, because WKWebView invokes
  the system camera and photo picker directly. The asymmetry is correct, not an oversight.

## 5. The remaining blocker

**Account deletion does not exist** — no endpoint, no screen, no flow. Google Play requires a
deletion route including a public web URL; Apple requires in-app deletion under 5.1.1(v). Until it
ships, the Play Data Safety answer to "users can request data deletion" is **No**, and that answer
is itself a submission blocker.

Founder policy direction is locked (2026-08-21) and awaits its own specification and PR:
deletion is **requestable** but not immediate destruction — deactivate, remove access, anonymise
what may be anonymised, retain what law requires. Deletion is blocked while a withdrawable wallet
balance, an in-flight order or ride, an unresolved refund, a pending payout, or a rider/merchant
financial obligation exists. Exact retention periods need Nigerian legal review; NDPA 2023 also
grants a right to erasure with exceptions, so the review should answer retention and erasure
together rather than separately.

## 6. Not verified here

- Runtime permission behaviour on real hardware — no device in this environment. The Android
  camera question in §4 is explicitly unresolved for that reason.
- `targetSdkVersion` is 35, which met Play's bar for new apps from August 2025. It should be
  checked against the requirement in force at submission; no threshold is asserted here.
