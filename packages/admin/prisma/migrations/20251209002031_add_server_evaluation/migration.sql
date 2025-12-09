-- CreateTable
CREATE TABLE "UserGeofenceState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeGeofenceIds" TEXT[],
    "lastLatitude" DOUBLE PRECISION NOT NULL,
    "lastLongitude" DOUBLE PRECISION NOT NULL,
    "lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGeofenceState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGeofenceState_userId_key" ON "UserGeofenceState"("userId");

-- CreateIndex
CREATE INDEX "UserGeofenceState_userId_idx" ON "UserGeofenceState"("userId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_userId_idx" ON "GeofenceEvent"("userId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_geofenceId_idx" ON "GeofenceEvent"("geofenceId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_eventType_idx" ON "GeofenceEvent"("eventType");

-- CreateIndex
CREATE INDEX "GeofenceEvent_timestamp_idx" ON "GeofenceEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "Geofence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
