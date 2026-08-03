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

| Component                                   | Status |
| ------------------------------------------- | ------ |
| `SuperAppFontProvider` / `useSuperAppFonts` | Locked |
| `SuperAppSkeleton`                          | Locked |
| `SuperAppSectionHeader`                     | Locked |
| `SuperAppStatusBarIcons`                    | Locked |
| `SuperAppBottomNav`                         | Locked |
| `SuperAppAIFab`                             | Locked |
| `SuperAppAISheet`                           | Locked |
| `SuperAppAvatar`                            | Locked |
| `SuperAppNotificationBell`                  | Locked |
| `SuperAppGreetingHeader`                    | Locked |
| `SuperAppSearchBar`                         | Locked |
| `SuperAppHeader`                            | Locked |
| `SuperAppServiceTabs`                       | Locked |
| `SuperAppWalletActions`                     | Locked |
| `SuperAppBalanceCard`                       | Locked |
| `SuperAppQuickActionsGrid`                  | Locked |
| `SuperAppCategoryGrid`                      | Locked |
| `SuperAppHorizontalSection`                 | Locked |
| `SuperAppMerchantCard`                      | Locked |
| `SuperAppRecommendationCard`                | Locked |
| `SuperAppActivityList`                      | Locked |
| `SuperAppPromoCarousel`                     | Locked |
| `SuperAppAIWidget`                          | Locked |

## Marketplace module — In progress

Tracked here as components land; see `docs/reference/figma-super-app-source/marketplaceScreen.tsx`
(entry screen) and the sibling `storeScreen.tsx` / `productDetailScreen.tsx` /
`cartScreen.tsx` / `checkoutScreen.tsx` / `trackingScreen.tsx` for the rest
of the module, ported in slices.
