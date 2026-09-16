-- DPX-ORDER-8D-RECOVERY Increment 3 — the two database invariants the founder
-- ruled on 2026-09-16, before any code can record a wallet reversal.
--
-- A separate migration rather than an edit to
-- 20260916140000_dpx_order_8d_recovery_foundation: that migration has already
-- been applied to development databases and pushed, and this programme does not
-- modify an applied migration file. Replaying from zero yields the same end
-- state either way.

-- 1. The reversal reference must not be able to disappear.
--
-- SET NULL meant a deleted ledger entry would silently null the reference on a
-- recovery action that claims to BE the successful reversal, leaving a refund
-- claim in the case file with nothing behind it. Nothing in production deletes
-- a wallet ledger entry, so RESTRICT reinforces an invariant the code already
-- keeps. Note the consequence, which is intended: a wallet whose ledger entry
-- is cited by a recovery action can no longer be deleted either, because
-- wallet_ledger_entries cascades from wallets and RESTRICT aborts that cascade.
ALTER TABLE "order_recovery_actions"
  DROP CONSTRAINT "order_recovery_actions_wallet_ledger_entry_id_fkey";

ALTER TABLE "order_recovery_actions"
  ADD CONSTRAINT "order_recovery_actions_wallet_ledger_entry_id_fkey"
  FOREIGN KEY ("wallet_ledger_entry_id") REFERENCES "wallet_ledger_entries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. A wallet reversal cannot lie about whether money moved.
--
--   WALLET_REVERSAL + SUCCEEDED  =>  a ledger entry MUST be cited
--   WALLET_REVERSAL + NO_OP      =>  no ledger entry may be cited (a replay:
--                                    the credit was already there, we did not
--                                    make it)
--   WALLET_REVERSAL + FAILED     =>  no ledger entry may be cited
--
-- The application enforces the same rule at the point the notification is
-- built, which is where it produces a readable error. This is the last line of
-- defence: it makes the malformed row unwritable, so no future caller — or
-- future increment — can persist a refund claim without its evidence.
-- Deliberately scoped to WALLET_REVERSAL; other action types are unconstrained
-- because no ruling covers them yet.
ALTER TABLE "order_recovery_actions"
  ADD CONSTRAINT "order_recovery_actions_wallet_reversal_ledger_truth"
  CHECK (
    "type" <> 'WALLET_REVERSAL'
    OR (
      CASE
        WHEN "outcome" = 'SUCCEEDED' THEN "wallet_ledger_entry_id" IS NOT NULL
        ELSE "wallet_ledger_entry_id" IS NULL
      END
    )
  );
