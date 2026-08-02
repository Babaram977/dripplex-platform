-- AlterEnum
ALTER TYPE "BusinessStatus" ADD VALUE 'PAUSED';

-- AlterEnum (rename existing OrderStatus values onto the new universal lifecycle names)
ALTER TYPE "OrderStatus" RENAME VALUE 'PENDING_PAYMENT' TO 'PENDING';
ALTER TYPE "OrderStatus" RENAME VALUE 'PAID' TO 'CONFIRMED';
ALTER TYPE "OrderStatus" RENAME VALUE 'PROCESSING' TO 'PREPARING';
ALTER TYPE "OrderStatus" RENAME VALUE 'READY_FOR_PICKUP' TO 'READY';
ALTER TYPE "OrderStatus" RENAME VALUE 'OUT_FOR_DELIVERY' TO 'IN_TRANSIT';

-- AlterEnum (new OrderStatus values; FAILED is kept, unused, for backward compatibility — see schema.prisma doc comment)
ALTER TYPE "OrderStatus" ADD VALUE 'DRAFT';
ALTER TYPE "OrderStatus" ADD VALUE 'DRIVER_ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE 'DISPUTED';

-- CreateEnum
CREATE TYPE "OrderCancelledBy" AS ENUM ('CUSTOMER', 'MERCHANT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrderDisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INCOMING', 'OUTGOING', 'RESERVED', 'RELEASED', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "businesses"
  ADD COLUMN "paused_at" TIMESTAMP(3),
  ADD COLUMN "pause_reason" VARCHAR(500);

-- AlterTable
ALTER TABLE "product_inventory"
  ADD COLUMN "manually_disabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "low_stock_notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders"
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ADD COLUMN "estimated_ready_at" TIMESTAMP(3),
  ADD COLUMN "confirmed_at" TIMESTAMP(3),
  ADD COLUMN "ready_at" TIMESTAMP(3),
  ADD COLUMN "delivered_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by" "OrderCancelledBy",
  ADD COLUMN "cancellation_reason" VARCHAR(500),
  ADD COLUMN "refunded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_disputes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "raised_by" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "OrderDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" VARCHAR(1000),
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "order_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_inventory_id_idx" ON "stock_movements"("inventory_id");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "order_disputes_order_id_idx" ON "order_disputes"("order_id");

-- CreateIndex
CREATE INDEX "order_disputes_status_idx" ON "order_disputes"("status");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "product_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_disputes" ADD CONSTRAINT "order_disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
