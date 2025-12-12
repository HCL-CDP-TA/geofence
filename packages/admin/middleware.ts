import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
        "Cache-Control": "public, max-age=86400", // Cache preflight for 24h
      },
    })
  }

  // Add CORS headers to all responses
  const response = NextResponse.next()
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

  return response
}

export const config = {
  matcher: "/api/:path*",
}
