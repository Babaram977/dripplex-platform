-- DPX-COMMERCIAL-001 Slice 1: optimistic-concurrency guard on
-- CommissionAccount.outstandingBalance, same pattern as Wallet.version.

-- AlterTable
ALTER TABLE "commission_accounts" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
