// Geofence CRUD API - List and Create

import { isAuthenticated } from "@/src/lib/api-auth"
import { prisma } from "@/src/lib/prisma"
import { createGeofenceSchema } from "@/src/lib/validations"
import { corsJsonResponse, handleOptions } from "@/src/lib/cors"

// OPTIONS /api/geofences - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions()
}

// GET /api/geofences - List all geofences
export async function GET(request: Request) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all geofences
    const geofences = await prisma.geofence.findMany({
      orderBy: { createdAt: "desc" },
    })

    return corsJsonResponse({ geofences })
  } catch (error) {
    console.error("Error fetching geofences:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/geofences - Create a new geofence
export async function POST(request: Request) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const result = createGeofenceSchema.safeParse(body)
    if (!result.success) {
      return corsJsonResponse({ error: "Invalid input", details: result.error.issues }, { status: 400 })
    }

    // Create geofence
    const geofence = await prisma.geofence.create({
      data: result.data,
    })

    return corsJsonResponse({ geofence, message: "Geofence created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Error creating geofence:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}
