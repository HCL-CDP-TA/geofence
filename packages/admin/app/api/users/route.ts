// User Management API - List users

import { isAuthenticated } from "@/src/lib/api-auth"
import { prisma } from "@/src/lib/prisma"
import { corsJsonResponse, handleOptions } from "@/src/lib/cors"

// OPTIONS /api/users - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions()
}

// GET /api/users - List all users
export async function GET(request: Request) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all users (exclude password hash for security)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude password
      },
      orderBy: { createdAt: "desc" },
    })

    return corsJsonResponse({ users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}
