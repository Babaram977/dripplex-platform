# Super App component maturity (DPX-102)

Every component in this directory carries one status, tracked here as the
single source of truth (not scattered per-file tags, to keep it one place to
check before touching anything):

```
Experimental → Implemented → Verified → Locked
```

- **Experimental** — shape still changing, not yet matched against the
  locked Figma export.
- **Implemented** — ported from the export, not yet browser-verified.
- **Verified** — typecheck/lint clean and confirmed via Playwright
  screenshot against the export with zero console errors.
- **Locked** — founder-approved as pixel-final. Visual properties (color,
  spacing, radius, shadow, typography, animation) and the public prop API
  cannot change without explicit founder approval. Bug fixes (e.g.
  correctness, accessibility, a real defect) are still allowed — "locked"
  protects against redesign drift, not against fixing something broken.

Locking happens per module, after the founder confirms that module's
screens are done — not automatically when a component merges.

## Home module — Locked (2026-08-03)

Founder-confirmed via the DPX-100/DPX-101 Home walkthrough (Playwright
verification, zero console errors, pixel-identical to
`docs/reference/figma-super-app-source/homeScreen.tsx`) as the reference
implementation every other module reuses.

| Component                                   | Status  |
| ------------------------------------------- | ------- |
| `SuperAppFontProvider` / `useSuperAppFonts` | Locked  |
| `SuperAppSkeleton`                          | Locked  |
| `SuperAppSectionHeader`                     | Locked¹ |
| `SuperAppStatusBarIcons`                    | Locked  |
| `SuperAppBottomNav`                         | Locked  |
| `SuperAppAIFab`                             | Locked  |
| `SuperAppAISheet`                           | Locked¹ |
| `SuperAppAvatar`                            | Locked  |
| `SuperAppNotificationBell`                  | Locked  |
| `SuperAppGreetingHeader`                    | Locked  |
| `SuperAppSearchBar`                         | Locked  |
| `SuperAppHeader`                            | Locked  |
| `SuperAppServiceTabs`                       | Locked  |
| `SuperAppWalletActions`                     | Locked  |
| `SuperAppBalanceCard`                       | Locked  |
| `SuperAppQuickActionsGrid`                  | Locked  |
| `SuperAppCategoryGrid`                      | Locked  |
| `SuperAppHorizontalSection`                 | Locked  |
| `SuperAppMerchantCard`                      | Locked  |
| `SuperAppRecommendationCard`                | Locked  |
| `SuperAppActivityList`                      | Locked  |
| `SuperAppPromoCarousel`                     | Locked  |
| `SuperAppAIWidget`                          | Locked  |

¹ Extended additively for Marketplace (new optional params: `subtitle`/
`showSeeAll` on `SectionHeader`, `title`/`subtitle`/`showIcons` on
`AISheet`). All new params default to Home's exact prior values —
re-verified via Playwright after the change that Home's rendering is
byte-for-byte unchanged (see `docs/reference/figma-super-app-source/homeScreen.tsx`
walkthrough, 2026-08-03). Still Locked for Home's own usage; the new
defaults are what's open for a different module's own future reuse.

## Marketplace module — entry screen Verified (2026-08-03)

Ported from `docs/reference/figma-super-app-source/marketplaceScreen.tsx`
(`MarketplaceScreen`, the module's home/entry screen only). Typecheck/lint
clean; Playwright walkthrough (top, mid-scroll, lower, bottom, AI sheet)
shows zero console errors and matches the source. Not yet Locked — pending
founder confirmation, per the same per-module gate Home went through.
Store, Product Detail, Cart, Checkout, and Tracking are separate source
screens (`storeScreen.tsx`, `productDetailScreen.tsx`, `cartScreen.tsx`,
`checkoutScreen.tsx`, `trackingScreen.tsx`) not yet ported.

| Component                                                         | Status                                                                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SuperAppVerifiedBadge`                                           | Verified                                                                                                                          |
| `SuperAppMarketplaceHeader`                                       | Verified                                                                                                                          |
| `SuperAppCategoryChips`                                           | Verified                                                                                                                          |
| `SuperAppAIDiscoveryBanner`                                       | Verified                                                                                                                          |
| `SuperAppDealsCarousel`                                           | Verified                                                                                                                          |
| `SuperAppFeaturedMerchantCard`                                    | Verified                                                                                                                          |
| `SuperAppFeaturedMerchantsSection`                                | Verified                                                                                                                          |
| `SuperAppVerticalListCard`                                        | Verified                                                                                                                          |
| `SuperAppNearbyBusinessRow` / `SuperAppNearbyBusinessSkeletonRow` | Verified                                                                                                                          |
| `SuperAppProductCard`                                             | Verified                                                                                                                          |
| `SuperAppAIRecommendationCard`                                    | Verified                                                                                                                          |
| `SuperAppRecentlyViewedCard`                                      | Verified                                                                                                                          |
| `SuperAppEmptyState`                                              | Verified (ported but not wired into the default screen render — matches the source, which defines it but never renders it either) |
