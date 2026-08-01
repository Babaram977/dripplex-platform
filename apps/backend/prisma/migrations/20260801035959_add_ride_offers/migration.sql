-- CreateEnum
CREATE TYPE "RideOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ride_offers" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "status" "RideOfferStatus" NOT NULL DEFAULT 'PENDING',
    "offered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "ride_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ride_offers_ride_id_idx" ON "ride_offers"("ride_id");

-- CreateIndex
CREATE INDEX "ride_offers_driver_id_status_idx" ON "ride_offers"("driver_id", "status");

-- CreateIndex
CREATE INDEX "ride_offers_status_expires_at_idx" ON "ride_offers"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "ride_offers" ADD CONSTRAINT "ride_offers_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_offers" ADD CONSTRAINT "ride_offers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

