"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import dynamic from "next/dynamic"
import { GeofenceList } from "@/src/components/geofence/GeofenceList"
import { GeofenceForm } from "@/src/components/geofence/GeofenceForm"
import { Button } from "@/src/components/ui/Button"

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import("@/src/components/map/LeafletMap").then(mod => mod.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">Loading map...</div>
  ),
})

interface Geofence {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  enabled: boolean
}

export default function Dashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null)
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false)
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null)
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [previewGeofence, setPreviewGeofence] = useState<{
    latitude: number
    longitude: number
    radius: number
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

  const handleMapClick = (lat: number, lng: number) => {
    setClickedLocation({ lat, lng })
    setPreviewGeofence({ latitude: lat, longitude: lng, radius: 100, name: "" })
    setIsCreateFormVisible(true)
  }

  const handleCreateGeofence = async (data: Omit<Geofence, "id" | "createdAt" | "updatedAt">) => {
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
        setClickedLocation(null)
        setPreviewGeofence(null)
      } else {
        alert("Failed to create geofence")
      }
    } catch (error) {
      console.error("Error creating geofence:", error)
      alert("Error creating geofence")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateGeofence = async (data: Omit<Geofence, "id" | "createdAt" | "updatedAt">) => {
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
        alert("Failed to update geofence")
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
          <h1 className="text-2xl font-bold text-gray-900">Geofence Management</h1>
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
            isCreating={isCreateFormVisible}
            previewGeofence={previewGeofence}
            onPreviewRadiusChange={radius => {
              if (previewGeofence) {
                setPreviewGeofence({
                  ...previewGeofence,
                  radius: radius,
                })
              }
            }}
            onGeofenceDrag={(lat, lng) => {
              if (editingGeofence) {
                setEditingGeofence({
                  ...editingGeofence,
                  latitude: lat,
                  longitude: lng,
                })
              }
            }}
            onRadiusChange={radius => {
              if (editingGeofence) {
                setEditingGeofence({
                  ...editingGeofence,
                  radius: radius,
                })
              }
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="w-96 flex flex-col gap-4">
          {/* Create Form (inline) */}
          {isCreateFormVisible && !editingGeofence && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Geofence</h3>
              <GeofenceForm
                initialLat={clickedLocation?.lat}
                initialLng={clickedLocation?.lng}
                initialRadius={previewGeofence?.radius}
                onSubmit={handleCreateGeofence}
                onCancel={() => {
                  setIsCreateFormVisible(false)
                  setClickedLocation(null)
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
                setClickedLocation(null)
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
