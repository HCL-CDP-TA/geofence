/*
  Warnings:

  - You are about to drop the column `latitude` on the `Geofence` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Geofence` table. All the data in the column will be lost.
  - You are about to drop the column `radius` on the `Geofence` table. All the data in the column will be lost.
  - Added the required column `coordinates` to the `Geofence` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Geofence" DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "radius",
ADD COLUMN     "coordinates" JSONB NOT NULL;

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "User_username_key";
