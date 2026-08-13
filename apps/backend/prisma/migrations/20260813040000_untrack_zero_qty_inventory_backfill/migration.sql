-- DPX-MERCHANT: un-stick products that were born out-of-stock.
--
-- Products created before this change got inventory with `track_inventory = true`
-- (the schema default) and `quantity = 0`, and the merchant "In stock" toggle
-- only ever wrote `manually_disabled` — which no availability check read. The
-- result: every such product computed as out-of-stock forever, and could not be
-- ordered, regardless of the merchant publishing it and toggling it "In stock".
--
-- New products now default to `track_inventory = false` (in stock unless the
-- merchant marks it out of stock). This backfill applies the same intent to the
-- existing rows that are stuck: inventory that is tracked but has zero quantity
-- was never a deliberate "tracked, sold out" state (that would be reached by
-- selling stock down, and out-of-stock is expressed via `manually_disabled`) —
-- it is purely the buggy default. Flip those to untracked so they become
-- sellable. Rows with real tracked quantity (> 0) and any explicitly
-- out-of-stock rows (`manually_disabled = true`) are left untouched.
UPDATE "product_inventory"
SET "track_inventory" = false,
    "updated_at" = now()
WHERE "track_inventory" = true
  AND "quantity" = 0;
