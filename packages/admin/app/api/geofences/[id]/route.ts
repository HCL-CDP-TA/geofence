// Geofence CRUD API - Update and Delete

import { isAuthenticated } from "@/src/lib/api-auth"
import { prisma } from "@/src/lib/prisma"
import { updateGeofenceSchema } from "@/src/lib/validations"
import { corsJsonResponse, handleOptions } from "@/src/lib/cors"
import { invalidateGeofenceCache } from "@/src/lib/services/geofence-evaluator"

// OPTIONS /api/geofences/[id] - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions()
}

// PATCH /api/geofences/[id] - Update a geofence
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate input
    const result = updateGeofenceSchema.safeParse(body)
    if (!result.success) {
      return corsJsonResponse({ error: "Invalid input", details: result.error.issues }, { status: 400 })
    }

    // Check if geofence exists
    const existingGeofence = await prisma.geofence.findUnique({
      where: { id },
    })

    if (!existingGeofence) {
      return corsJsonResponse({ error: "Geofence not found" }, { status: 404 })
    }

    // Update geofence
    const geofence = await prisma.geofence.update({
      where: { id },
      data: result.data,
    })

    // Invalidate cache to force refresh on next evaluation
    invalidateGeofenceCache()

    return corsJsonResponse({
      geofence,
      message: "Geofence updated successfully",
    })
  } catch (error) {
    console.error("Error updating geofence:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/geofences/[id] - Delete a geofence
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check if geofence exists
    const existingGeofence = await prisma.geofence.findUnique({
      where: { id },
    })

    if (!existingGeofence) {
      return corsJsonResponse({ error: "Geofence not found" }, { status: 404 })
    }

    // Delete geofence
    await prisma.geofence.delete({
      where: { id },
    })

    // Invalidate cache to force refresh on next evaluation
    invalidateGeofenceCache()

    return corsJsonResponse({
      message: "Geofence deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting geofence:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}
