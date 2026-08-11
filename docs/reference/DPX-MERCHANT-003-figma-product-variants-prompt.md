# Figma Make prompt — Merchant "Products" editor: base price + variants + inventory (DPX-MERCHANT-003)

Paste the block below into **Figma Make** (the DrippleX super-app file). It brings
the **Merchant Portal → Products** frames up to parity with the code that shipped
in PR #110 (base price + variants), so the design file stays the visual source of
truth. This is code-first / Figma-parity-after — the same pattern as the rider
documents screen (DPX-RIDER-002).

Do **not** paste a file path — Figma Make is sandboxed and can't read the repo.
Paste the prompt text itself.

---

## Prompt

Update the **Merchant Portal → Products** screen (`ProductsPage` in
`merchantScreen.tsx`) and its **Add / Edit Product** modal. Reuse the **exact
existing merchant design system** — do not invent new styles, colours, or
components. Reuse the existing `MxCard`, `MxInput`, `MxSelect`, `MxBtn`, `MxChip`,
`Modal`, `SectionHead` components and the `.mx-toggle` switch, and the existing
`NAVY_BASE`, `NAVY_CARD`, `NAVY_SURFACE`, `BORDER`, `MUTED`, `WHITE`, `G0`, `G2`,
`G3` (green accents), `C_ERR` (red), `C_WARN` (amber) tokens with `PP` (Poppins)
and `IT` (Inter). Same dark-navy surfaces, 8px radii, and spacing as the rest of
the merchant portal.

### 1. Products list (grid of `MxCard`)

Keep the existing 3-column product grid. Each card, top to bottom:

- Image banner (or a 🍛 placeholder on `NAVY_SURFACE` when there's no image).
- **Name** (Poppins 13/700, white) with a sub-line (Inter 11, `MUTED`):
  `Category name · N variants` — show the `· N variants` suffix only when the
  product has variants.
- **Base price** on the right (Poppins 13/700, `G3`), formatted `₦1,800`.
- Status chips row (`MxChip`): `Out of stock` (`C_WARN`), `Hidden` (`MUTED`),
  or `Live` (`G3`) when published **and** in stock.
- Two labelled `.mx-toggle` rows: **In stock** and **Published**.
- `Edit` (`outline`) + `Delete` (`danger`) small buttons.

The `SectionHead` sub-line reads `X published · Y out of stock`, with a
`+ Add Product` primary button on the right.

### 2. Add / Edit Product modal (`Modal`)

Title `Add New Product` or `Edit Product`. Fields, in order:

1. `MxInput` **Product Name \*** — placeholder "e.g. Jollof Rice".
2. `MxSelect` **Category** — populated from real categories (a dropdown of
   category names; there is no free-text category any more).
3. `MxInput` **Base price (₦) \*** — number, placeholder "e.g. 1800".
4. `MxInput` **SKU (optional)** — placeholder "e.g. JOL-001".
5. `MxInput` **Description (optional)**.

Then a **Variants** panel on `NAVY_SURFACE` with a `BORDER`, shown **only when
editing an existing product** (variants attach to a saved product):

- Heading "Variants" (Poppins 13/700) + helper (Inter 11, `MUTED`):
  "Add sizes or options. Leave price blank to use the base price."
- A list of existing variant rows, each on `NAVY_CARD`:
  `Name · SKU` on the left; on the right the price (Poppins 12/600, `G3`) showing
  the override `₦2,500` or the literal text **"Base price"** when there's no
  override; then a small `Remove` link in `C_ERR`.
- An add-variant row: a wide `MxInput` **Name** ("e.g. Large"), a narrow
  `MxInput` **Price ₦** ("opt."), and a small `outline` **Add** button
  (disabled until a name is typed).
- When there are no variants yet, show "No variants yet." in `MUTED`.

When adding a **new** product (not yet saved), replace the Variants panel with an
info box on `NAVY_SURFACE`:
"Save the product first to add size/price variants and manage images."

Footer: `Cancel` (`outline`) + a primary `Add Product` / `Save Changes` button,
disabled until Name and Base price are filled.

### 3. Two future placeholders (design only, keep inert)

- A **product image** upload control in the editor (drag-drop / "Upload photo").
  The backend supports product images, but there is no image-management UI yet —
  design it, leave it inert.
- An optional **Inventory quantity** field (number) in the editor with a
  "Track inventory" toggle. Backend-supported (`/inventory`), not yet wired.

Do **not** add per-variant stock, a variant "active" toggle switch, or a discount
field — those aren't in the pilot merchant model. A variant is just a **name + an
optional price override + optional SKU**.

---

## Contract this mirrors (already live in code, PR #110)

The shipped implementation talks to the real backend `ProductDto`:

- Price is `basePrice` + per-variant `priceOverride` (variants carry no stock).
- Publish is a status transition (`/publish`, `/unpublish`), not a field.
- Stock is `inventory.manuallyDisabled` via `/stock-status`.
- Category is a `categoryId` UUID chosen from `GET /categories`.
- Variants are CRUD'd via `/merchant/products/:id/variants`.

## Why this exists

PR #110 shipped the base-price + variants wiring in code because **Figma has no
merchant variant/inventory frames**. This prompt brings the Figma file up to
parity so design stays the source of truth. See
`docs/reference/DPX-FIGMA-DIFF-REGISTER.md` (DPX-MERCHANT-003) for the logged
deviation and the still-deferred image-upload / per-variant-inventory items.
