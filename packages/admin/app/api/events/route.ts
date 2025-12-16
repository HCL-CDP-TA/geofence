// API endpoint to view recent geofence events
import { NextRequest } from 'next/server';
import { corsJsonResponse, handleOptions } from '@/src/lib/cors';
import { prisma } from '@/src/lib/prisma';

// OPTIONS /api/events - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions();
}

// GET /api/events - Get recent geofence events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const eventType = searchParams.get('eventType'); // 'enter' or 'exit'

    // Build query filters
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (eventType) {
      where.eventType = eventType;
    }

    // Fetch recent events
    const events = await prisma.geofenceEvent.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        geofence: {
          select: {
            name: true,
            coordinates: true,
          },
        },
      },
    });

    // Format response
    const formattedEvents = events.map((event) => ({
      id: event.id,
      userId: event.userId,
      eventType: event.eventType,
      geofence: {
        id: event.geofenceId,
        name: event.geofence.name,
        coordinates: event.geofence.coordinates,
      },
      position: {
        latitude: event.latitude,
        longitude: event.longitude,
        accuracy: event.accuracy,
        speed: event.speed,
        heading: event.heading,
      },
      timestamp: event.timestamp.toISOString(),
      createdAt: event.createdAt.toISOString(),
    }));

    return corsJsonResponse({
      success: true,
      count: formattedEvents.length,
      events: formattedEvents,
    });
  } catch (error) {
    console.error('[GET /api/events] Error:', error);
    return corsJsonResponse(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
