# DPX-UI — Zero-visual-delta token adoption register

Status of design-token **adoption** in the shared UI kit, and the gaps this pass
deliberately recorded instead of closing. Written during the token-adoption pass
of 2026-09-12 (`feat/ui-token-adoption`).

## Rule this pass was held to (founder, 2026-09-12)

> We are not allowed to redesign anything under the label of "token adoption."
> Do not change the visual design, dimensions, proportions, spacing
> relationships, typography sizes, icon sizes, component structure, or layout
> behaviour. This is strictly a token substitution/adoption pass. If Figma
> currently measures 52px, 20px, 16px, only replace the hardcoded value with an
> existing token that resolves to that exact same value. Do not choose a
> different token because it seems more compact, cleaner, or more consistent. If
> no existing token exactly represents the current measured value, leave the
> value unchanged and report it. Do not invent a new token or alter the
> measurement. The objective is zero visual change. Figma remains the visual
> source of truth. Any proposed visual/density change belongs in a separate
> design-change pass requiring approval. Before/after computed CSS values must be
> compared; the PR should demonstrate that token substitution produces the same
> rendered dimensions as before.

The pass is therefore **zero-visual-delta token adoption**, not "UI density
improvement". Everything under "Open" below is a decision for the founder or a
later increment, not an oversight. Nothing under "Open" was acted on.

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

`px-5` emits `1.25rem` and `px-page` emits `20px`. Same 20 pixels at the root font
size in force, so nothing renders differently today. The full before/after and the
reasoning are in §5.1, including the one-line alternative if byte-identical units
are preferred.

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

### 5.1 Before/after computed CSS — the substitution demonstration

Both columns are emitted by the Tailwind CLI run against `customer-web`'s own
`tailwind.config.ts`, on the commit before and the commit after.

| Site                      | Before (class → declaration)           | After (class → declaration)            | Rendered                                 |
| ------------------------- | -------------------------------------- | -------------------------------------- | ---------------------------------------- |
| Status-bar inset, 6 sites | `pt-[52px]` → `padding-top: 52px`      | `pt-status-bar` → `padding-top: 52px`  | identical, byte for byte                 |
| Page gutter, 35 sites     | `px-5` → `padding-left/right: 1.25rem` | `px-page` → `padding-left/right: 20px` | identical at the root font size in force |

No stylesheet in the repo sets a root `font-size`, so `1rem` is the browser
default 16px and `1.25rem` is exactly the 20px that `PAGE_H_PADDING` holds and
that Figma measures. The unit changed; the measurement did not.

That unit change is the single place this pass is not literally byte-identical,
so it is stated rather than buried. It is faithful to the rule as written — the
measured value is 20px and `PAGE_H_PADDING = 20` is a px token — and it matches
the surrounding code, which is a fixed-width phone frame (`PHONE_W = 390`) whose
every other dimension (`h-[52px]`, `text-[11px]`, the 200px cover band) is already
px. The two diverge only if a user raises their browser's base font size, where
the gutter would previously have grown while the content beside it did not.

If the founder would rather the emitted CSS be byte-identical including the unit,
that is one line in `tailwind.preset.ts` (`page: '1.25rem'`) and no change to any
component.

### 5.2 The whole emitted-CSS diff

Running the Tailwind CLI on `customer-web`'s config before and after produces
exactly two differences in the entire stylesheet — the two rules above. Nothing
else in the emitted CSS moved.

### 5.3 The whole source diff

Every changed line in every component differs **only** in `px-5` → `px-page` or
`pt-[52px]` → `pt-status-bar`. No element, prop, structure, typography class,
icon size, radius, height, width, gap or margin was touched; the rest of each
className string is carried across unchanged. This is machine-checked, not
asserted: filtering the component diff for any changed token other than those two
returns nothing.

The only other source changes are the `spacing` extension in
`tailwind.preset.ts`, the `FAB_BOTTOM` import in `homeScreen.tsx`, and one stale
doc comment in `ProductGrid.tsx` that named a class which no longer exists.

### 5.4 Suites

- `packages/ui`: typecheck, lint, vitest — green.
- `customer-web`: typecheck, lint, `next build` — green.
- `super-app`: typecheck, `vite build` — green.
- Re-run after lint-staged reformatted 35 files during the commit, per the
  standing rule that a pre-commit reformat invalidates the run before it.
- `customer-web`'s real production build emits
  `.px-page{padding-left:20px;padding-right:20px}` and
  `.pt-status-bar{padding-top:52px}`, with zero occurrences of `.pt-\[52px\]`.
