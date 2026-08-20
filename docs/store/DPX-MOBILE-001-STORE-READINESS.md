# DPX-MOBILE-001 — Store Readiness Gate

## Objective

Prepare the DrippleX customer mobile application for controlled Android and iOS testing first, then store review. Mobility/ride booking and driver dispatch are intentionally excluded from this workstream while that functionality is being actively fixed elsewhere.

## Current packaging baseline

- Customer app: `@dripplex/customer-mobile`
- Framework: Capacitor 7
- Android application ID: `com.dripplex.customer`
- iOS bundle identifier: `com.dripplex.customer`
- Android channels: `production`, `internal`, `closedBeta`
- Production customer URL: `https://app.dripplex.com`
- Android release artifacts: AAB + APK
- iOS release validation: unsigned simulator Release build in CI; signed App Store archive requires Apple signing credentials on macOS

## Gate A — Technical packaging

- [x] Android/iOS native projects present
- [x] Stable app identifiers configured
- [x] Release version/build metadata aligned at `1.0.0` / `1000100`
- [x] Android release flavors present
- [x] Android HTTPS app-link host configured
- [x] iOS custom URL scheme configured
- [x] Apple privacy manifest present
- [x] Android release signing is secret-driven in CI
- [x] Static packaging verification strengthened
- [x] Dedicated store-readiness CI workflow added
- [ ] Successful production Android AAB build recorded
- [ ] Successful iOS Release simulator build recorded
- [ ] Signed iOS archive/TestFlight build recorded

## Gate B — Brand and store assets

The repository currently identifies launcher/store assets as placeholders. Public submission must not proceed until the approved DrippleX mark has been exported into the required native/store sizes.

Required:

- [ ] Android 512x512 store icon
- [ ] Android adaptive icon foreground/background
- [ ] Google Play feature graphic
- [ ] Android phone screenshots
- [ ] iPhone screenshots
- [ ] iPad screenshots if the iPad target remains enabled
- [ ] iOS App Store icon set
- [ ] Final splash assets
- [ ] Store listing copy
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Marketing website URL

Source of truth for the brand mark: `packages/ui/src/brand/dripplex-mark.ts` and the approved brand-identity reference documented in `docs/TODO-BRAND-ASSETS.md`.

## Gate C — Functional smoke test

Before external testing, execute on a real Android device and a real iPhone:

1. Cold launch
2. Splash/initial loading
3. Registration
4. Login/OTP
5. Logout/login again
6. Customer profile
7. Location permission where the product requires it
8. Marketplace browsing
9. Search
10. Merchant/product detail
11. Cart
12. Checkout
13. Payment success
14. Payment failure/cancel
15. Order creation
16. Order history
17. Order status updates
18. Push notification receipt/tap
19. Deep-link open
20. Poor-network recovery
21. App background/foreground recovery
22. Force-close/relaunch session recovery
23. Account deletion flow if exposed to customers

Ride booking/driver dispatch is a separate test gate and remains blocked until Claude's current mobility work is complete.

## Gate D — Apple review readiness

- [ ] Signed archive created on macOS
- [ ] TestFlight build uploaded
- [ ] App Store Connect metadata complete
- [ ] Privacy nutrition labels match actual data collection
- [ ] Permission prompts have clear user-facing explanations
- [ ] Universal/custom link behavior verified
- [ ] Push notification entitlement/capability verified
- [ ] No placeholder branding or debug UI
- [ ] Review notes prepared for any non-obvious login/test flow

## Gate E — Google Play readiness

- [ ] Signed production AAB
- [ ] Play Console app details complete
- [ ] Data Safety declaration matches actual collection
- [ ] Content rating complete
- [ ] Target SDK verified against current Play policy
- [ ] App access/test credentials prepared for reviewers if needed
- [ ] Internal testing track passes
- [ ] Closed testing track passes
- [ ] No placeholder store assets

## Release strategy

```text
Development
   ↓
Internal build
   ↓
Real-device smoke test
   ↓
Closed beta / TestFlight
   ↓
Full regression
   ↓
Store submission
   ↓
Production
```

Do not submit the public store builds while the ride-booking/driver-dispatch path is known to be broken.
