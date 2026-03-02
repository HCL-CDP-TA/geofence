import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/lib/prisma', () => ({
  prisma: {
    geofence: {
      findMany: vi.fn(),
    },
    userGeofenceState: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/src/lib/utils/distance', () => ({
  isPointInPolygon: vi.fn(),
}))

vi.mock('@/src/lib/adapters', () => ({
  createAdapterConfig: vi.fn(() => ({ adapters: [] })),
  dispatchEvent: vi.fn(),
}))

import { prisma } from '@/src/lib/prisma'
import { isPointInPolygon } from '@/src/lib/utils/distance'
import { dispatchEvent } from '@/src/lib/adapters'
import { GeofenceEvaluator, invalidateGeofenceCache } from '@/src/lib/services/geofence-evaluator'

const DUMMY_COORDINATES = [
  { lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 0 },
  { lat: 0.5, lng: 0 }, { lat: 0.5, lng: 1 }, { lat: 0, lng: 0.5 }, { lat: 1, lng: 0.5 },
]

const BASE_POSITION = {
  appId: 'test-app',
  userId: 'user-1',
  latitude: 0.5,
  longitude: 0.5,
  accuracy: 10,
  timestamp: Date.now(),
}

function makeUserState(activeGeofenceIds: string[]) {
  return {
    id: 'state-1',
    appId: 'test-app',
    userId: 'user-1',
    activeGeofenceIds,
    lastLatitude: 0,
    lastLongitude: 0,
    lastReportedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

beforeEach(() => {
  invalidateGeofenceCache()
  vi.mocked(prisma.userGeofenceState.update).mockResolvedValue(makeUserState([]) as never)
  vi.mocked(dispatchEvent).mockReset()
})

describe('GeofenceEvaluator - enter events', () => {
  it('includes locationId in enter event', async () => {
    vi.mocked(prisma.geofence.findMany).mockResolvedValue([
      { id: 'g1', name: 'Store A', locationId: 'loc-123', coordinates: DUMMY_COORDINATES } as never,
    ])
    vi.mocked(prisma.userGeofenceState.findUnique).mockResolvedValue(makeUserState([]) as never)
    vi.mocked(isPointInPolygon).mockReturnValue(true)

    const evaluator = new GeofenceEvaluator()
    const result = await evaluator.evaluatePosition(BASE_POSITION)

    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe('enter')
    expect(result.events[0].geofence.locationId).toBe('loc-123')
    expect(dispatchEvent).toHaveBeenCalledWith(
      'enter',
      expect.objectContaining({ geofence: expect.objectContaining({ locationId: 'loc-123' }) }),
      expect.anything(),
    )
  })

  it('has null locationId in enter event when geofence has none', async () => {
    vi.mocked(prisma.geofence.findMany).mockResolvedValue([
      { id: 'g1', name: 'Store A', locationId: null, coordinates: DUMMY_COORDINATES } as never,
    ])
    vi.mocked(prisma.userGeofenceState.findUnique).mockResolvedValue(makeUserState([]) as never)
    vi.mocked(isPointInPolygon).mockReturnValue(true)

    const evaluator = new GeofenceEvaluator()
    const result = await evaluator.evaluatePosition(BASE_POSITION)

    expect(result.events[0].geofence.locationId).toBeNull()
    expect(dispatchEvent).toHaveBeenCalledWith(
      'enter',
      expect.objectContaining({ geofence: expect.objectContaining({ locationId: null }) }),
      expect.anything(),
    )
  })
})

describe('GeofenceEvaluator - exit events', () => {
  it('includes locationId in exit event', async () => {
    vi.mocked(prisma.geofence.findMany).mockResolvedValue([
      { id: 'g1', name: 'Store A', locationId: 'loc-123', coordinates: DUMMY_COORDINATES } as never,
    ])
    vi.mocked(prisma.userGeofenceState.findUnique).mockResolvedValue(makeUserState(['g1']) as never)
    vi.mocked(isPointInPolygon).mockReturnValue(false)

    const evaluator = new GeofenceEvaluator()
    const result = await evaluator.evaluatePosition(BASE_POSITION)

    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe('exit')
    expect(result.events[0].geofence.locationId).toBe('loc-123')
    expect(dispatchEvent).toHaveBeenCalledWith(
      'exit',
      expect.objectContaining({ geofence: expect.objectContaining({ locationId: 'loc-123' }) }),
      expect.anything(),
    )
  })

  it('has null locationId in exit event when geofence has none', async () => {
    vi.mocked(prisma.geofence.findMany).mockResolvedValue([
      { id: 'g1', name: 'Store A', locationId: null, coordinates: DUMMY_COORDINATES } as never,
    ])
    vi.mocked(prisma.userGeofenceState.findUnique).mockResolvedValue(makeUserState(['g1']) as never)
    vi.mocked(isPointInPolygon).mockReturnValue(false)

    const evaluator = new GeofenceEvaluator()
    const result = await evaluator.evaluatePosition(BASE_POSITION)

    expect(result.events[0].geofence.locationId).toBeNull()
  })
})

describe('GeofenceEvaluator - no state change', () => {
  it('emits no events when user stays inside geofence', async () => {
    vi.mocked(prisma.geofence.findMany).mockResolvedValue([
      { id: 'g1', name: 'Store A', locationId: 'loc-123', coordinates: DUMMY_COORDINATES } as never,
    ])
    vi.mocked(prisma.userGeofenceState.findUnique).mockResolvedValue(makeUserState(['g1']) as never)
    vi.mocked(isPointInPolygon).mockReturnValue(true)

    const evaluator = new GeofenceEvaluator()
    const result = await evaluator.evaluatePosition(BASE_POSITION)

    expect(result.events).toHaveLength(0)
    expect(dispatchEvent).not.toHaveBeenCalled()
  })
})
