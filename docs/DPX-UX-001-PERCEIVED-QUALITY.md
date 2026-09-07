# DPX-UX-001 — Perceived quality: composition, loading and chrome

**Status: OBSERVATION REPORT. Not authorized for implementation.**

Nothing in this document may be built without a separate authorization. It exists so that
when the gate opens the work starts from evidence rather than from a memory of a video.

**Gate, per the Programme Lead (2026-09-08):**

```
Google review outcome → UX/design reconciliation → DPX-UX-001 approval
  → implementation scope → CI → independent verification → controlled release
```

## 0. Why this cannot ship while Play review is open

`com.dripplex.app` is a Capacitor **remote-URL shell**: it loads
`https://app.dripplex.com`, which is the deployed super-app. A merge to `main` that
touches `apps/super-app/**` reaches **every installed device immediately**, with no new
AAB and no Play submission.

The build in Google review is versionCode **29811275** (source `2bc11cc`). Its _native_
half is frozen in that artifact. Its _entire user interface_ is not — it is served live.

So a UI change merged today would change what a Google reviewer sees, mid-review, without
changing the thing they are reviewing. That is the reason for the freeze, and it is a
property of the architecture rather than a policy choice.

## 1. Source material

A 106-second screen recording of Talabat (Oman, Android), supplied by the founder
2026-09-08. Reviewed frame by frame at 1 fps — 107 frames — plus full-resolution stills at
t=22 (home), t=77 (store detail) and t=86 (category listing). Observations below cite
timestamps so they can be re-checked against the same recording.

## 2. The finding, stated plainly

**There is no capability gap. There is a composition and discipline gap.**

Measured against the repository, not assumed:

| Machinery         | State                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Skeleton loaders  | **Present** — `Bone` in `homeScreen.tsx:125`, `marketplaceScreen.tsx:119`, and a shared `components/ui/Skeleton.tsx:12` |
| Font loading      | **Correct** — Poppins 400–900 + Inter 400–800, one `<link>` with `preconnect` and `display=swap`, fixed in DPX-HOME-002 |
| Text rendering    | **Correct** — `antialiased`, `font-optical-sizing: auto`, `shape-rendering: geometricPrecision`                         |
| Bottom navigation | **Present** — `BottomNavigation` / `NavTabKey`                                                                          |
| Micro-interaction | **Present** — `transition-all`, `active:scale-[.98]` used throughout                                                    |

None of this needs building. What differs is where it is applied and what occupies the
most valuable space on screen.

### 2.1 A correction to the record

Earlier reports — including the 2026-09-07 platform audit and the Play screenshot grading
— state that the home screen's Quick Actions "carry SOON badges", plural. **That is now
stale.** Read from `homeScreen.tsx:81-98`, seven of the eight tiles are `ready: true`:

| Tile                                                       | State                         |
| ---------------------------------------------------------- | ----------------------------- |
| Marketplace, Ride, Wallet, Orders, Utilities, Food, Hotels | `ready: true`                 |
| **More**                                                   | `ready: false` — the only one |

Utilities became real (a 1,315-line screen against live endpoints) and Hotels displaced the
dead "Health" placeholder on 2026-08-23. The grid is one dead tile, not several. Any future
statement about home should be measured against the array, not carried forward.

**What is still true:** the largest card on both Home and Marketplace is
**"Ask Drip — Coming soon"** (`homeScreen.tsx:1356`, `marketplaceScreen.tsx:1467`,
`productDetailScreen.tsx:1553`, `cartScreen.tsx:1372`). That, not the badges, is what
makes `01-home.png` unshippable as a store screenshot.

## 3. What the recording actually shows

### 3.1 Skeletons shaped like their content, on every transition

t=7, t=30, t=57, t=77, t=95. Grey blocks in the **exact geometry** of what arrives —
category circles as circles, list rows as rows, product tiles as a 2-up grid. Never a
spinner. Never a blank screen. Never a layout shift when data lands, because the skeleton
already reserved the space.

This is the entire mechanism behind "smooth". It is not animation.

### 3.2 Chrome paints before content

On every navigation the back button, the "Deliver to Al Khuwayriyyah" bar and the search
field are present in the first frame; only the content region is skeletoned. The app stays
anchored while it loads. Compare t=76 (skeleton body, full chrome) with t=78 (content
arrived, chrome unmoved).

