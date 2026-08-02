-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('RIDE', 'DELIVERY', 'MARKETPLACE', 'WALLET', 'MERCHANT', 'ADMIN', 'SUPPORT', 'EMERGENCY', 'MARKETING', 'SYSTEM', 'SECURITY');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_category_idx" ON "notifications"("category");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");
