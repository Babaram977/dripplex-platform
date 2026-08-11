-- DPX-REVIEWS-001 — driver rating tags on RideRating.
ALTER TABLE "ride_ratings" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
