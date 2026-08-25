# iOS packaging — DrippleX Customer

| Field                 | Value                   |
| --------------------- | ----------------------- |
| **Bundle ID**         | `com.dripplex.customer` |
| **Display name**      | DrippleX                |
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
| App icons              | ⚠️ Default asset catalog — replace                    |
| Universal Links        | ✅ entitlements + intent template                     |
| Push (APNs)            | ✅ `UIBackgroundModes` + entitlements (`development`) |
| Privacy Manifest       | ✅ `PrivacyInfo.xcprivacy`                            |
| App Transport Security | ✅ HTTPS only (localhost exception)                   |
| Non-exempt encryption  | ✅ `ITSAppUsesNonExemptEncryption = false`            |
| Custom URL scheme      | ✅ `dripplex://`                                      |

## App Store Connect

See `docs/store/APP-STORE.md` for metadata, screenshots, privacy labels, review notes.

## Build note (Linux CI)

Full archive (`xcodebuild archive`) requires **macOS** runner with CocoaPods. This repo validates scaffold on Linux; release archive runs on Mac hardware or MacStadium / Xcode Cloud.
