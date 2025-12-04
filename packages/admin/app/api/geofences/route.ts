// Geofence CRUD API - List and Create

import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { createGeofenceSchema } from '@/src/lib/validations';

// GET /api/geofences - List all geofences
export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all geofences
    const geofences = await prisma.geofence.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ geofences });
  } catch (error) {
    console.error('Error fetching geofences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/geofences - Create a new geofence
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const result = createGeofenceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    // Create geofence
    const geofence = await prisma.geofence.create({
      data: result.data,
    });

    return NextResponse.json(
      { geofence, message: 'Geofence created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating geofence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
