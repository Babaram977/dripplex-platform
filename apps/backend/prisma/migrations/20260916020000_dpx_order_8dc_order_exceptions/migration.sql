-- CreateEnum
CREATE TYPE "OrderExceptionType" AS ENUM ('STALLED_CONFIRMED');

-- CreateEnum
CREATE TYPE "OrderExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_STALLED';

-- CreateTable
CREATE TABLE "order_exceptions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" "OrderExceptionType" NOT NULL,
    "status" "OrderExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waited_minutes" INTEGER NOT NULL,
    "notified_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_status" "OrderStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_exceptions_status_idx" ON "order_exceptions"("status");

-- CreateIndex
CREATE INDEX "order_exceptions_type_idx" ON "order_exceptions"("type");

-- CreateIndex
CREATE INDEX "order_exceptions_detected_at_idx" ON "order_exceptions"("detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_exceptions_order_id_type_key" ON "order_exceptions"("order_id", "type");

-- AddForeignKey
ALTER TABLE "order_exceptions" ADD CONSTRAINT "order_exceptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

