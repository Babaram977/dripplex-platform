-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_DRIVER_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_DRIVER_ARRIVED';
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_COMPLETED';

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "device_tokens_active_idx" ON "device_tokens"("active");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_platform_token_key" ON "device_tokens"("user_id", "platform", "token");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
