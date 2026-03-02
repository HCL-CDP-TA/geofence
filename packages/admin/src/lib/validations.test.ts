import { describe, it, expect } from 'vitest'
import { createGeofenceSchema, updateGeofenceSchema } from './validations'

const VALID_COORDINATES = [
  { lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 0 },
  { lat: 0.5, lng: 0 }, { lat: 0.5, lng: 1 }, { lat: 0, lng: 0.5 }, { lat: 1, lng: 0.5 },
]

describe('createGeofenceSchema', () => {
  it('accepts locationId', () => {
    const result = createGeofenceSchema.safeParse({
      name: 'Store A',
      locationId: 'store-123',
      coordinates: VALID_COORDINATES,
      enabled: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locationId).toBe('store-123')
    }
  })

  it('works without locationId', () => {
    const result = createGeofenceSchema.safeParse({
      name: 'Store A',
      coordinates: VALID_COORDINATES,
      enabled: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locationId).toBeUndefined()
    }
  })
})

describe('updateGeofenceSchema', () => {
  it('accepts locationId', () => {
    const result = updateGeofenceSchema.safeParse({ locationId: 'store-456' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locationId).toBe('store-456')
    }
  })

  it('works without locationId', () => {
    const result = updateGeofenceSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locationId).toBeUndefined()
    }
  })
})
