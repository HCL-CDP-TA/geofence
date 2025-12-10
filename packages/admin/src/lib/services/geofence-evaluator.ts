// Server-side geofence evaluation service
import { prisma } from '@/src/lib/prisma';
import { isPointInGeofence } from '@/src/lib/utils/distance';
import { GeofenceEventData, createAdapterConfig, dispatchEvent } from '@/src/lib/adapters';

export interface PositionInput {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
}

export interface EvaluationResult {
  events: Array<{
    type: 'enter' | 'exit';
    geofence: {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      radius: number;
    };
    timestamp: string;
  }>;
}

// In-memory locks to prevent concurrent evaluations for the same user
const userLocks = new Map<string, Promise<EvaluationResult>>();

// Singleton adapter config (avoid re-initializing adapters on every request)
let adapterConfigInstance: ReturnType<typeof createAdapterConfig> | null = null;
function getAdapterConfig() {
  if (!adapterConfigInstance) {
    adapterConfigInstance = createAdapterConfig();
  }
  return adapterConfigInstance;
}

export class GeofenceEvaluator {
  private adapterConfig = getAdapterConfig();

  async evaluatePosition(input: PositionInput): Promise<EvaluationResult> {
    const { userId, latitude, longitude, accuracy, timestamp, speed, heading } = input;

    // Check if there's already an evaluation in progress for this user
    const existingLock = userLocks.get(userId);
    if (existingLock) {
      console.log(`[GeofenceEvaluator] Evaluation already in progress for user ${userId}, waiting...`);
      // Wait for the existing evaluation to complete and return empty result
      await existingLock;
      return { events: [] };
    }

    // Create a new lock for this user
    const evaluationPromise = this.performEvaluation(input);
    userLocks.set(userId, evaluationPromise);

    try {
      const result = await evaluationPromise;
      return result;
    } finally {
      // Release the lock
      userLocks.delete(userId);
    }
  }

  private async performEvaluation(input: PositionInput): Promise<EvaluationResult> {
    const { userId, latitude, longitude, accuracy, timestamp, speed, heading } = input;

    // 1. Fetch all enabled geofences
    const geofences = await prisma.geofence.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        radius: true,
      },
    });

    // 2. Get user's current state (or create if first time)
    let userState = await prisma.userGeofenceState.findUnique({
      where: { userId },
    });

    if (!userState) {
      // First time seeing this user, create state
      userState = await prisma.userGeofenceState.create({
        data: {
          userId,
          activeGeofenceIds: [],
          lastLatitude: latitude,
          lastLongitude: longitude,
          lastReportedAt: new Date(timestamp),
        },
      });
      console.log(`[GeofenceEvaluator] Created new state for user ${userId}`);
    }

    // 3. Evaluate which geofences user is currently in
    const currentGeofenceIds = new Set<string>();
    for (const geofence of geofences) {
      const isInside = isPointInGeofence(
        latitude,
        longitude,
        geofence.latitude,
        geofence.longitude,
        geofence.radius
      );

      if (isInside) {
        currentGeofenceIds.add(geofence.id);
      }
    }

    // 4. Detect transitions (enter/exit events)
    const previousGeofenceIds = new Set(userState.activeGeofenceIds);
    const events: EvaluationResult['events'] = [];

    // Detect ENTER events
    for (const geofenceId of currentGeofenceIds) {
      if (!previousGeofenceIds.has(geofenceId)) {
        const geofence = geofences.find((g) => g.id === geofenceId)!;
        const eventData: GeofenceEventData = {
          userId,
          eventType: 'enter',
          geofence,
          position: { latitude, longitude, accuracy, speed, heading },
          timestamp: new Date(timestamp),
        };

        // Dispatch to adapters
        await dispatchEvent('enter', eventData, this.adapterConfig);

        // Add to response
        events.push({
          type: 'enter',
          geofence,
          timestamp: new Date(timestamp).toISOString(),
        });

        console.log(`[GeofenceEvaluator] User ${userId} entered ${geofence.name}`);
      }
    }

    // Detect EXIT events
    for (const geofenceId of previousGeofenceIds) {
      if (!currentGeofenceIds.has(geofenceId)) {
        const geofence = geofences.find((g) => g.id === geofenceId)!;
        const eventData: GeofenceEventData = {
          userId,
          eventType: 'exit',
          geofence,
          position: { latitude, longitude, accuracy, speed, heading },
          timestamp: new Date(timestamp),
        };

        // Dispatch to adapters
        await dispatchEvent('exit', eventData, this.adapterConfig);

        // Add to response
        events.push({
          type: 'exit',
          geofence,
          timestamp: new Date(timestamp).toISOString(),
        });

        console.log(`[GeofenceEvaluator] User ${userId} exited ${geofence.name}`);
      }
    }

    // 5. Update user state
    await prisma.userGeofenceState.update({
      where: { userId },
      data: {
        activeGeofenceIds: Array.from(currentGeofenceIds),
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastReportedAt: new Date(timestamp),
      },
    });

    console.log(
      `[GeofenceEvaluator] Evaluated position for user ${userId}: ${events.length} events`
    );

    return { events };
  }
}
