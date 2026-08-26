-- DPX-MOBILE-002 — in-app voice calling, backend half.
--
-- Hand-narrowed from `prisma migrate diff`, deliberately. The full diff between
-- the migration history and schema.prisma also contains changes that predate
-- this work and belong to nobody here — an index on orders(order_number), one
-- on promotions(domains), a unique on wallet_ledger_entries, foreign keys on
-- room_types/bookings, and two index renames. That pre-existing drift is real
-- and worth fixing, but sweeping it into an unrelated migration would hide it
-- inside a calling feature and make this migration impossible to revert
-- cleanly. Only the `calls` statements are below.

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'DECLINED', 'MISSED', 'FAILED', 'ENDED');

-- CreateEnum
CREATE TYPE "CallEndedReason" AS ENUM ('CALLER_HANGUP', 'CALLEE_HANGUP', 'DECLINED', 'TIMEOUT', 'CONNECTION_FAILED');

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "context_type" "MessageContextType" NOT NULL,
    "context_id" UUID NOT NULL,
    "caller_id" UUID NOT NULL,
    "callee_id" UUID NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "ended_reason" "CallEndedReason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_context_type_context_id_created_at_idx" ON "calls"("context_type", "context_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_callee_id_status_idx" ON "calls"("callee_id", "status");

-- CreateIndex
CREATE INDEX "calls_caller_id_created_at_idx" ON "calls"("caller_id", "created_at");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_id_fkey" FOREIGN KEY ("callee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
