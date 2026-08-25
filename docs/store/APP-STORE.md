# Apple App Store — metadata (draft)

## App Information

| Field                   | Value                                |
| ----------------------- | ------------------------------------ |
| **Name**                | DrippleX                             |
| **Subtitle** (30 chars) | life, Simplified                     |
| **Bundle ID**           | `com.dripplex.customer`              |
| **SKU**                 | `dripplex-customer-ios`              |
| **Primary category**    | Shopping                             |
| **Secondary**           | Food & Drink                         |
| **Content rights**      | Does not contain third-party content |
| **Age rating**          | 4+ (complete questionnaire)          |

## URLs

| Field          | URL                            |
| -------------- | ------------------------------ |
| Privacy Policy | `https://dripplex.com/privacy` |
| Support        | `https://dripplex.com/contact` |
| Marketing      | `https://dripplex.com`         |

## Description (template)

Same body as `docs/store/GOOGLE-PLAY.md` full description.

**Promotional text** (170 chars):  
`Shop, eat, ride, and pay across Nigeria. One Super Platform. life, Simplified.`

**Keywords** (100 chars):  
`nigeria,marketplace,food,delivery,wallet,rides,shopping,parcel,pharmacy`

## Screenshots

| Device         | Size      | Count    | Status |
| -------------- | --------- | -------- | ------ |
| iPhone 6.7"    | 1290×2796 | 3–10     | ⏳     |
| iPhone 6.5"    | 1284×2778 | 3–10     | ⏳     |
| iPad Pro 12.9" | 2048×2732 | Optional | ⏳     |

## App Preview

Optional 15–30s video — defer to post-brand asset.

## Privacy nutrition labels

| Data type                   | Linked to user | Purpose           |
| --------------------------- | -------------- | ----------------- |
| Contact info (email, phone) | Yes            | Account           |
| Purchases                   | Yes            | App functionality |
| Identifiers (device token)  | Yes            | Push              |
| Diagnostics (crashes)       | No             | Analytics         |

Matches `PrivacyInfo.xcprivacy` + Sentry (when enabled).

## Review notes

```
DrippleX Customer is a WebView shell loading https://app.dripplex.com (our production web app).

Test account (staging):
  Email: [provide staging tester]
  Password: [provide]

The app requires network. Push notifications optional.

No hardware features (camera/location) required at native layer — any KYC flows use in-app web APIs with user consent.

Encryption: standard HTTPS only (ITSAppUsesNonExemptEncryption = false).
```

## TestFlight

See `docs/mobile/BETA-DISTRIBUTION.md`.
