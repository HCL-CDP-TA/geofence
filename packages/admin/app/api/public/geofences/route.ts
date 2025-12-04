// Public API for SDK - Get enabled geofences

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

// GET /api/public/geofences - Get all enabled geofences
export async function GET(request: Request) {
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
      orderBy: { createdAt: 'desc' },
    });

    const response = NextResponse.json({ geofences });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Error fetching public geofences:', error);
    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );

    // Add CORS headers to error response as well
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET');

    return errorResponse;
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 200 });

  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
}
