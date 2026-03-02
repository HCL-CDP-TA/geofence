import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CDPAdapter } from './cdp'
import type { GeofenceEventData } from './types'

const DUMMY_COORDINATES = [
  { lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 0 },
  { lat: 0.5, lng: 0 }, { lat: 0.5, lng: 1 }, { lat: 0, lng: 0.5 }, { lat: 1, lng: 0.5 },
]

function makeEvent(locationId: string | null, eventType: 'enter' | 'exit' = 'enter'): GeofenceEventData {
  return {
    appId: 'test-app',
    userId: 'user-1',
    eventType,
    geofence: { id: 'g1', name: 'Store A', locationId, coordinates: DUMMY_COORDINATES },
    position: { latitude: 0.5, longitude: 0.5, accuracy: 10 },
    timestamp: new Date('2026-01-01T00:00:00Z'),
  }
}

describe('CDPAdapter', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.CDP_API_KEY = 'test-api-key'
    process.env.CDP_PASS_KEY = 'test-pass-key'
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'event-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    delete process.env.CDP_API_KEY
    delete process.env.CDP_PASS_KEY
    vi.unstubAllGlobals()
  })

  it('includes location_id in CDP properties', async () => {
    const adapter = new CDPAdapter()
    await adapter.onEnter(makeEvent('store-123'))

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.properties.location_id).toBe('store-123')
  })

  it('sends null location_id when geofence has none', async () => {
    const adapter = new CDPAdapter()
    await adapter.onEnter(makeEvent(null))

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.properties.location_id).toBeNull()
  })

  it('does not call fetch when credentials absent', async () => {
    delete process.env.CDP_API_KEY
    delete process.env.CDP_PASS_KEY
    const adapter = new CDPAdapter()
    await adapter.onEnter(makeEvent('store-123'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses Geofence_Entered event name on enter', async () => {
    const adapter = new CDPAdapter()
    await adapter.onEnter(makeEvent('store-123'))

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.eventname).toBe('Geofence_Entered')
  })

  it('uses Geofence_Exited event name on exit', async () => {
    const adapter = new CDPAdapter()
    await adapter.onExit(makeEvent('store-123', 'exit'))

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.eventname).toBe('Geofence_Exited')
  })
})
