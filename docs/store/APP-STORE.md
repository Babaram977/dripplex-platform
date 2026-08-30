# Apple App Store — metadata (draft)

## Developer account — legal entity

Apple Developer Program **organization** enrolment verifies the applicant against
the Dun & Bradstreet record. The legal name below is what goes in the
application; *Dripplex* is the app name, not the applicant.

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

The name matches: the D-U-N-S was issued to AFNAN HOMES LTD, the same entity that
`docs/legal/DPX-LEGAL-001-TERMS-OF-USE.md` §1 names as the contracting party. A
mismatch here is the usual cause of a stalled enrolment, so it was worth checking.

Enrolment itself is **parked** — founder decision 2026-08-28, revisit after the
driver dinner. `docs/mobile/IOS.md` lists the blockers the D-U-N-S does not
remove (no macOS build host, `aps-environment` still `development`, no signing
team).

## App Information

| Field                   | Value                                |
| ----------------------- | ------------------------------------ |
| **Name**                | Dripplex                             |
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
Dripplex Customer is a WebView shell loading https://app.dripplex.com (our production web app).

Test account (staging):
  Email: [provide staging tester]
  Password: [provide]

The app requires network. Push notifications optional.

No hardware features (camera/location) required at native layer — any KYC flows use in-app web APIs with user consent.

Encryption: standard HTTPS only (ITSAppUsesNonExemptEncryption = false).
```

## TestFlight

See `docs/mobile/BETA-DISTRIBUTION.md`.
