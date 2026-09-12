# DPX-UI — Token adoption register

Status of design-token **adoption** in the shared UI kit, and the gaps this pass
deliberately recorded instead of closing. Written during the token-adoption pass
of 2026-09-12 (`feat/ui-token-adoption`).

Scope of that pass was adoption only: replace a hardcoded number with the token
that already holds the same number. It changed no rendered dimension and made no
design decision. Everything under "Open" below is a decision for the founder or a
later increment, not an oversight.

---

## 1. Baseline — what adoption actually looked like before the pass

`packages/ui/src/tokens/` has held a complete scale for some time: `colors`,
`typography` (`TYPE`, `WEIGHT`, `LINE`), `spacing` (`SPACE`, plus semantic
`PAGE_H_PADDING`, `CARD_PADDING`, `SECTION_GAP`, `ITEM_GAP`, `CHIP_GAP`,
`STATUS_BAR_H`, `BOTTOM_NAV_H`, `FAB_BOTTOM`), `radius` and `elevation`.

Measured against the code rather than against the file's existence:

| Token family        | Imports from `packages/ui/src/components/**` |
| ------------------- | -------------------------------------------- |
| `tokens/colors`     | 63                                           |
| `tokens/spacing`    | **0**                                        |
| `tokens/typography` | **0**                                        |
| `tokens/radius`     | **0**                                        |
| `tokens/elevation`  | **0**                                        |

Colours were adopted. Every other family was defined and then never referenced —
so the numbers in `spacing.ts`, `typography.ts`, `radius.ts` and `elevation.ts`
described the design but did not drive it. `packages/ui/tailwind.preset.ts`
carried colours, fonts, radius variables, shadows and animation but no `spacing`
and no `fontSize`, so a className had no token to name and fell back to a literal.

This is the reason an earlier claim that "no design tokens exist" was wrong in
the way that matters: they exist, they are already compact, and they are unused.

## 2. Closed by this pass

- **`pt-[52px]` → `pt-status-bar`** (6 sites: `AuthChrome`, `Header`,
  `MarketplaceHeader`, `RideChrome`, `StoreHeader`, and the duplicate of the Ride
  status bar in `apps/customer-web/src/components/ride/ride-ui.tsx`). The
  arbitrary value `pt-[52px]` no longer appears in customer-web's built CSS at
  all. Emitted declaration is `padding-top:52px` before and after.
- **Page-level `px-5` → `px-page`** (34 sites in `packages/ui`, 1 in
  customer-web). Classified per site, not replaced mechanically: card, chip,
  button and input internals that are legitimately 20px were left on `px-5`
  (`AuthRegisterScreen` card body, `AuthWelcomeScreen` button, `RideAmountChips`
  chip, both `RideDetailCard` rows).
- **`FAB_BOTTOM` redeclared as a local `94`** in
  `apps/super-app/src/app/homeScreen.tsx`, while its sibling `storeScreen.tsx`
  imported the same value from `tokens/spacing`. Now imported.
- **`tailwind.preset.ts` gained a `spacing` extension** whose two keys are read
  from `src/tokens/spacing.ts` (`PAGE_H_PADDING`, `STATUS_BAR_H`). This is not a
  second scale — it introduces no number — it is the existing scale made
  reachable from a className, which is what "adoption" required. Card and chip
  padding were deliberately **not** given names: they are internal spacing, and
  naming them alongside the gutter would imply they move together.

### One honest consequence, not a silent change

`px-5` is Tailwind's own step and emits `1.25rem`; `px-page` emits `20px`. At the
default 16px root these are the same 20 pixels, and no stylesheet in the repo
overrides the root font size, so nothing renders differently today. They diverge
only if a user raises their browser's base font size, where the old gutter would
grow and the new one will not.

That is a real difference and it is reported rather than buried. It is also the
behaviour the surrounding code already has: these are fixed-width phone-frame
screens (`PHONE_W = 390`) whose every other dimension — `h-[52px]`, `text-[11px]`,
the 200px cover band — is px. A gutter that scaled while the content beside it did
not would break the frame, so px is the consistent choice and the rem was
incidental. If the founder wants the gutter to scale with user font size, that is
a deliberate accessibility decision and should be taken for the whole frame at
once, not for the gutter alone.

