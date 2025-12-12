// Database logging adapter - logs all geofence events to the database
import { prisma } from '@/src/lib/prisma';
import { EventAdapter, GeofenceEventData } from './types';

export class LoggerAdapter implements EventAdapter {
  name = 'logger';
  enabled = true; // Always enabled for audit/debugging

  async onEnter(event: GeofenceEventData): Promise<void> {
    await this.logEvent(event);
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    await this.logEvent(event);
  }

  private async logEvent(event: GeofenceEventData): Promise<void> {
    try {
      await prisma.geofenceEvent.create({
        data: {
          appId: event.appId,
          userId: event.userId,
          eventType: event.eventType,
          geofenceId: event.geofence.id,
          latitude: event.position.latitude,
          longitude: event.position.longitude,
          accuracy: event.position.accuracy,
          speed: event.position.speed,
          heading: event.position.heading,
          timestamp: event.timestamp,
        },
      });

      console.log(
        `[LoggerAdapter] Logged ${event.eventType} event for user ${event.userId} in app ${event.appId} at geofence ${event.geofence.name}`
      );
    } catch (error) {
      console.error('[LoggerAdapter] Failed to log event:', error);
      throw error;
    }
  }
}
