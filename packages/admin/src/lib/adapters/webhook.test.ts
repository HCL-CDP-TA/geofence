import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebhookAdapter } from './webhook'
import type { GeofenceEventData } from './types'

const DUMMY_COORDINATES = [
  { lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 0 },
  { lat: 0.5, lng: 0 }, { lat: 0.5, lng: 1 }, { lat: 0, lng: 0.5 }, { lat: 1, lng: 0.5 },
]

function makeEvent(locationId: string | null): GeofenceEventData {
  return {
    appId: 'test-app',
    userId: 'user-1',
    eventType: 'enter',
    geofence: { id: 'g1', name: 'Store A', locationId, coordinates: DUMMY_COORDINATES },
    position: { latitude: 0.5, longitude: 0.5, accuracy: 10 },
    timestamp: new Date('2026-01-01T00:00:00Z'),
  }
}

describe('WebhookAdapter', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('sends locationId in geofence payload', async () => {
    const adapter = new WebhookAdapter('https://example.com/hook', 'key')
    await adapter.onEnter(makeEvent('store-123'))

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.geofence.locationId).toBe('store-123')
  })

  it('sends null locationId when geofence has none', async () => {
    const adapter = new WebhookAdapter('https://example.com/hook', 'key')
    await adapter.onEnter(makeEvent(null))

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.geofence.locationId).toBeNull()
  })

  it('does not call fetch when disabled', async () => {
    const adapter = new WebhookAdapter()
    await adapter.onEnter(makeEvent('store-123'))

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