## 3. Open — recorded, not decided

### 3.1 The `px-4` / `px-5` page-gutter divergence

Structurally identical roles are indented 16px in some components and 20px in
others. This is a **visual** inconsistency: closing it moves pixels, so it is a
founder/Figma decision and this pass changed none of it.

| Role                 | 20px (`px-page`)                                                                              | 16px (`px-4`)                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Horizontal chip rail | `CategoryChips`                                                                               | `TextChips`, `WalletFormControls`                                              |
| Quick-actions grid   | `QuickActionsGrid`                                                                            | `WalletQuickActionsGrid`                                                       |
| Section wrapper      | `ProductDescription`, `ProductVariantSelector`, `ProductQuantityRow`, `ProductReviewsSection` | `ProductGrid`, `ReviewsSection`, `AccordionCard`, `InfoList`, `StoreSearchBar` |
| Within one component | `StoreHeader` status row (line 61)                                                            | `StoreHeader` overlay row (line 81)                                            |

It has already cost a component reuse. `ProductGrid` carries this comment:

> the header row here has no padding of its own in the source — it inherits
> `px-4` from this same wrapper — so it's written inline rather than via
> `SuperAppSectionHeader`, which carries its own `px-page` gutter and would
> double-indent/mismatch the spacing if nested here.

So the divergence is not cosmetic: `SuperAppSectionHeader` cannot be used inside
a `px-4` wrapper, and a second header was hand-written to work around it. Now
that the 20px sites name the token, resolving this is a one-line token change
plus a decision about which of the 16px sites are page-level.

### 3.2 Token drift between the two token trees

`apps/super-app/src/tokens/` and `packages/ui/src/tokens/` are near-duplicates
that have already diverged:

- `BOTTOM_NAV_PB` is `'max(env(safe-area-inset-bottom), 24px)'` (a string, with a
  real safe-area fix and a documented rationale) in the app copy, and the plain
  number `24` in the package copy.
- `animations.ts` differs only in `String()` wrapping.

The package copy is the stale fork. It is not currently a live defect **because
`packages/ui`'s `BOTTOM_NAV_PB` has zero consumers** — but that is exactly the
trap: the first component to adopt it silently regresses the safe-area fix.
Reconciling the two trees changes a token's type from `number` to `string`, which
is an API change, so it is recorded here rather than folded into an adoption pass.

### 3.3 Families still at zero adoption

`typography`, `radius` and `elevation` are still referenced by nothing. Adopting
them is not like the spacing pass: component literals such as `text-[14px]`,
`text-[11.5px]`, `rounded-[14px]` and `rounded-[10px]` do **not** all land on an
existing token step, so adoption would require either new steps or snapping values
to the nearest step — and snapping moves pixels. Each needs a decision, so none
were touched.

### 3.4 `tailwind.preset.ts` is outside its own package's checks

`packages/ui`'s `lint` script globs `src/**/*.{ts,tsx}` and its `tsconfig.json`
includes only `src/**/*`, so the preset — which five apps load — is neither linted
nor typechecked by the package that owns it. It typechecks cleanly under a
standalone `tsc` today. Widening the globs is a build-config change and was left
out of a UI pass.

## 4. Not in scope, on the founder's instruction

`StoreHeader`'s 200px cover band, its `pt-status-bar` inset and its `-mt-5` card
overlap are unchanged. They were verified line-for-line against the locked Figma
source at `docs/reference/figma-super-app-source/storeScreen.tsx` (height 200,
`pt-[52px]`, `mx-4 -mt-5 rounded-3xl p-4` — identical), so the density of that
screen is approved design, not a porting defect. No Figma deviation is recorded
for it. Any redesign is a separate phase with a Figma decision behind it.

## 5. Verification performed

- `packages/ui`: typecheck, lint, vitest — green.
- `customer-web`: typecheck, lint, `next build` — green.
- `super-app`: typecheck, `vite build` — green.
- Tailwind CSS emitted from `customer-web`'s real production build:
  `.px-page{padding-left:20px;padding-right:20px}`,
  `.pt-status-bar{padding-top:52px}`, and zero occurrences of `.pt-\[52px\]`.
- The before/after utility diff was taken by running the Tailwind CLI against
  `customer-web`'s own config on both sides; the only difference is the two added
  rules above.
