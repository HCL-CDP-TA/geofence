// Position reporting endpoint for server-side geofence evaluation
import { NextResponse } from 'next/server';
import { corsJsonResponse, handleOptions } from '@/src/lib/cors';
import { GeofenceEvaluator } from '@/src/lib/services/geofence-evaluator';
import { z } from 'zod';

// Validation schema for position reports
const positionReportSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  timestamp: z.number(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
});

// OPTIONS /api/events/position - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions();
}

// POST /api/events/position - Report user position and receive geofence events
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const result = positionReportSchema.safeParse(body);
    if (!result.success) {
      return corsJsonResponse(
        {
          success: false,
          error: 'Invalid input',
          details: result.error.issues,
        },
        { status: 400 }
      );
    }

    const data = result.data;

    // Evaluate geofences
    const evaluator = new GeofenceEvaluator();
    const evaluationResult = await evaluator.evaluatePosition(data);

    return corsJsonResponse({
      success: true,
      events: evaluationResult.events,
    });
  } catch (error) {
    console.error('[POST /api/events/position] Error:', error);
    return corsJsonResponse(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
