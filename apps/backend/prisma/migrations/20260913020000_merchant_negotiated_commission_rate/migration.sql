-- DPX-MERCHANT-016 — a commission rate agreed with one merchant.
--
-- Founder decision 2026-09-11, extending to merchants what Fleet and
-- CommissionAccount.negotiated_credit_limit already had. Until now every
-- merchant shared one platform-wide rate, and the only way to give a single
-- shop a different one was a commission campaign — a time-boxed instrument
-- being used to express a standing agreement.
--
-- Nullable with no default on purpose: NULL means "no agreement, use the
-- singleton", which is a different statement from any number, and it is what
-- keeps the singleton meaningful. Every existing merchant is therefore
-- untouched by this migration and keeps the rate they already had.
ALTER TABLE "merchant_profiles"
  ADD COLUMN "negotiated_rate" DECIMAL(5,4),
  ADD COLUMN "negotiated_by" UUID,
  ADD COLUMN "negotiated_at" TIMESTAMP(3),
  ADD COLUMN "negotiation_note" VARCHAR(500);
