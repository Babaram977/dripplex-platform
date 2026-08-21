# DPX-MOBILE-002 — Permissions & privacy audit

Run 2026-08-21 against the code, not against the manifests' claims. Every row below cites the
file that proves it. Nothing here is inferred from what the app "probably" does.

**This is an audit, not an implementation.** It produces the answers needed for the Apple privacy
nutrition labels, the corrected `PrivacyInfo.xcprivacy`, the Play Data Safety form, and the native
permission declarations. Landing those changes is a separate PR.

---

## 1. The finding that is not a store problem

**Location does not work on Android or iOS today, and would not work if we shipped tonight.**

`apps/customer-mobile/android/app/src/main/AndroidManifest.xml` declares exactly two permissions:

```
android.permission.INTERNET
android.permission.POST_NOTIFICATIONS
```

There is no `ACCESS_FINE_LOCATION` and no `ACCESS_COARSE_LOCATION`. Capacitor's WebView bridges
`navigator.geolocation` to the native location provider, which cannot be granted a permission the
app never declared — so every `getCurrentPosition` call fails at runtime.

`ios/App/App/Info.plist` contains **zero** `NSUsageDescription` keys. On iOS a missing
`NSLocationWhenInUseUsageDescription` means the prompt never appears; the request fails, and
Apple rejects the binary for requesting a capability it does not explain.

Six surfaces call it:

| Surface      | File                                          | What breaks                      |
| ------------ | --------------------------------------------- | -------------------------------- |
| Checkout     | `apps/super-app/src/app/checkoutScreen.tsx`   | Cannot locate a delivery address |
| Ride booking | `apps/super-app/src/app/rideScreen.tsx`       | Cannot set pickup                |
| Rider        | `apps/super-app/src/app/riderScreen.tsx`      | Cannot go on duty accurately     |
| Driver       | `apps/super-app/src/app/driverScreen.tsx`     | Cannot be dispatched             |
| Merchant     | `apps/super-app/src/app/merchantScreen.tsx`   | Cannot set business coordinates  |
| Heartbeat    | `apps/super-app/src/lib/locationHeartbeat.ts` | See below                        |

The heartbeat is the sharpest edge. It re-reports position every **2 minutes** while a driver or
rider is online, because the server treats a fix older than five minutes as no fix at all and
skips that driver in dispatch. With no location permission the heartbeat never succeeds, the
driver shows "You are live" and is invisible to dispatch — the exact failure mode that file's
header was written to end.

**Consequence:** a device test of the delivery or ride flow cannot pass on the current native
projects, regardless of backend state. This should be fixed before the Gate C functional smoke
test, not before submission.

## 2. What the app actually collects

Ground truth is `apps/backend/prisma/schema.prisma`.

| Data                              | Evidence                                                                                                             | Notes                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Name                              | `User.firstName`, `User.lastName`                                                                                    | Required at registration                                        |
| Email address                     | `User.email` (unique)                                                                                                | Required                                                        |
| Phone number                      | `User.phone` (unique)                                                                                                | Primary identity — founder decision, no username                |
| Date of birth                     | `User.dateOfBirth`                                                                                                   |                                                                 |
| Photos                            | `User.profilePhotoUrl`, `Business.coverPhotoUrl`, `ProductImage`                                                     | User-uploaded                                                   |
| Precise location                  | `CustomerAddress.latitude/longitude`, `Business.latitude/longitude`, `DriverIdentityVerification.latitude/longitude` | Decimal(10,7) — street-level                                    |
| Physical address                  | `CustomerAddress.addressLine1/2`, `Business.address`                                                                 |                                                                 |
| Government ID                     | `CustomerKyc.documentNumber`, `DriverKyc.documentNumber`, `MerchantKyc.documentNumber`                               |                                                                 |
| ID document images                | `CustomerKyc.frontImageUrl/backImageUrl`, `DriverKyc.frontImage/backImage`, `MerchantKyc.selfieImage`                |                                                                 |
| Selfie / biometric-adjacent image | `CustomerKyc.selfieUrl`, `MerchantKyc.selfieImage`                                                                   | Stored images, **not** biometric templates                      |
| Bank account number               | `BankAccount.accountNumber`                                                                                          | Merchant payouts                                                |
| Purchase history                  | `Order`, `OrderItem`, wallet and settlement models                                                                   |                                                                 |
| IP address                        | `AuthSession.ipAddress`, `AuditLog.ipAddress`, `DriverIdentityVerification.ipAddress`                                | Security/audit                                                  |
| Device / push token               | `DeviceToken.token` + `platform`                                                                                     | Push delivery                                                   |
| Emergency contact                 | `DriverProfile.emergencyContactPhone/Email`                                                                          | **Third-party** personal data — a person who never used the app |
| Credentials                       | `User.passwordHash`                                                                                                  | Hashed, never plaintext                                         |

