// Public API for SDK - Get enabled geofences

import { prisma } from "@/src/lib/prisma"
import { corsJsonResponse, handleOptions } from "@/src/lib/cors"

// OPTIONS /api/public/geofences - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions()
}

// GET /api/public/geofences - Get all enabled geofences
export async function GET() {
  try {
    // Fetch only enabled geofences
    const geofences = await prisma.geofence.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        radius: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return corsJsonResponse({ geofences })
  } catch (error) {
    console.error("Error fetching public geofences:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}
