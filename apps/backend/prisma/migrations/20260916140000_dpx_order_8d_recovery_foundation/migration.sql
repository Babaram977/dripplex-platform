-- CreateEnum
CREATE TYPE "OrderRecoveryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_FINANCIAL_RETRY', 'AWAITING_INVESTIGATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderRecoveryTrigger" AS ENUM ('OPERATOR', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "OrderRecoveryFinancialOutcome" AS ENUM ('UNDETERMINED', 'NONE_DUE', 'REVERSAL_CONFIRMED', 'REVERSAL_FAILED', 'MANUAL_REQUIRED');

-- CreateEnum
CREATE TYPE "OrderInvestigationStatus" AS ENUM ('NOT_REQUIRED', 'OPEN', 'EVIDENCE_GATHERED', 'CONCLUDED_PAID', 'CONCLUDED_UNPAID', 'CONCLUDED_UNVERIFIABLE');

-- CreateEnum
CREATE TYPE "OrderRecoveryActionType" AS ENUM ('CANCEL_ORDER', 'WALLET_REVERSAL', 'GATEWAY_VERIFICATION', 'MERCHANT_CONTACT', 'CUSTOMER_CONTACT', 'EVIDENCE_ADDED', 'NOTIFICATION_SENT', 'FINDING_RECORDED', 'RECOVERY_CLOSED');

-- CreateEnum
CREATE TYPE "OrderRecoveryActionOutcome" AS ENUM ('SUCCEEDED', 'FAILED', 'NO_OP');

-- CreateTable
CREATE TABLE "order_recoveries" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_exception_id" UUID,
    "status" "OrderRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "OrderRecoveryTrigger" NOT NULL,
    "opened_by_id" UUID,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method_at_open" "OrderPaymentMethod",
    "payment_status_at_open" "PaymentStatus" NOT NULL,
    "financial_outcome" "OrderRecoveryFinancialOutcome" NOT NULL DEFAULT 'UNDETERMINED',
    "investigation_status" "OrderInvestigationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "predates_recovery_implementation" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" UUID,
    "closing_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_recovery_actions" (
    "id" UUID NOT NULL,
    "recovery_id" UUID NOT NULL,
    "type" "OrderRecoveryActionType" NOT NULL,
    "outcome" "OrderRecoveryActionOutcome" NOT NULL,
    "automatic" BOOLEAN NOT NULL,
    "actor_id" UUID,
    "payment_transaction_id" UUID,
    "wallet_ledger_entry_id" UUID,
    "support_ticket_id" UUID,
    "order_payment_proof_id" UUID,
    "notification_id" UUID,
    "detail" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_recovery_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_recoveries_order_id_key" ON "order_recoveries"("order_id");

-- CreateIndex
CREATE INDEX "order_recoveries_status_idx" ON "order_recoveries"("status");

-- CreateIndex
CREATE INDEX "order_recoveries_investigation_status_idx" ON "order_recoveries"("investigation_status");

-- CreateIndex
CREATE INDEX "order_recoveries_opened_at_idx" ON "order_recoveries"("opened_at");

-- CreateIndex
CREATE INDEX "order_recoveries_predates_recovery_implementation_idx" ON "order_recoveries"("predates_recovery_implementation");

-- CreateIndex
CREATE INDEX "order_recovery_actions_recovery_id_idx" ON "order_recovery_actions"("recovery_id");

-- CreateIndex
CREATE INDEX "order_recovery_actions_type_idx" ON "order_recovery_actions"("type");

-- CreateIndex
CREATE INDEX "order_recovery_actions_created_at_idx" ON "order_recovery_actions"("created_at");

-- AddForeignKey
ALTER TABLE "order_recoveries" ADD CONSTRAINT "order_recoveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recoveries" ADD CONSTRAINT "order_recoveries_order_exception_id_fkey" FOREIGN KEY ("order_exception_id") REFERENCES "order_exceptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recoveries" ADD CONSTRAINT "order_recoveries_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recoveries" ADD CONSTRAINT "order_recoveries_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_recovery_id_fkey" FOREIGN KEY ("recovery_id") REFERENCES "order_recoveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_wallet_ledger_entry_id_fkey" FOREIGN KEY ("wallet_ledger_entry_id") REFERENCES "wallet_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_order_payment_proof_id_fkey" FOREIGN KEY ("order_payment_proof_id") REFERENCES "order_payment_proofs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_recovery_actions" ADD CONSTRAINT "order_recovery_actions_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