### 3.3 Layered, sticky store header

t=60–72. A hero photograph scrolls **under** four circular translucent buttons (back,
favourite, share, search). Below it a store card (name, cuisine, rating, ETA, delivery fee,
"Delivered by talabat"), then promotional cards, then a **sticky category tab strip**
("Picks for you 🔥 · Chocolate") with a hamburger opening the full menu. The strip pins to
the top as the body scrolls past it.

### 3.4 Photographic category rail with ring selection

t=22, t=86. Categories are photographs / 3D renders on soft tiles — not flat icons — with
floating badges ("fast", "15% off"). The selected category is marked by a **thin ring**
around its circle, nothing else. Warm, product-led, and impossible to reproduce with a
typeface.

### 3.5 Filter chips beneath the rail

t=86. `Offers · Free delivery · Under 30 mins · pro`. Outline pills, horizontally
scrollable, applied instantly.

### 3.6 Closed stores stay in the list

t=86. Recorded at 12:23am, so most stores are shut. Talabat greys the logo, overlays
**"Closed"**, and keeps the row with its ETA and delivery terms. The list stays dense and
honest instead of collapsing to an empty state at night.

### 3.7 Typography carries the hierarchy

Headings are heavy and large with tight leading ("Redeem and save", "Picks for you 🔥");
sub-lines are regular, grey, and markedly smaller. The _ratio_ between them is what reads
as designed.

### 3.8 Three bottom tabs

Home · Orders · Account. Everything else is reached through content.

### 3.9 A persistent, non-blocking promo bar

"🛵 4 FREE deliveries. Limited time!" sits above the tab bar on every screen with a chevron
to expand. Always visible, never modal.

### 3.10 Illustrated empty states

t=8. "No recent orders / When you place your order, it will appear here" with an
illustration — not a blank list.

## 4. The four principles

Framing set by the Programme Lead; the evidence under each is from this repository.

### P1 — No dead primary surfaces

The most valuable space on a screen must carry something real. Where a feature does not
exist, it should be absent or demoted, never the largest element.

Concretely: "Ask Drip — Coming soon" occupies the largest card on four screens. The honest
"coming soon" copy is correct behaviour and must be preserved — this principle is about
**position and prominence**, not about pretending. The panel can stay; it should not lead.

### P2 — Perceived performance through the existing skeleton system

**Expand `Bone`. Do not invent a second loading mechanism.**

Current coverage, counted:

| Screen                        | Lines | Skeletons | Loading branches |
| ----------------------------- | ----- | --------- | ---------------- |
| `homeScreen`                  | 1,833 | 4         | 0                |
| `marketplaceScreen`           | 1,597 | 6         | 4                |
| `productDetailScreen`         | 1,587 | **0**     | 0                |
| `storeScreen`                 | 1,443 | **0**     | 0                |
| `cartScreen`                  | 1,405 | **0**     | 0                |
| `checkoutScreen`              | 2,288 | **0**     | 0                |
| `rideScreen`                  | 7,362 | **0**     | 2                |
| `walletScreen`                | 3,868 | **0**     | 8                |
| `utilitiesScreen`             | 1,315 | **0**     | 1                |
| `hotelBookingScreens`         | 1,157 | **0**     | 0                |
| `screensB` (profile/security) | 2,843 | **0**     | 1                |
| `screensD` (settings)         | 2,084 | **0**     | 0                |

Two screens have skeletons. Ten do not. `walletScreen` has eight loading branches and no
skeleton at all — the highest-value gap on the list, because a wallet balance resolving into
an empty box is the moment a customer most doubts the app.

**Also noted:** `Bone` is defined three times — twice locally, once in `components/ui`. A
coverage pass should consolidate on the shared component rather than copy it an eleventh
time.

### P3 — Persistent chrome

Header, location bar, search field and bottom navigation should paint before data and not
move when it arrives. This is a rendering-order concern, not a redesign.

### P4 — Inspired, not cloned

Borrow the **interaction principles** — skeleton geometry, sticky section tabs, ring
selection, closed-but-listed, chip filters. Do not borrow Talabat's identity. DrippleX is
green and dX-marked; Talabat is orange. Copying the palette, the torn-paper divider or the
illustration style would be both wrong and legally unwise.