**Not collected — confirmed by absence, not assumption.** A search of the schema for
`cardNumber`, `cvv`, `pan`, `expiryMonth`, `cardLast`, `authorizationCode` returns **zero**
matches. Card data never touches our database; Paystack and Flutterwave hold it. Say so on both
forms — it is a materially better answer than the default assumption.

## 3. Who else receives it

From outbound hosts in `apps/backend/src`:

| Recipient                           | Purpose                   | Data                                |
| ----------------------------------- | ------------------------- | ----------------------------------- |
| Paystack (`api.paystack.co`)        | Card/bank payments        | Name, email, amount                 |
| Flutterwave (`api.flutterwave.com`) | Payments                  | Name, email, amount                 |
| Peyflex (`client.peyflex.com`)      | Utilities / bill payments | Transaction details                 |
| Termii (`api.ng.termii.com`)        | SMS OTP                   | Phone number                        |
| Resend (`api.resend.com`)           | Transactional email       | Email address                       |
| Firebase (`FIREBASE_*`)             | Push notifications        | Device token                        |
| Cloudflare R2                       | Object storage            | Uploaded images incl. KYC documents |
| Google Maps (`maps.googleapis.com`) | Server-side geocoding     | Merchant address strings            |

**Smile Identity is coded but NOT active.** `apps/backend/src/drivers/identity-verification/smile-id.provider.ts`
exists, but `SMILE_ID_PARTNER_ID` / `SMILE_ID_API_KEY` / `SMILE_ID_BASE_URL` are **absent from the
production Railway variables** (verified 2026-08-21 — 41 app variables, none of them `SMILE_ID_*`).
No identity data is sent there today, so it must **not** be declared. If those variables are ever
set, both store declarations become false the same day — worth a startup assertion or a note on
the variable itself.

## 4. The declaration must cover four personas, not one

`apps/super-app/src/app/App.tsx:454-458` routes `/ops`, `/merchant`, `/rider` and `/driver` inside
the same bundle. Once the shell points at the Super App (the locked architecture decision), the
single binary `com.dripplex.customer` can collect driver KYC, rider location traces, and merchant
bank details.

Both stores ask what **the app** collects, not what a given user sees. So the declarations must
include every persona's data even though most installs are customers. Declaring only
customer-shaped data would be inaccurate the moment one driver signs in.

This is a real decision, not a paperwork detail: the alternative is separate binaries per persona.
Recommend keeping one binary and declaring the full set — but it should be a conscious choice.

## 5. Native permissions to declare

### Android — `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

`ACCESS_BACKGROUND_LOCATION` is **not** required and should not be added. The heartbeat runs on
`navigator.geolocation` inside a WebView, which only executes while the app is foregrounded.
Background location triggers a Play policy review that we would fail, for a capability we do not
have.

**Camera — resolved 2026-08-21. Not needed now; needed when Smile Identity is engaged.**

Founder confirmation: customers photograph payment receipts, users photograph documents, and if
Smile Identity is engaged it performs face verification. Camera is a real product requirement. The
question was never whether the feature exists — it is which Android mechanism it uses, because the
two need different things from the manifest.

Everything shipping today is a **file input**, verified in the source:

| Surface         | File                      | Mechanism                                                                 |
| --------------- | ------------------------- | ------------------------------------------------------------------------- |
| Payment receipt | `checkoutScreen.tsx:1647` | `accept="image/*,application/pdf"` — no `capture`; a picker, not a camera |
| Delivery photo  | `riderScreen.tsx:1040`    | `capture="environment"`                                                   |
| KYC selfie      | `screensB.tsx:1818`       | `capture="user"`                                                          |

`getUserMedia`, `mediaDevices` and `<video>` return **zero matches** across `apps/super-app/src`
and `apps/customer-web/src`. So every capture path hands off to the camera app by intent, which
needs no permission from us — and declaring `CAMERA` while it is ungranted can make
`ACTION_IMAGE_CAPTURE` fail. Adding it today would risk breaking receipt and selfie capture that
currently works, in exchange for a Play review question about a capability nothing uses.

**Smile Identity changes the mechanism, not just the feature.** Face verification is a live camera
stream, not a file input — `getUserMedia` via their Web SDK, or a native SDK. Either opens the
camera _inside_ the app, and that requires:

- `<uses-permission android:name="android.permission.CAMERA" />`, and
- a **runtime permission request** — Capacitor's WebView does not grant `getUserMedia` on its own;
  it needs the Camera plugin or explicit handling.

So `CAMERA` belongs to the Smile Identity work, added at the same time as the code that needs it.

