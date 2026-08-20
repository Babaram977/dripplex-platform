-- A credit limit agreed with one partner individually, rather than a single
-- platform-wide ceiling for every merchant. Nullable: existing accounts have
-- negotiated nothing and keep falling back to the owner-type default, so this
-- migration changes no partner's effective limit.
ALTER TABLE "commission_accounts" ADD COLUMN "negotiated_credit_limit" DECIMAL(14,2);
ALTER TABLE "commission_accounts" ADD COLUMN "negotiated_by" UUID;
ALTER TABLE "commission_accounts" ADD COLUMN "negotiated_at" TIMESTAMP(3);
ALTER TABLE "commission_accounts" ADD COLUMN "negotiation_note" VARCHAR(500);