## 5. The ceiling, and the founder decision that has been open since 2026-08-18

This is the most important item in the document, because it is the reason our icons do not
look like Talabat's and **no amount of implementation will change it**.

`DPX-FIGMA-DIFF-REGISTER.md` §"Type and icon rendering — sharpening pass (DPX-HOME-002)"
records that the founder asked for "Talabat standard" on 2026-08-18. A full rendering pass
was done and verified in a browser. Its conclusion, quoted:

> The interface icons are **emoji** (🛒 🍽 💊 in Categories, 🛍 🚖 💳 in Quick Actions).
> Emoji are supplied by the platform, so how sharp they look is decided by the device, not
> by us — no amount of CSS changes that. Talabat's crispness comes from a **commissioned
> vector icon set**, which is a design deliverable, not a rendering setting. […] Raising
> the ceiling needs an icon set added to the Figma first — flagged for founder decision.

**That decision was never taken.** Everything in §3.4 (photographic category rail) and
§3.10 (illustrated empty states) sits behind it. They are design deliverables, not
engineering tasks, and per the engineering playbook §2 the Figma is the visual source of
truth — so this document deliberately specifies **no artwork**. None was invented here.

Two related gaps already on the register: **Utilities** has four screens with no Figma
source (logged 2026-08-18), and **customer hotel booking has no Figma design at all**
(DPX-HOTEL-002, 2026-08-22). Any composition work touching those screens has no design to
reconcile against.

## 6. Candidate scope — ordered, none authorized

Ordered by value per unit of risk. Items 1 and 5–8 need design input; 2–4 do not.

| #   | Change                                                                      | Needs design?     | Risk           | Notes                                                            |
| --- | --------------------------------------------------------------------------- | ----------------- | -------------- | ---------------------------------------------------------------- |
| 1   | Demote "Ask Drip" from the largest card on Home, Marketplace, Product, Cart | Layout — yes      | **Ships live** | Directly fixes the unshippable store screenshot                  |
| 2   | Skeleton coverage: the ten screens in §P2, starting with `walletScreen`     | No                | Low            | Consolidate on `components/ui/Skeleton`                          |
| 3   | Chrome-before-content ordering on every route                               | No                | Low            | Rendering order only                                             |
| 4   | Show closed merchants greyed and listed rather than hidden                  | No                | Low            | Verify the API returns them first                                |
| 5   | Sticky category tab strip on store / merchant detail                        | Yes               | Medium         | New component                                                    |
| 6   | Filter chips on listings (Offers / Free delivery / Under 30 mins)           | Yes               | Medium         | **Backend support unverified** — do not assume the filters exist |
| 7   | Photographic category rail with ring selection                              | **Blocked** on §5 | —              | Artwork deliverable                                              |
| 8   | Illustrated empty states                                                    | **Blocked** on §5 | —              | Artwork deliverable                                              |

Every item that renders in the super-app **ships to production the moment it merges**. None
may proceed while Play review is open.

## 7. What this document is not

- Not an authorization. No code, no assets, no workflow, no schema.
- Not a Figma reconciliation. That is the next step, with the Figma MCP connected, and it
  is where artwork gets specified — by design, not here.
- Not a claim that any of it is required for launch. The Android release candidate is
  PO-confirmed at Gate C 23/23 and in Google review on its own merits.
- Not a Talabat clone brief. See P4.

## 8. Open questions for the founder

1. **The icon set** (§5) — commission a vector set into the Figma, or accept the emoji
   ceiling permanently? Open since 2026-08-18; it gates items 7 and 8.
2. **"Ask Drip"** — demote, or remove until there is a backend? It is currently the largest
   element on four screens.
3. **Utilities and Hotels have no Figma source.** Compose against the register and log the
   difference, or design first?
4. **The `More` tile** — the last `ready: false` control on Home. Give it a destination, or
   remove it?

---

**Related:** `docs/reference/DPX-FIGMA-DIFF-REGISTER.md` (DPX-HOME-001, DPX-HOME-002) ·
`docs/reference/dpx-100-figma-screen-mapping.md` ·
`docs/DPX-AUDIT-001-PLATFORM-REALITY-2026-09-07.md` ·
`apps/customer-mobile/resources/play-screenshots/README.md`
