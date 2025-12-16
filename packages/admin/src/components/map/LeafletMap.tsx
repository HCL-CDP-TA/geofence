"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap } from "leaflet"
import { LocateFixed } from "lucide-react"

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

interface LeafletMapProps {
  geofences: Geofence[]
  onMapClick?: (lat: number, lng: number) => void
  onGeofenceClick?: (geofence: Geofence) => void
  selectedGeofenceId?: string | null
  editingGeofence?: Geofence | null
  onVerticesDrag?: (coordinates: Coordinate[]) => void
  isCreating?: boolean
  previewGeofence?: { coordinates: Coordinate[]; name?: string } | null
}

export function Map({
  geofences,
  onMapClick,
  onGeofenceClick,
  selectedGeofenceId,
  editingGeofence,
  onVerticesDrag,
  isCreating,
  previewGeofence,
}: LeafletMapProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const currentLocationMarkerRef = useRef<any>(null)
  const hasAutoFittedRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const vertexMarkersRef = useRef<any[]>([])

  useEffect(() => {
    // Import Leaflet dynamically to avoid SSR issues
    const initMap = async () => {
      const L = (await import("leaflet")).default

      if (!containerRef.current || mapRef.current) return

      // Get user's current location or use default
      const initializeMap = (lat: number, lng: number, zoom: number) => {
        if (!containerRef.current || mapRef.current) return

        const map = L.map(containerRef.current).setView([lat, lng], zoom)

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map)

        // Handle map clicks
        if (onMapClick) {
          map.on("click", e => {
            onMapClick(e.latlng.lat, e.latlng.lng)
          })
        }

        // Track drag state for cursor management
        map.on("dragstart", () => setIsDragging(true))
        map.on("dragend", () => setIsDragging(false))

        mapRef.current = map
        setIsLoaded(true)
      }

      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            initializeMap(position.coords.latitude, position.coords.longitude, 13)
          },
          () => {
            // Fallback to default location if geolocation fails
            initializeMap(51.505, -0.09, 13) // London
          },
          {
            timeout: 5000,
            maximumAge: 300000, // Cache for 5 minutes
          },
        )
      } else {
        // Fallback if geolocation not supported
        initializeMap(51.505, -0.09, 13) // London
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update geofences on map
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    const L = require("leaflet")
    const map = mapRef.current

    // Clear existing layers (except base tile layer)
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon || layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    // Clear vertex markers
    vertexMarkersRef.current = []

    // Add geofences as polygons
    geofences.forEach(geofence => {
      if (!geofence.coordinates || geofence.coordinates.length !== 8) {
        console.warn(`Geofence ${geofence.id} does not have exactly 8 coordinates`)
        return
      }

      const isSelected = geofence.id === selectedGeofenceId
      const isEditing = editingGeofence?.id === geofence.id

      // Use editing geofence coordinates if this is the one being edited
      const coords = isEditing && editingGeofence ? editingGeofence.coordinates : geofence.coordinates

      // Convert to Leaflet format [[lat, lng], ...]
      const latLngs = coords.map(c => [c.lat, c.lng])

      // Add polygon
      const polygon = L.polygon(latLngs, {
        color: isEditing ? "#f59e0b" : isSelected ? "#3b82f6" : geofence.enabled ? "#10b981" : "#6b7280",
        fillColor: isEditing ? "#f59e0b" : isSelected ? "#3b82f6" : geofence.enabled ? "#10b981" : "#6b7280",
        fillOpacity: 0.2,
        weight: isEditing ? 3 : isSelected ? 3 : 2,
      }).addTo(map)

      // If editing, add draggable vertex markers
      if (isEditing && onVerticesDrag) {
        const tempCoords = [...coords]

        coords.forEach((coord, index) => {
          const marker = L.marker([coord.lat, coord.lng], {
            draggable: true,
            icon: L.divIcon({
              className: "vertex-marker",
              html: `<div style="
                width: 16px;
                height: 16px;
                background: #f59e0b;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                cursor: grab;
              "></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(map)

          // Update polygon during drag
          marker.on("drag", (e: any) => {
            const { lat, lng } = e.target.getLatLng()
            tempCoords[index] = { lat, lng }
            polygon.setLatLngs(tempCoords.map(c => [c.lat, c.lng]))
          })

          // Update state when drag is complete
          marker.on("dragend", (e: any) => {
            const { lat, lng } = e.target.getLatLng()
            tempCoords[index] = { lat, lng }
            onVerticesDrag(tempCoords)
          })

          vertexMarkersRef.current.push(marker)
        })

        // Add popup for editing
        const editPopup = L.popup().setContent(`
          <div class="font-sans">
            <strong class="text-base">${editingGeofence.name || "Geofence"}</strong><br/>
            <span class="text-sm text-gray-500">Drag vertices to reshape</span>
          </div>
        `)
        polygon.bindPopup(editPopup).openPopup()
      } else {
        // Add popup for non-editing geofences
        const popup = L.popup().setContent(`
          <div class="font-sans">
            <strong class="text-base">${geofence.name}</strong><br/>
            <span class="text-sm text-gray-600">8-point polygon</span><br/>
            <span class="text-sm text-gray-600">Status: ${geofence.enabled ? "Enabled" : "Disabled"}</span>
          </div>
        `)
        polygon.bindPopup(popup)

        // Handle clicks (only if not editing)
        if (onGeofenceClick && !isEditing) {
          polygon.on("click", () => onGeofenceClick(geofence))
        }
      }
    })

    // Add preview geofence if creating
    if (previewGeofence && previewGeofence.coordinates.length === 8 && onVerticesDrag) {
      const { coordinates } = previewGeofence

      // Convert to Leaflet format
      const latLngs = coordinates.map(c => [c.lat, c.lng])

      // Add preview polygon
      const previewPolygon = L.polygon(latLngs, {
        color: "#8b5cf6",
        fillColor: "#8b5cf6",
        fillOpacity: 0.2,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(map)

      // Add draggable vertex markers for preview
      const tempCoords = [...coordinates]
      coordinates.forEach((coord, index) => {
        const marker = L.marker([coord.lat, coord.lng], {
          draggable: true,
          icon: L.divIcon({
            className: "vertex-marker",
            html: `<div style="
              width: 16px;
              height: 16px;
              background: #8b5cf6;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              cursor: grab;
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(map)

        // Update polygon during drag
        marker.on("drag", (e: any) => {
          const { lat, lng } = e.target.getLatLng()
          tempCoords[index] = { lat, lng }
          previewPolygon.setLatLngs(tempCoords.map(c => [c.lat, c.lng]))
        })

        // Update state when drag is complete
        marker.on("dragend", (e: any) => {
          const { lat, lng } = e.target.getLatLng()
          tempCoords[index] = { lat, lng }
          onVerticesDrag(tempCoords)
        })

        vertexMarkersRef.current.push(marker)
      })

      // Add popup
      const displayName = previewGeofence.name?.trim() || "New Geofence"
      const popup = L.popup().setContent(`
        <div class="font-sans">
          <strong class="text-base">${displayName}</strong><br/>
          <span class="text-sm text-gray-600">8-point polygon</span><br/>
          <span class="text-sm text-gray-500">Drag vertices to reshape</span>
        </div>
      `)
      previewPolygon.bindPopup(popup).openPopup()
    }

    // Fit bounds to show all geofences (only on first load)
    if (geofences.length > 0 && !hasAutoFittedRef.current) {
      const allCoords: [number, number][] = []
      geofences.forEach(g => {
        if (g.coordinates && g.coordinates.length > 0) {
          g.coordinates.forEach(c => allCoords.push([c.lat, c.lng]))
        }
      })
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords)
        map.fitBounds(bounds, { padding: [50, 50] })
        hasAutoFittedRef.current = true
      }
    }
  }, [
    geofences,
    isLoaded,
    selectedGeofenceId,
    onGeofenceClick,
    editingGeofence,
    onVerticesDrag,
    previewGeofence,
  ])

  // Update current location marker
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !currentLocation) return

    const L = require("leaflet")
    const map = mapRef.current

    // Remove existing current location marker
    if (currentLocationMarkerRef.current) {
      map.removeLayer(currentLocationMarkerRef.current)
    }

    // Add current location marker
    const marker = L.marker([currentLocation.lat, currentLocation.lng], {
      icon: L.divIcon({
        className: "current-location-marker",
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map)

    marker.bindPopup("<strong>Your Location</strong>")
    currentLocationMarkerRef.current = marker

    // Center map on current location
    map.setView([currentLocation.lat, currentLocation.lng], 15)
  }, [currentLocation, isLoaded])

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser")
      return
    }

    setIsGettingLocation(true)

    navigator.geolocation.getCurrentPosition(
      position => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setIsGettingLocation(false)
      },
      error => {
        console.error("Error getting location:", error)
        alert(`Failed to get location: ${error.message}`)
        setIsGettingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }

  return (
    <div className="h-full w-full relative">
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg overflow-hidden shadow-lg"
        style={{
          cursor: isDragging ? "grabbing" : isCreating ? "crosshair" : undefined,
        }}
      />

      {/* Current Location Button */}
      <button
        onClick={handleGetCurrentLocation}
        disabled={isGettingLocation}
        className="absolute top-4 right-4 z-1000 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow-lg border border-gray-200 font-medium text-sm transition-colors flex items-center gap-2"
        title="Show my location">
        <LocateFixed className="w-4 h-4" />
        {isGettingLocation ? "Locating..." : "My Location"}
      </button>
    </div>
  )
}
