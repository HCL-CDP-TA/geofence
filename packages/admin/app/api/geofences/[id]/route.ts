// Geofence CRUD API - Update and Delete

import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { updateGeofenceSchema } from '@/src/lib/validations';

// PATCH /api/geofences/[id] - Update a geofence
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const result = updateGeofenceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    // Check if geofence exists
    const existingGeofence = await prisma.geofence.findUnique({
      where: { id },
    });

    if (!existingGeofence) {
      return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
    }

    // Update geofence
    const geofence = await prisma.geofence.update({
      where: { id },
      data: result.data,
    });

    return NextResponse.json({
      geofence,
      message: 'Geofence updated successfully',
    });
  } catch (error) {
    console.error('Error updating geofence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/geofences/[id] - Delete a geofence
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if geofence exists
    const existingGeofence = await prisma.geofence.findUnique({
      where: { id },
    });

    if (!existingGeofence) {
      return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
    }

    // Delete geofence
    await prisma.geofence.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Geofence deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
