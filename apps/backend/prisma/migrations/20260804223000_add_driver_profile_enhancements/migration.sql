-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "avatar_url" VARCHAR(2048),
ADD COLUMN     "driving_experience_years" INTEGER,
ADD COLUMN     "languages_spoken" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferred_service_areas" TEXT[] DEFAULT ARRAY[]::TEXT[];
