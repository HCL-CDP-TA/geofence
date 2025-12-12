// Public API for SDK - Get enabled geofences

import { prisma } from "@/src/lib/prisma"
import { corsJsonResponse, handleOptions } from "@/src/lib/cors"

// Cache for 5 minutes (300 seconds)
export const revalidate = 300

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

    return corsJsonResponse({ geofences }, {
      headers: {
        // Cache on client for 5 minutes, CDN can serve stale for up to 10 minutes while revalidating
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error("Error fetching public geofences:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}
