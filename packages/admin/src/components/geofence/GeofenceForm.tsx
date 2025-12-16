"use client"

import { useState, useEffect } from "react"
import { Button } from "../ui/Button"

interface Coordinate {
  lat: number
  lng: number
}

interface Geofence {
  id: string
  name: string
  coordinates: Coordinate[]
  enabled: boolean
}

interface GeofenceFormProps {
  geofence?: Geofence
  coordinates?: Coordinate[]
  onSubmit: (data: { name: string; coordinates: Coordinate[]; enabled: boolean }) => void
  onCancel: () => void
  onNameChange?: (name: string) => void
  isLoading?: boolean
}

export function GeofenceForm({
  geofence,
  coordinates,
  onSubmit,
  onCancel,
  onNameChange,
  isLoading = false,
}: GeofenceFormProps) {
  const [name, setName] = useState(geofence?.name || "")
  const [enabled, setEnabled] = useState(geofence?.enabled ?? true)

  const handleNameChange = (newName: string) => {
    setName(newName)
    if (onNameChange) {
      onNameChange(newName)
    }
  }

  // Update form when geofence prop changes
  useEffect(() => {
    if (geofence) {
      setName(geofence.name)
      setEnabled(geofence.enabled)
    }
  }, [geofence])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Use geofence coordinates if editing, or provided coordinates if creating
    const coords = geofence?.coordinates || coordinates || []

    if (coords.length !== 8) {
      alert("Geofence must have exactly 8 points. Please create the polygon on the map first.")
      return
    }

    onSubmit({
      name,
      coordinates: coords,
      enabled,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Downtown Store"
        />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
        <p className="text-sm text-gray-600 mb-2">Polygon Shape</p>
        {geofence?.coordinates.length === 8 ? (
          <p className="text-sm text-gray-700">
            8-point polygon defined
            <span className="block text-xs text-gray-500 mt-1">
              {geofence.coordinates[0] &&
                `Starting at ${geofence.coordinates[0].lat.toFixed(5)}, ${geofence.coordinates[0].lng.toFixed(5)}`}
            </span>
          </p>
        ) : coordinates?.length === 8 ? (
          <p className="text-sm text-gray-700">
            8-point polygon ready
            <span className="block text-xs text-gray-500 mt-1">
              {coordinates[0] &&
                `Starting at ${coordinates[0].lat.toFixed(5)}, ${coordinates[0].lng.toFixed(5)}`}
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Click the map to create an 8-point polygon, then drag vertices to reshape
          </p>
        )}
      </div>

      <div className="flex items-center">
        <input
          id="enabled"
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
          Enabled
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Saving..." : geofence ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
