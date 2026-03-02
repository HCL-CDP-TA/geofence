-- AlterTable
ALTER TABLE "Geofence" ADD COLUMN     "locationId" TEXT;

-- Backfill existing geofences with their database id as locationId
UPDATE "Geofence" SET "locationId" = "id" WHERE "locationId" IS NULL;
