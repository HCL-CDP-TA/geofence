-- Add appId to UserGeofenceState table
ALTER TABLE "UserGeofenceState" ADD COLUMN "appId" TEXT NOT NULL DEFAULT 'default-app';

-- Drop old userId unique constraint
DROP INDEX "UserGeofenceState_userId_key";

-- Add new composite unique constraint on (appId, userId)
CREATE UNIQUE INDEX "UserGeofenceState_appId_userId_key" ON "UserGeofenceState"("appId", "userId");

-- Add index on appId
CREATE INDEX "UserGeofenceState_appId_idx" ON "UserGeofenceState"("appId");

-- Add appId to GeofenceEvent table
ALTER TABLE "GeofenceEvent" ADD COLUMN "appId" TEXT NOT NULL DEFAULT 'default-app';

-- Add index on appId for GeofenceEvent
CREATE INDEX "GeofenceEvent_appId_idx" ON "GeofenceEvent"("appId");
