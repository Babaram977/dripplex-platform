-- CreateEnum
CREATE TYPE "DriverSupportCategory" AS ENUM ('PAYOUT', 'ACCOUNT', 'APP_BUG', 'KYC', 'OTHER');

-- CreateEnum
CREATE TYPE "DriverSupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_SUPPORT_TICKET_UPDATED';

-- CreateTable
CREATE TABLE "driver_support_tickets" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "category" "DriverSupportCategory" NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "status" "DriverSupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "admin_response" VARCHAR(2000),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_support_tickets_driver_id_idx" ON "driver_support_tickets"("driver_id");

-- CreateIndex
CREATE INDEX "driver_support_tickets_status_idx" ON "driver_support_tickets"("status");

-- AddForeignKey
ALTER TABLE "driver_support_tickets" ADD CONSTRAINT "driver_support_tickets_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_support_tickets" ADD CONSTRAINT "driver_support_tickets_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
