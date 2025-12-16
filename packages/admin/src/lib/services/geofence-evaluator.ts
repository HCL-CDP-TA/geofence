// Server-side geofence evaluation service
import { prisma } from "@/src/lib/prisma"
import { isPointInPolygon } from "@/src/lib/utils/distance"
import { GeofenceEventData, createAdapterConfig, dispatchEvent } from "@/src/lib/adapters"

export interface PositionInput {
  appId: string
  userId: string
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  speed?: number | null
  heading?: number | null
}

export interface EvaluationResult {
  events: Array<{
    type: "enter" | "exit"
    geofence: {
      id: string
      name: string
      coordinates: Array<{ lat: number; lng: number }>
    }
    timestamp: string
  }>
}

// In-memory locks to prevent concurrent evaluations for the same user
const userLocks = new Map<string, Promise<EvaluationResult>>()

// Singleton adapter config (avoid re-initializing adapters on every request)
let adapterConfigInstance: ReturnType<typeof createAdapterConfig> | null = null
function getAdapterConfig() {
  if (!adapterConfigInstance) {
    adapterConfigInstance = createAdapterConfig()
  }
  return adapterConfigInstance
}

// In-memory cache for geofences
interface GeofenceCache {
  data: Array<{
    id: string
    name: string
    coordinates: Array<{ lat: number; lng: number }>
  }>
  timestamp: number
}

let geofenceCache: GeofenceCache | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function getCachedGeofences() {
  const now = Date.now()

  // Check if cache is valid
  if (geofenceCache && now - geofenceCache.timestamp < CACHE_TTL_MS) {
    console.log("[GeofenceEvaluator] Using cached geofences")
    return geofenceCache.data
  }

  // Fetch fresh data from database
  console.log("[GeofenceEvaluator] Fetching fresh geofences from database")
  const geofences = await prisma.geofence.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      coordinates: true,
    },
  })

  // Update cache
  geofenceCache = {
    data: geofences as Array<{
      id: string
      name: string
      coordinates: Array<{ lat: number; lng: number }>
    }>,
    timestamp: now,
  }

  return geofenceCache.data
}

// Function to invalidate cache (useful for admin operations)
export function invalidateGeofenceCache() {
  console.log("[GeofenceEvaluator] Invalidating geofence cache")
  geofenceCache = null
}

export class GeofenceEvaluator {
  private adapterConfig = getAdapterConfig()

  async evaluatePosition(input: PositionInput): Promise<EvaluationResult> {
    const { appId, userId } = input
    const lockKey = `${appId}:${userId}`

    // Check if there's already an evaluation in progress for this user+app
    const existingLock = userLocks.get(lockKey)
    if (existingLock) {
      console.log(`[GeofenceEvaluator] Evaluation already in progress for user ${userId} in app ${appId}, waiting...`)
      // Wait for the existing evaluation to complete and return empty result
      await existingLock
      return { events: [] }
    }

    // Create a new lock for this user+app
    const evaluationPromise = this.performEvaluation(input)
    userLocks.set(lockKey, evaluationPromise)

    try {
      const result = await evaluationPromise
      return result
    } finally {
      // Release the lock
      userLocks.delete(lockKey)
    }
  }

  private async performEvaluation(input: PositionInput): Promise<EvaluationResult> {
    const { appId, userId, latitude, longitude, accuracy, timestamp, speed, heading } = input

    // 1. Fetch all enabled geofences (cached)
    const geofences = await getCachedGeofences()

    // 2. Get user's current state (or create if first time)
    let userState = await prisma.userGeofenceState.findUnique({
      where: { appId_userId: { appId, userId } },
    })

    if (!userState) {
      // First time seeing this user in this app, create state
      userState = await prisma.userGeofenceState.create({
        data: {
          appId,
          userId,
          activeGeofenceIds: [],
          lastLatitude: latitude,
          lastLongitude: longitude,
          lastReportedAt: new Date(timestamp),
        },
      })
      console.log(`[GeofenceEvaluator] Created new state for user ${userId} in app ${appId}`)
    }

    // 3. Evaluate which geofences user is currently in
    const currentGeofenceIds = new Set<string>()
    for (const geofence of geofences) {
      const isInside = isPointInPolygon(
        latitude,
        longitude,
        geofence.coordinates as Array<{ lat: number; lng: number }>,
      )

      if (isInside) {
        currentGeofenceIds.add(geofence.id)
      }
    }

    // 4. Detect transitions (enter/exit events)
    const previousGeofenceIds = new Set(userState.activeGeofenceIds)
    const events: EvaluationResult["events"] = []

    // Detect ENTER events
    for (const geofenceId of currentGeofenceIds) {
      if (!previousGeofenceIds.has(geofenceId)) {
        const geofence = geofences.find(g => g.id === geofenceId)!
        const eventData: GeofenceEventData = {
          appId,
          userId,
          eventType: "enter",
          geofence: {
            id: geofence.id,
            name: geofence.name,
            coordinates: geofence.coordinates as Array<{ lat: number; lng: number }>,
          },
          position: { latitude, longitude, accuracy, speed, heading },
          timestamp: new Date(timestamp),
        }

        // Dispatch to adapters (non-blocking)
        dispatchEvent("enter", eventData, this.adapterConfig)

        // Add to response
        events.push({
          type: "enter",
          geofence: {
            id: geofence.id,
            name: geofence.name,
            coordinates: geofence.coordinates as Array<{ lat: number; lng: number }>,
          },
          timestamp: new Date(timestamp).toISOString(),
        })

        console.log(`[GeofenceEvaluator] User ${userId} entered ${geofence.name}`)
      }
    }

    // Detect EXIT events
    for (const geofenceId of previousGeofenceIds) {
      if (!currentGeofenceIds.has(geofenceId)) {
        const geofence = geofences.find(g => g.id === geofenceId)!
        const eventData: GeofenceEventData = {
          appId,
          userId,
          eventType: "exit",
          geofence: {
            id: geofence.id,
            name: geofence.name,
            coordinates: geofence.coordinates as Array<{ lat: number; lng: number }>,
          },
          position: { latitude, longitude, accuracy, speed, heading },
          timestamp: new Date(timestamp),
        }

        // Dispatch to adapters (non-blocking)
        dispatchEvent("exit", eventData, this.adapterConfig)

        // Add to response
        events.push({
          type: "exit",
          geofence: {
            id: geofence.id,
            name: geofence.name,
            coordinates: geofence.coordinates as Array<{ lat: number; lng: number }>,
          },
          timestamp: new Date(timestamp).toISOString(),
        })

        console.log(`[GeofenceEvaluator] User ${userId} exited ${geofence.name}`)
      }
    }

    // 5. Update user state
    await prisma.userGeofenceState.update({
      where: { appId_userId: { appId, userId } },
      data: {
        activeGeofenceIds: Array.from(currentGeofenceIds),
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastReportedAt: new Date(timestamp),
      },
    })

    return { events }
  }
}
