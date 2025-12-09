// HCL CDP adapter - tracks geofence events in HCL Customer Data Platform
// Reference: https://github.com/HCL-CDP-TA/cdp-node-sdk
import { EventAdapter, GeofenceEventData } from './types';

interface CDPApiConfig {
  apiKey: string;
  passKey: string;
  endpoint?: string;
}

interface CDPEventRequest {
  type: 'track';
  eventname: string;
  userid: string;
  properties: Record<string, any>;
}

export class CDPAdapter implements EventAdapter {
  name = 'cdp';
  enabled: boolean;
  private config: CDPApiConfig | null = null;

  constructor() {
    const apiKey = process.env.CDP_API_KEY;
    const passKey = process.env.CDP_PASS_KEY;
    const endpoint = process.env.CDP_ENDPOINT;

    if (apiKey && passKey) {
      this.config = { apiKey, passKey, endpoint };
      this.enabled = true;
      console.log('[CDPAdapter] Enabled with endpoint:', endpoint || 'default');
    } else {
      this.enabled = false;
      console.log('[CDPAdapter] Disabled - CDP credentials not configured');
    }
  }

  async onEnter(event: GeofenceEventData): Promise<void> {
    await this.trackEvent('Geofence Entered', event);
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    await this.trackEvent('Geofence Exited', event);
  }

  private async trackEvent(eventName: string, event: GeofenceEventData): Promise<void> {
    if (!this.enabled || !this.config) return;

    try {
      const cdpEvent: CDPEventRequest = {
        type: 'track',
        eventname: eventName,
        userid: event.userId,
        properties: {
          geofence_id: event.geofence.id,
          geofence_name: event.geofence.name,
          geofence_latitude: event.geofence.latitude,
          geofence_longitude: event.geofence.longitude,
          geofence_radius: event.geofence.radius,
          user_latitude: event.position.latitude,
          user_longitude: event.position.longitude,
          accuracy: event.position.accuracy,
          speed: event.position.speed,
          heading: event.position.heading,
          timestamp: event.timestamp.toISOString(),
        },
      };

      // Send to CDP API
      // Note: Using fetch for now. Could integrate cdp-node-sdk package if needed.
      const endpoint = this.config.endpoint || 'https://default-cdp-endpoint.com/api';
      const response = await fetch(`${endpoint}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Pass-Key': this.config.passKey,
        },
        body: JSON.stringify(cdpEvent),
      });

      if (!response.ok) {
        throw new Error(`CDP API failed: ${response.status} ${response.statusText}`);
      }

      console.log(
        `[CDPAdapter] Tracked event "${eventName}" for user ${event.userId} to CDP`
      );
    } catch (error) {
      console.error('[CDPAdapter] Failed to track event:', error);
      // Don't throw - CDP failures shouldn't block other adapters
    }
  }
}
