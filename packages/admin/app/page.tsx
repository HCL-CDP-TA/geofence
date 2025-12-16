"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import dynamic from "next/dynamic"
import { GeofenceList } from "@/src/components/geofence/GeofenceList"
import { GeofenceForm } from "@/src/components/geofence/GeofenceForm"
import { Button } from "@/src/components/ui/Button"
import { VERSION } from "@/src/lib/version"

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import("@/src/components/map/LeafletMap").then(mod => mod.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">Loading map...</div>
  ),
})

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

export default function Dashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null)
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false)
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null)
  const [previewGeofence, setPreviewGeofence] = useState<{
    coordinates: Coordinate[]
    name?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // Fetch geofences
  const fetchGeofences = async () => {
    try {
      const response = await fetch("/api/geofences")
      if (response.ok) {
        const data = await response.json()
        setGeofences(data.geofences)
      }
    } catch (error) {
      console.error("Error fetching geofences:", error)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      fetchGeofences()
    }
  }, [status])

  // Generate an 8-point square centered on the clicked location
  const generateInitialPolygon = (lat: number, lng: number): Coordinate[] => {
    // Default size: ~100m radius from center
    const offset = 0.001 // ~111m at equator

    return [
      { lat: lat + offset, lng: lng - offset }, // NW
      { lat: lat + offset, lng: lng }, // N
      { lat: lat + offset, lng: lng + offset }, // NE
      { lat: lat, lng: lng + offset }, // E
      { lat: lat - offset, lng: lng + offset }, // SE
      { lat: lat - offset, lng: lng }, // S
      { lat: lat - offset, lng: lng - offset }, // SW
      { lat: lat, lng: lng - offset }, // W
    ]
  }

  const handleMapClick = (lat: number, lng: number) => {
    // Don't create new geofences when editing an existing one
    if (editingGeofence) return

    const initialCoordinates = generateInitialPolygon(lat, lng)
    setPreviewGeofence({ coordinates: initialCoordinates, name: "" })
    setIsCreateFormVisible(true)
  }

  const handleCreateGeofence = async (data: { name: string; coordinates: Coordinate[]; enabled: boolean }) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        await fetchGeofences()
        setIsCreateFormVisible(false)
        setPreviewGeofence(null)
      } else {
        const errorData = await response.json()
        alert(`Failed to create geofence: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error creating geofence:", error)
      alert("Error creating geofence")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateGeofence = async (data: { name: string; coordinates: Coordinate[]; enabled: boolean }) => {
    if (!editingGeofence) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/geofences/${editingGeofence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        await fetchGeofences()
        setEditingGeofence(null)
      } else {
        const errorData = await response.json()
        alert(`Failed to update geofence: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error updating geofence:", error)
      alert("Error updating geofence")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/geofences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })

      if (response.ok) {
        await fetchGeofences()
      }
    } catch (error) {
      console.error("Error toggling geofence:", error)
    }
  }

  const handleDeleteGeofence = async (id: string) => {
    try {
      const response = await fetch(`/api/geofences/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchGeofences()
        if (selectedGeofence?.id === id) {
          setSelectedGeofence(null)
        }
      } else {
        alert("Failed to delete geofence")
      }
    } catch (error) {
      console.error("Error deleting geofence:", error)
      alert("Error deleting geofence")
    }
  }

  const handleEditClick = (geofence: Geofence) => {
    setEditingGeofence(geofence)
    setIsCreateFormVisible(false) // Hide create form if visible
  }

  const handleVerticesDrag = (coordinates: Coordinate[]) => {
    if (editingGeofence) {
      setEditingGeofence({
        ...editingGeofence,
        coordinates,
      })
    } else if (previewGeofence) {
      // Update preview polygon when dragging vertices during creation
      setPreviewGeofence({
        ...previewGeofence,
        coordinates,
      })
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" })
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Geofence Management</h1>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">v{VERSION}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Map */}
        <div className="flex-1">
          <Map
            geofences={geofences}
            onMapClick={handleMapClick}
            onGeofenceClick={setSelectedGeofence}
            selectedGeofenceId={selectedGeofence?.id}
            editingGeofence={editingGeofence}
            onVerticesDrag={handleVerticesDrag}
            isCreating={isCreateFormVisible}
            previewGeofence={previewGeofence}
          />
        </div>

        {/* Sidebar */}
        <div className="w-96 flex flex-col gap-4">
          {/* Create Form (inline) */}
          {isCreateFormVisible && !editingGeofence && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Geofence</h3>
              <GeofenceForm
                coordinates={previewGeofence?.coordinates}
                onSubmit={handleCreateGeofence}
                onCancel={() => {
                  setIsCreateFormVisible(false)
                  setPreviewGeofence(null)
                }}
                onNameChange={name => {
                  if (previewGeofence) {
                    setPreviewGeofence({
                      ...previewGeofence,
                      name: name,
                    })
                  }
                }}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Edit Form (inline) */}
          {editingGeofence && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Geofence</h3>
              <GeofenceForm
                geofence={editingGeofence}
                onSubmit={handleUpdateGeofence}
                onCancel={() => {
                  setEditingGeofence(null)
                }}
                onNameChange={name => {
                  if (editingGeofence) {
                    setEditingGeofence({
                      ...editingGeofence,
                      name: name,
                    })
                  }
                }}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Geofence List */}
          <div className="flex-1 min-h-0">
            <GeofenceList
              geofences={geofences}
              selectedId={selectedGeofence?.id}
              onSelect={setSelectedGeofence}
              onToggleEnabled={handleToggleEnabled}
              onEdit={handleEditClick}
              onDelete={handleDeleteGeofence}
              onCreate={() => {
                setEditingGeofence(null) // Clear edit form if visible
                setIsCreateFormVisible(true)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
