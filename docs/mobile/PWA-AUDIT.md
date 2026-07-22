# PWA audit — customer-web (Program D4)

Scope: `apps/customer-web` only. Merchant, rider, admin portals are **web-only** (no manifest/SW in D4).

## Checklist

| Requirement                    | Status            | Notes                                                                  |
| ------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| Web App Manifest               | ✅                | `public/manifest.webmanifest`                                          |
| Service worker                 | ✅                | `public/sw.js` — network-first + offline fallback                      |
| Offline support                | ⚠️ Partial        | Offline page only — not full commerce cache (by design, C4)            |
| Install prompt                 | ⚠️ Browser-native | No custom `beforeinstallprompt` UI (no UI redesign in D4)              |
| Background sync                | ❌                | Not implemented — future phase                                         |
| Push notifications (web)       | ❌                | Requires backend VAPID + SW push handler                               |
| Theme colours                  | ✅                | `#0E7A3E` / `#F4F6F8` in manifest + viewport                           |
| Shortcuts                      | ✅                | Dashboard, Orders, Wallet (D4)                                         |
| Maskable icon                  | ⚠️                | SVG declared as maskable — **PNG 192/512 recommended** for Chrome      |
| Apple touch icon               | ⚠️                | Points to SVG — **apple-touch-icon.png 180×180** needed for iOS Safari |
| `metadataBase` + manifest link | ✅                | `layout.tsx`                                                           |
| SW registration                | ✅                | `ServiceWorkerRegister` component                                      |

## Lighthouse / installability gaps

1. **Raster icons** — maskable PNG set missing (`TODO(brand-assets)`).
2. **Screenshots** in manifest — optional; not added (await store captures).
3. **Web push** — not wired; native push via Capacitor is the D4 path.
4. **Background sync** — deferred.

## Recommendation

**Installable PWA (basic)** on Chromium/Android with current manifest. **Polished install** (iOS Add to Home Screen, Play Trusted Web Activity alternative) blocked on official PNG icons.

## Merchant / Rider / Admin

Not in PWA scope for RC1. Use Capacitor shells (see `MERCHANT-RIDER-PACKAGING.md`) or responsive web for beta.
