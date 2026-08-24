# Android packaging — Dripplex Customer

| Field       | Value                                    |
| ----------- | ---------------------------------------- |
| **App**     | Customer (`apps/customer-mobile`)        |
| **Package** | `com.dripplex.customer`                  |
| **Version** | `1.0.0` (versionCode `1000100`)          |
| **Shell**   | Capacitor 7 — remote URL to customer-web |

## Architecture

The native shell loads a remote URL (`CAPACITOR_SERVER_URL`, default
`https://app.dripplex.com`) — no static export is bundled in the APK/AAB.

That URL is the **Super App**, which is the canonical surface for customers,
drivers, riders and merchants (founder decision, 2026-08-24). All four sign in
and work inside the APK; `/driver`, `/rider` and `/merchant` are front doors
within it, and partner sign-up is reached from "Become a Partner" on the
customer home screen.

This section used to open "Customer-web is a Next.js SSR deployment", which
described a different service: customer-web serves `dripplex.com` and
`www.dripplex.com`, not `app.dripplex.com`. The URL in the config was already
right; the sentence explaining it was not.

## Build outputs

| Artifact          | Gradle task               | Use            |
| ----------------- | ------------------------- | -------------- |
| App Bundle (.aab) | `bundle{Flavor}Release`   | Google Play    |
| Universal APK     | `assemble{Flavor}Release` | Sideload / QA  |
| Debug APK         | `assembleDebug`           | Local emulator |

Flavors: `production`, `internal`, `closedBeta` (version suffix only — same `applicationId` for Play tracks).

```bash
cd apps/customer-mobile
export CAPACITOR_SERVER_URL=https://app.dripplex.com
bash ../../scripts/mobile/build-android.sh
```

CI: `.github/workflows/mobile-build.yml` (workflow_dispatch + branch push).

## Signing

1. Generate release keystore (once):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias dripplex-customer \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `android/keystore.properties.example` → `android/keystore.properties`
3. Store secrets in GitHub: `ANDROID_KEYSTORE_BASE64`, passwords, alias

## Verified configuration

| Item                                            | Status                                        |
| ----------------------------------------------- | --------------------------------------------- |
| Package name `com.dripplex.customer`            | ✅                                            |
| Version `1.0.0` / code `1000100`                | ✅                                            |
| Release signing scaffold                        | ✅ (needs keystore secrets)                   |
| Icons                                           | ⚠️ Capacitor default — replace with brand kit |
| Splash                                          | ✅ `#0E7A3E` via SplashScreen plugin          |
| Permissions (INTERNET, POST_NOTIFICATIONS only) | ✅                                            |
| Deep links (HTTPS + `dripplex://`)              | ✅ intent filters                             |
| Network security (HTTPS default)                | ✅ `network_security_config.xml`              |
| FCM                                             | ⏳ Add `google-services.json` from Firebase   |
| Play asset links                                | ⏳ Host `assetlinks.json`                     |

## Internal / Closed beta

Upload the **same signed AAB** to:

- **Internal testing** — up to 100 testers, instant
- **Closed testing** — invited testers, store listing preview

See `docs/mobile/BETA-DISTRIBUTION.md`.
