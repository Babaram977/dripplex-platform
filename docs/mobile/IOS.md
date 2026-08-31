# iOS packaging — Dripplex Customer

| Field                 | Value                   |
| --------------------- | ----------------------- |
| **Bundle ID**         | `com.dripplex.customer` |
| **Display name**      | Dripplex                |
| **Marketing version** | `1.0.0`                 |
| **Build**             | `1000100`               |
| **Min iOS**           | 14.0                    |

## Xcode project

Path: `apps/customer-mobile/ios/App/App.xcodeproj`

Open on macOS:

```bash
cd apps/customer-mobile
pnpm exec cap open ios
```

## Signing

1. Apple Developer Program team
2. Create App ID `com.dripplex.customer`
3. Enable **Push Notifications** + **Associated Domains** (`applinks:app.dripplex.com`)
4. Provisioning: Automatic (Xcode) or manual profiles for CI (fastlane match)

`CODE_SIGN_STYLE = Automatic` in project — configure team in Xcode.

## Verified configuration

| Item                   | Status                                                |
| ---------------------- | ----------------------------------------------------- |
| Bundle identifier      | ✅                                                    |
| Launch screen          | ✅ `LaunchScreen.storyboard`                          |
| App icons              | ✅ DrippleX mark, 1024×1024 RGB — verified 2026-08-29 |
| Universal Links        | ✅ entitlements + intent template                     |
| Push (APNs)            | ✅ `UIBackgroundModes` + entitlements (`development`) |
| Privacy Manifest       | ✅ `PrivacyInfo.xcprivacy`                            |
| App Transport Security | ✅ HTTPS only (localhost exception)                   |
| Non-exempt encryption  | ✅ `ITSAppUsesNonExemptEncryption = false`            |
| Custom URL scheme      | ✅ `dripplex://`                                      |

## App Store enrolment — parked until after the driver dinner

Founder decision 2026-08-28: not now, revisit after Saturday.

**The D-U-N-S number has been issued** — **352296291**, Dun & Bradstreet case
10859055 (tracking 10797660, request key BVD5Z3B3P9), resolved 2026-08-28 10:09
UTC and verified through the national registry. That was the gate on Apple
Developer Program **organization** enrolment — the difference between publishing
as DrippleX and publishing as an individual. The full set of values to hand
Apple is in `docs/store/APP-STORE.md`.

### Check before applying to Apple — closed

Apple verifies the applicant's legal entity name against the D&B record, and a
mismatch is the most common cause of a stalled enrolment. **It matches.** The
D-U-N-S was issued to **AFNAN HOMES LTD**, which is the entity
`docs/legal/DPX-LEGAL-001-TERMS-OF-USE.md` §1 names — DrippleX is its trading
name (RC 9387949). Apply as Afnan Homes Ltd; DrippleX is the app name, not the
applicant.

**Not before 2026-09-02.** D&B says the record is visible 2–3 business working
days after resolution, and the 28th was a Friday. Applying against a record that
has not propagated returns nothing and stalls the enrolment rather than queuing
it.

### Blockers that the DUNS does not remove

| Blocker                                | Note                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No macOS**                           | `xcodebuild archive` cannot run on Linux. CI validates the iOS scaffold only (the "iOS project preflight" job). Reaching a `.ipa` needs Mac hardware, MacStadium or Xcode Cloud — a purchase decision, not a code change.                                                                                                                             |
| ~~App icons~~                          | **Not a blocker — this row was wrong when written.** The iOS asset catalog holds the real DrippleX mark at 1024×1024 RGB, and `verify-icons.mjs` passes all 32 native brand assets. Founder decision 2026-08-29: ship the current mark (D + speed lines, no X). The X lives on the driver bubble; the icon is modernised once the business is stable. |
| **`aps-environment` is `development`** | `App.entitlements`. The App Store requires `production`. A one-line change, deliberately not made while the only builds are internal.                                                                                                                                                                                                                 |
| **Signing team unset**                 | `CODE_SIGN_STYLE = Automatic`; the team is configured in Xcode, which needs the enrolled account.                                                                                                                                                                                                                                                     |

Nothing here blocks Android, which is what the launch runs on.

## App Store Connect

See `docs/store/APP-STORE.md` for metadata, screenshots, privacy labels, review notes.

## Build note (Linux CI)

Full archive (`xcodebuild archive`) requires **macOS** runner with CocoaPods. This repo validates scaffold on Linux; release archive runs on Mac hardware or MacStadium / Xcode Cloud.
