# DrippleX Customer — Mobile Shell

Capacitor 7 wrapper for **customer-web** store distribution (Android AAB/APK, iOS TestFlight).

Loads the deployed web app via `CAPACITOR_SERVER_URL` (default `https://app.dripplex.com`).

## Quick start

```bash
pnpm install
export CAPACITOR_SERVER_URL=https://app.dripplex.com
pnpm exec cap sync
pnpm exec cap open android   # or ios (macOS)
```

## Build

```bash
bash ../../scripts/mobile/build-android.sh
```

## Docs

- `docs/mobile/ANDROID.md`
- `docs/mobile/IOS.md`
- `docs/PROGRAM-D4.md`
