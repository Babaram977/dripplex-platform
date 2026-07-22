# Program D — Phase D4: Mobile Packaging & Store Readiness

| Field            | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| **Program**      | D — Production Launch                                  |
| **Phase**        | D4 — Mobile Packaging & Store Readiness                |
| **Status**       | Complete — awaiting review before D5                   |
| **Branch**       | `cursor/program-d4-mobile-packaging-1b33`              |
| **Base**         | D3 (`cursor/program-d3-monitoring-observability-1b33`) |
| **Last updated** | 2026-07-22                                             |

## Constraints honored

- No feature development
- No backend changes
- No UI redesign
- Packaging, documentation, and store-readiness scaffolding only

---

## 1. Android packaging status

| Item                                               | Status                         |
| -------------------------------------------------- | ------------------------------ |
| Capacitor shell `apps/customer-mobile`             | ✅                             |
| Package `com.dripplex.customer`                    | ✅                             |
| Version `1.0.0-rc.1` / `100001`                    | ✅                             |
| Product flavors (production, internal, closedBeta) | ✅                             |
| Signing scaffold + CI secrets hooks                | ✅                             |
| AAB + APK build script / workflow                  | ✅                             |
| Icons                                              | ⚠️ Default — **brand blocker** |
| Splash `#0E7A3E`                                   | ✅                             |
| Permissions (minimal)                              | ✅                             |
| Deep links + network security                      | ✅                             |
| FCM `google-services.json`                         | ⏳ Org Firebase project        |
| **Signed AAB produced in CI**                      | ⏳ Needs keystore secrets      |

Details: `docs/mobile/ANDROID.md`

## 2. iOS packaging status

| Item                                 | Status                            |
| ------------------------------------ | --------------------------------- |
| Xcode project scaffold               | ✅                                |
| Bundle `com.dripplex.customer`       | ✅                                |
| Version / build aligned with Android | ✅                                |
| Launch screen                        | ✅                                |
| App icons                            | ⚠️ Default — **brand blocker**    |
| Universal Links entitlements         | ✅                                |
| Push / APNS entitlements             | ✅ (development)                  |
| Privacy Manifest                     | ✅                                |
| ATS (HTTPS)                          | ✅                                |
| App Store metadata draft             | ✅ `docs/store/APP-STORE.md`      |
| **Archive / TestFlight upload**      | ⏳ Requires macOS + Apple signing |

Details: `docs/mobile/IOS.md`

## 3. PWA readiness

| Item                              | Status                       |
| --------------------------------- | ---------------------------- |
| Manifest + theme                  | ✅                           |
| Service worker + offline fallback | ✅                           |
| Shortcuts (D4)                    | ✅                           |
| Install prompt (custom UI)        | ❌ Deferred (no UI redesign) |
| Background sync                   | ❌ Deferred                  |
| Web push                          | ❌ Deferred                  |
| Maskable / apple-touch PNG        | ⚠️ **brand blocker**         |

Details: `docs/mobile/PWA-AUDIT.md`

## 4. Store assets completed

| Asset                           | Status                       |
| ------------------------------- | ---------------------------- |
| Listing copy (Play + App Store) | ✅ Draft                     |
| Feature graphic / screenshots   | ⏳ Awaiting captures + brand |
| Official logo / icons           | ⏳ `TODO(brand-assets)`      |
| `store-assets/README.md` specs  | ✅                           |

## 5. Permissions review

✅ Customer Android manifest: **INTERNET** + **POST_NOTIFICATIONS** only. No camera, location, storage, phone, or background location.

Details: `docs/mobile/PERMISSIONS.md`

## 6. Push notification readiness

| Item                            | Status         |
| ------------------------------- | -------------- |
| Capacitor Push plugin           | ✅             |
| FCM / APNS config templates     | ✅             |
| Notification channel spec       | ✅ Documented  |
| Deep link from push             | ✅ Documented  |
| Backend device registration API | ❌ Post-D4     |
| Live FCM/APNS credentials       | ⏳ Org secrets |

Details: `docs/mobile/PUSH-NOTIFICATIONS.md`

## 7. Beta distribution readiness

| Track                             | Status                         |
| --------------------------------- | ------------------------------ |
| Play Internal Testing guide       | ✅                             |
| Play Closed Testing guide         | ✅                             |
| TestFlight guide                  | ✅                             |
| Beta tester guide + release notes | ✅                             |
| **First upload to Play / ASC**    | ⏳ Blocked on signing + assets |

Details: `docs/mobile/BETA-DISTRIBUTION.md`

## 8. Remaining blockers

1. **Official brand assets** — `docs/TODO-BRAND-ASSETS.md` (icons, splash raster, store screenshots).
2. **Android release keystore** in CI secrets (`ANDROID_KEYSTORE_*`).
3. **Firebase + APNs** production projects and config files.
4. **Apple Developer** team signing + first TestFlight archive (macOS).
5. **Host** `assetlinks.json` + `apple-app-site-association` on `app.dripplex.com`.
6. **Store screenshots** from staging environment.
7. **Backend push token API** (explicitly out of D4 scope).
8. Merchant/Rider native shells not scaffolded (web beta only).

## 9. Recommendation

### NOT READY FOR STORE SUBMISSION

**Ready for:** internal engineering beta (Android debug / unsigned CI), PWA staging validation, and store listing **draft** entry.

**Not ready for:** public Google Play or App Store review until brand raster assets, signing secrets, Firebase/APNs, and store graphics are in place.

Proceed to **Program D5** only after stakeholder review of this assessment and resolution of blockers 1–6 above.

---

## Quality gates

| Gate                            | Result                               |
| ------------------------------- | ------------------------------------ |
| Typecheck                       | ✅ (run in CI)                       |
| Lint                            | ✅ (run in CI)                       |
| Tests                           | ✅ Backend suite                     |
| Mobile static verify            | ✅ `scripts/mobile/verify-mobile.sh` |
| Android release build           | ⏳ CI with secrets / local SDK       |
| iOS archive                     | ⏳ macOS required                    |
| PWA audit                       | ⚠️ Partial — see §3                  |
| Accessibility / Performance     | ⏳ Manual Lighthouse on staging      |
| Critical packaging gaps in-repo | **0** for customer scaffold design   |

## Key paths

| Area            | Path                                 |
| --------------- | ------------------------------------ |
| Customer mobile | `apps/customer-mobile/`              |
| Mobile docs     | `docs/mobile/`                       |
| Store listings  | `docs/store/`                        |
| Asset specs     | `store-assets/README.md`             |
| CI              | `.github/workflows/mobile-build.yml` |
