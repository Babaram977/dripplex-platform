# Beta distribution guide

## Google Play

### Internal testing

1. Build signed AAB: `scripts/mobile/build-android.sh` with `ANDROID_FLAVOR=internal`
2. Play Console → **Testing → Internal testing**
3. Create release → upload AAB `1.0.0-internal`
4. Add tester emails (max 100)
5. Share opt-in link

### Closed testing

1. Same AAB or `closedBeta` flavor suffix build
2. **Testing → Closed testing** → create track
3. Complete store listing (draft OK for closed)
4. Invite testers via email or Google Group

### Release notes (template)

```
DrippleX 1.0.0 (Beta)

• Customer app shell loading production/staging web
• Sign in, browse marketplace, cart, checkout
• Wallet and order tracking
• Push notifications (beta) — enable when prompted

Known: placeholder icons until brand asset drop.
Report issues: support@dripplex.com
```

## TestFlight (iOS)

1. Archive on macOS → Upload to App Store Connect
2. **TestFlight → Internal testing** (team, up to 100)
3. **External testing** — requires Beta App Review
4. Add **What to Test** notes (same as Android template)

## Beta testers guide

Share with testers:

1. Install from Play internal link or TestFlight invite
2. Use staging credentials if `CAPACITOR_SERVER_URL` points to staging
3. Test: install → login → order → payment → wallet → logout → reinstall (upgrade path)
4. Rider/Merchant: use web portals until dedicated shells ship

## Environment URLs

| Track           | `CAPACITOR_SERVER_URL`             |
| --------------- | ---------------------------------- |
| Production beta | `https://app.dripplex.com`         |
| Staging beta    | `https://app.staging.dripplex.com` |

Set in CI workflow_dispatch or local `.env` before `cap sync`.