It also moves the privacy declarations. A face scan used for identity matching is biometric
processing — a materially heavier disclosure than the stored selfie image declared today. This is
the `SMILE_ID_*` trap in `DPX-MOBILE-003` §1 firing: configuring those variables makes both store
declarations false the same day unless they are updated in the same change.

**Still worth doing on device:** confirm the three surfaces above actually capture. If they do, the
current undeclared-`CAMERA` position is proven rather than merely reasoned.

### iOS — `Info.plist`

Every string is shown verbatim to the user and to the reviewer. Vague strings are a rejection
reason on their own.

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>DrippleX uses your location to set your delivery address, find nearby merchants, and match
you with a nearby rider or driver.</string>

<key>NSCameraUsageDescription</key>
<string>DrippleX uses the camera so you can photograph your ID document and take a verification
selfie during account verification.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>DrippleX lets you choose photos from your library for your profile, your store, and your
verification documents.</string>
```

## 6. `PrivacyInfo.xcprivacy` is materially wrong

It currently declares two types only: `NSPrivacyCollectedDataTypeCrashData` and
`NSPrivacyCollectedDataTypePerformanceData`. Measured against section 2, it should declare:

| Apple type                                   | Linked | Tracking | Purpose           |
| -------------------------------------------- | ------ | -------- | ----------------- |
| `...TypeName`                                | Yes    | No       | App Functionality |
| `...TypeEmailAddress`                        | Yes    | No       | App Functionality |
| `...TypePhoneNumber`                         | Yes    | No       | App Functionality |
| `...TypePreciseLocation`                     | Yes    | No       | App Functionality |
| `...TypePhysicalAddress`                     | Yes    | No       | App Functionality |
| `...TypePhotosorVideos`                      | Yes    | No       | App Functionality |
| `...TypeOtherDataTypes` (government ID, DOB) | Yes    | No       | App Functionality |
| `...TypePaymentInfo` (bank account)          | Yes    | No       | App Functionality |
| `...TypePurchaseHistory`                     | Yes    | No       | App Functionality |
| `...TypeDeviceID` (push token)               | Yes    | No       | App Functionality |
| `...TypeCrashData`                           | No     | No       | App Functionality |
| `...TypePerformanceData`                     | No     | No       | Analytics         |

`NSPrivacyTracking` stays `false` and `NSPrivacyTrackingDomains` stays empty — there is no
advertising SDK, no cross-app tracking, and no analytics vendor in the dependency tree.

## 7. Play Data Safety — answers

| Section                    | Answer                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Data encrypted in transit  | Yes — HTTPS only; `allowMixedContent: false`, `androidScheme: 'https'`                                                                        |
| Users can request deletion | **See section 8 — currently No**                                                                                                              |
| Personal info              | Name · Email · Phone · Address · Government ID · Other (DOB) — collected, not shared, required                                                |
| Financial info             | Purchase history · Other (bank account for payouts). Card data **not collected**                                                              |
| Location                   | Precise location — collected, not shared, required for delivery and dispatch                                                                  |
| Photos                     | Collected (profile, store, KYC), not shared                                                                                                   |
| App activity               | Order and in-app activity — collected, not shared                                                                                             |
| Device IDs                 | Push token — collected, not shared                                                                                                            |
| Third parties              | Processors under contract (payments, SMS, email, push, storage). Not "sharing" in Play's sense — service providers acting on our instructions |

Content rating: Shopping, no user-generated public content in the shell. Expect Everyone / low
maturity.

## 8. Two blockers that need a founder decision

**Account deletion does not exist.** A search across `apps/backend/src` and `apps/super-app/src`
for `deleteAccount`, `delete-account`, `account/delete` and `accountDeletion` returns **nothing** —
no endpoint, no screen, no flow. Google Play requires a deletion route (in-app and a public web
URL) for any app with accounts; Apple requires in-app deletion under 5.1.1(v). **Neither store
will accept the app without it.**

Per the no-speculative-behaviour rule this is recorded, not invented, because it needs decisions
only the founder can make:

- A wallet with a balance — refund, forfeit, or block deletion until withdrawn?
- Orders in flight, or a rider holding cash owed to the platform?
- KYC records and financial transactions have statutory retention in Nigeria; what is deleted
  versus anonymised versus retained?
- Merchants with live listings and pending payouts.

**`targetSdkVersion` is 35.** That met Play's bar for new apps from August 2025. It should be
checked against the requirement in force at submission before the build is finalised — I have not
verified the current threshold and am not asserting one.

## 9. What this audit does not cover

- No code changed. Landing sections 5, 6 and 7 is a separate PR.
- Runtime permission behaviour is untested — no device in this environment. In particular the
  camera question in section 5 is explicitly left open pending a device test.
- Apple's export-compliance and encryption questions are unchanged and already answered in the
  project.
