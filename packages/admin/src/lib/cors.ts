// CORS utilities for API routes

import { NextResponse } from "next/server"

/**
 * Add CORS headers to a NextResponse
 */
export function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  response.headers.set("Access-Control-Max-Age", "86400") // 24 hours
  // Prevent caching of error responses
  if (response.status >= 400) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
  }
  return response
}

/**
 * Create a CORS-enabled JSON response
 */
export function corsJsonResponse(data: any, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init)
  return addCorsHeaders(response)
}

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions(): NextResponse {
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response)
}
