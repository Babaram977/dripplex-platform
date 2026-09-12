-- DPX-PROMO-REF-001 — a points award keyed on a reference happens once.
--
-- The wallet ledger has carried
-- `@@unique([walletId, referenceType, referenceId])` since it shipped. The
-- points ledger carried only an index. That asymmetry did not matter while
-- nothing paid money in points; increment 4 of this feature started paying
-- campaign promoters in DX Points, and `pay()` is not one transaction — it
-- credits, then flips APPROVED -> PAID. A process that died between the two,
-- or a second sweep running concurrently, re-awarded the whole reward. The
-- wallet refused the duplicate credit. The points ledger accepted it.
--
-- `type` is part of the key rather than omitted because `reversePointsFor`
-- writes its REVERSED entry against the same reference as the BONUS it undoes.
-- A three-column key would make every reward permanently irreversible.
--
-- Rows with a null `reference_id` — Operations adjustments, redemptions — are
-- unaffected: Postgres treats nulls in a unique tuple as distinct, so any
-- number of them coexist. That is the behaviour those rows require.

-- Fail closed on pre-existing duplicates.
--
-- If this database already contains two awards under one reference, somebody
-- has already been paid twice and creating the index would fail with a bare
-- constraint-violation error naming nothing useful. Refusing first, with the
-- count and an example, turns a confusing deploy failure into a finding. The
-- migration runs in one transaction, so raising here leaves no partial DDL.
DO $$
DECLARE
  duplicate_groups INTEGER;
  sample TEXT;
BEGIN
  SELECT COUNT(*), MIN(account_id::text || ' / ' || reference_type || ' / ' || reference_id::text)
    INTO duplicate_groups, sample
  FROM (
    SELECT account_id, reference_type, reference_id, type
    FROM loyalty_ledger_entries
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
    GROUP BY account_id, reference_type, reference_id, type
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'loyalty_ledger_entries already holds % duplicated (account, reference, type) group(s) — first: %. Each is a points award that was granted more than once for the same event. Resolve these with the founder before applying uniqueness; do not delete ledger rows to make this pass.',
      duplicate_groups, sample;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_ledger_entries_account_reference_kind_key" ON "loyalty_ledger_entries"("account_id", "reference_type", "reference_id", "type");
