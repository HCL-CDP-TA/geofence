// API Authentication utilities - supports both session and API key auth

import { auth } from "./auth"

/**
 * Check if request is authenticated via either:
 * 1. NextAuth session (for web dashboard)
 * 2. API key in Authorization header (for external apps)
 *
 * @param request - The incoming request
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(request: Request): Promise<boolean> {
  // Check for API key in Authorization header
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const apiKey = authHeader.replace("Bearer ", "")
    const validApiKey = process.env.GEOFENCE_API_KEY

    if (validApiKey && apiKey === validApiKey) {
      return true
    }
  }

  // Check for NextAuth session
  const session = await auth()
  return !!session
}

/**
 * Get authentication type for logging/debugging
 */
export async function getAuthType(request: Request): Promise<"api-key" | "session" | null> {
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const apiKey = authHeader.replace("Bearer ", "")
    const validApiKey = process.env.GEOFENCE_API_KEY

    if (validApiKey && apiKey === validApiKey) {
      return "api-key"
    }
  }

  const session = await auth()
  return session ? "session" : null
}
