CREATE UNIQUE INDEX "wallet_ledger_entries_wallet_id_reference_type_reference_id_key"
ON "wallet_ledger_entries"("wallet_id", "reference_type", "reference_id")
WHERE "reference_id" IS NOT NULL;
