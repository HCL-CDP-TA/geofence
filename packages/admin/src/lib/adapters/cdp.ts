// HCL CDP adapter - tracks geofence events in HCL Customer Data Platform
// Reference: https://github.com/HCL-CDP-TA/cdp-node-sdk
import { EventAdapter, GeofenceEventData } from './types';

// Default endpoint for HCL CDP
const DEFAULT_CDP_ENDPOINT = 'https://crux.dev.hxcd.now.hclsoftware.cloud';

interface CDPApiConfig {
  apiKey: string;
  passKey: string;
  endpoint: string;
}

// CDP API request format matching the cdp-node-sdk payload structure
interface CDPEventPayload {
  type: 'track';
  eventname: string;
  userid: string;
  properties: Record<string, unknown>;
  context: {
    library: {
      name: string;
      version: string;
    };
  };
}

export class CDPAdapter implements EventAdapter {
  name = 'cdp';
  enabled: boolean;
  private config: CDPApiConfig | null = null;

  constructor() {
    const apiKey = process.env.CDP_API_KEY;
    const passKey = process.env.CDP_PASS_KEY;
    const endpoint = process.env.CDP_ENDPOINT || DEFAULT_CDP_ENDPOINT;

    if (apiKey && passKey) {
      this.config = { apiKey, passKey, endpoint };
      this.enabled = true;
      console.log('[CDPAdapter] Enabled with endpoint:', endpoint);
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
      // Build CDP payload matching the cdp-node-sdk format
      const cdpPayload: CDPEventPayload = {
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
        context: {
          library: {
            name: 'geofence-admin',
            version: '1.0.0',
          },
        },
      };

      // Send to CDP API using the correct endpoint path (/v3/data) and headers
      const response = await fetch(`${this.config.endpoint}/v3/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'x-api-passkey': this.config.passKey,
        },
        body: JSON.stringify(cdpPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CDP API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(
        `[CDPAdapter] Tracked event "${eventName}" for user ${event.userId} (id: ${result.id || 'unknown'})`
      );
    } catch (error) {
      console.error('[CDPAdapter] Failed to track event:', error);
      // Don't throw - CDP failures shouldn't block other adapters
    }
  }
}
