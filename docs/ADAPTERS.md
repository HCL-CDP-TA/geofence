# Event Adapter System

This guide explains how to implement custom event adapters for routing geofence events to external systems.

## Overview

The geofencing system uses a pluggable adapter pattern to route geofence events (enter/exit) to various destinations:

- **Logger Adapter** - Logs to database (always enabled)
- **Webhook Adapter** - POSTs to webhook URL
- **CDP Adapter** - Sends to HCL Customer Data Platform
- **Custom Adapters** - Easy to add your own

## Architecture

When a user enters or exits a geofence in server evaluation mode:

1. Server evaluates position against geofences
2. Detects enter/exit transitions
3. Creates `GeofenceEventData` object
4. Calls all enabled adapters in parallel
5. Returns events to client SDK

## Creating a Custom Adapter

### Step 1: Implement the EventAdapter Interface

Create a new file in `packages/admin/src/lib/adapters/`:

```typescript
// packages/admin/src/lib/adapters/my-adapter.ts
import { EventAdapter, GeofenceEventData } from './types';

export class MyAdapter implements EventAdapter {
  name = 'my-adapter';
  enabled: boolean;
  private config: any;

  constructor() {
    // Initialize from environment variables
    const apiKey = process.env.MY_ADAPTER_API_KEY;

    if (apiKey) {
      this.config = { apiKey };
      this.enabled = true;
      console.log('[MyAdapter] Enabled');
    } else {
      this.enabled = false;
      console.log('[MyAdapter] Disabled - no API key configured');
    }
  }

  async onEnter(event: GeofenceEventData): Promise<void> {
    await this.sendEvent('enter', event);
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    await this.sendEvent('exit', event);
  }

  private async sendEvent(type: string, event: GeofenceEventData): Promise<void> {
    if (!this.enabled) return;

    try {
      // Your integration logic here
      const response = await fetch('https://your-api.com/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          type,
          appId: event.appId,
          userId: event.userId,
          geofence: event.geofence,
          position: event.position,
          timestamp: event.timestamp.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API failed: ${response.statusText}`);
      }

      console.log(`[MyAdapter] Sent ${type} event for user ${event.userId}`);
    } catch (error) {
      console.error('[MyAdapter] Failed to send event:', error);
      // Don't throw - adapter failures shouldn't block other adapters
    }
  }
}
```

### Step 2: Register the Adapter

Edit `packages/admin/src/lib/adapters/index.ts`:

```typescript
import { MyAdapter } from './my-adapter';

export function createAdapterConfig(): AdapterConfig {
  const adapters: EventAdapter[] = [];

  // Always include logger
  adapters.push(new LoggerAdapter());

  // Add webhook if configured
  const webhookAdapter = new WebhookAdapter();
  if (webhookAdapter.enabled) {
    adapters.push(webhookAdapter);
  }

  // Add CDP if configured
  const cdpAdapter = new CDPAdapter();
  if (cdpAdapter.enabled) {
    adapters.push(cdpAdapter);
  }

  // Add your custom adapter
  const myAdapter = new MyAdapter();
  if (myAdapter.enabled) {
    adapters.push(myAdapter);
  }

  return { adapters };
}
```

### Step 3: Add Configuration

Add to `packages/admin/.env`:

```bash
MY_ADAPTER_API_KEY=your-api-key-here
```

## Event Data Structure

Adapters receive `GeofenceEventData` objects:

```typescript
interface GeofenceEventData {
  appId: string;            // Application identifier (default: 'default-app')
  userId: string;           // User identifier
  eventType: 'enter' | 'exit';  // Event type
  geofence: {
    id: string;             // Geofence UUID
    name: string;           // Geofence name
    latitude: number;       // Center latitude
    longitude: number;      // Center longitude
    radius: number;         // Radius in meters
  };
  position: {
    latitude: number;       // User latitude
    longitude: number;      // User longitude
    accuracy: number;       // GPS accuracy in meters
    speed?: number | null;  // Speed in m/s (optional)
    heading?: number | null; // Heading in degrees (optional)
  };
  timestamp: Date;          // Event timestamp
}
```

**Multi-App Support**: The `appId` field enables multiple applications to share the same geofencing backend without user ID namespace collisions. Each application can track its own users independently using the composite key `(appId, userId)`.

## Built-in Adapters

### Logger Adapter

Always enabled. Logs all events to the `GeofenceEvent` database table.

**Configuration**: None (always on)

**Use Case**: Audit trail, debugging, analytics queries

### Webhook Adapter

POSTs events to a configurable webhook URL.

**Configuration**:
```bash
GEOFENCE_WEBHOOK_URL=https://your-webhook-endpoint.com/events
```

**Payload Format**:
```json
{
  "event_type": "enter",
  "app_id": "my-app-id",
  "user_id": "user-123",
  "geofence": {
    "id": "uuid",
    "name": "Store Location",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "radius": 100
  },
  "position": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 10,
    "speed": null,
    "heading": null
  },
  "timestamp": "2025-12-09T00:00:00.000Z"
}
```

**Use Case**: Integration with external systems, microservices, Zapier

### CDP Adapter

Sends track events to HCL Customer Data Platform.

**Configuration**:
```bash
CDP_API_KEY=your-api-key
CDP_PASS_KEY=your-passkey
CDP_ENDPOINT=https://your-cdp-instance.com/api
```

**Event Names**:
- `Geofence Entered`
- `Geofence Exited`

**Properties**:
```javascript
{
  app_id: "my-app-id",
  geofence_id: "uuid",
  geofence_name: "Store Location",
  geofence_latitude: 37.7749,
  geofence_longitude: -122.4194,
  geofence_radius: 100,
  user_latitude: 37.7749,
  user_longitude: -122.4194,
  accuracy: 10,
  speed: null,
  heading: null,
  timestamp: "2025-12-09T00:00:00.000Z"
}
```

**Use Case**: Marketing automation, customer journey tracking, analytics

## Best Practices

### Error Handling

Adapters should catch and log errors, but **not throw**. This prevents one failing adapter from blocking others.

```typescript
private async sendEvent(event: GeofenceEventData): Promise<void> {
  try {
    // Your integration logic
  } catch (error) {
    console.error('[MyAdapter] Failed:', error);
    // DON'T throw - just log and continue
  }
}
```

### Timeouts

Set reasonable timeouts for external API calls:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

try {
  await fetch(url, {
    signal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeout);
}
```

### Retry Logic

For critical integrations, implement retry logic:

```typescript
async sendWithRetry(data: any, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await this.send(data);
      return; // Success
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### Environment-Based Configuration

Use environment variables for configuration:

```typescript
constructor() {
  const config = {
    apiKey: process.env.MY_API_KEY,
    endpoint: process.env.MY_ENDPOINT || 'https://default.com',
    enabled: process.env.MY_ADAPTER_ENABLED === 'true',
  };

  this.enabled = config.enabled && !!config.apiKey;
}
```

## Testing Adapters

### Using the Test App

1. Start admin app: `npm run dev`
2. Start test app: `npm run dev:test`
3. Switch to "Server Mode" in test app
4. Set a userId
5. Start monitoring
6. Move across geofence boundaries
7. Check adapter logs/destination for events

### Manual Testing

Send a position report directly to the API:

```bash
curl -X POST http://localhost:3000/api/events/position \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "test-app",
    "userId": "test-user-1",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 10,
    "timestamp": 1701000000000
  }'
```

### Checking Logs

All adapters log to console. Check server logs for:

```
[LoggerAdapter] Logged enter event for user test-user-1 at geofence Store
[WebhookAdapter] Sent enter event for user test-user-1 to webhook
[CDPAdapter] Tracked event "Geofence Entered" for user test-user-1 to CDP
```

## Common Integration Examples

### Slack Notifications

```typescript
export class SlackAdapter implements EventAdapter {
  name = 'slack';
  enabled: boolean;
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    this.enabled = !!this.webhookUrl;
  }

  async onEnter(event: GeofenceEventData): Promise<void> {
    await this.sendSlackMessage(
      `🟢 User ${event.userId} entered ${event.geofence.name}`
    );
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    await this.sendSlackMessage(
      `🔴 User ${event.userId} exited ${event.geofence.name}`
    );
  }

  private async sendSlackMessage(text: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error('[SlackAdapter] Failed:', error);
    }
  }
}
```

### Email Notifications

```typescript
import nodemailer from 'nodemailer';

export class EmailAdapter implements EventAdapter {
  name = 'email';
  enabled: boolean;
  private transporter: any;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  async onEnter(event: GeofenceEventData): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.transporter.sendMail({
        from: 'geofence@example.com',
        to: 'admin@example.com',
        subject: `User entered ${event.geofence.name}`,
        text: `User ${event.userId} entered ${event.geofence.name} at ${event.timestamp}`,
      });
    } catch (error) {
      console.error('[EmailAdapter] Failed:', error);
    }
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    // Similar implementation
  }
}
```

### Google Analytics

```typescript
export class GoogleAnalyticsAdapter implements EventAdapter {
  name = 'google-analytics';
  enabled: boolean;
  private measurementId: string;
  private apiSecret: string;

  constructor() {
    this.measurementId = process.env.GA_MEASUREMENT_ID || '';
    this.apiSecret = process.env.GA_API_SECRET || '';
    this.enabled = !!(this.measurementId && this.apiSecret);
  }

  async onEnter(event: GeofenceEventData): Promise<void> {
    await this.sendEvent('geofence_enter', event);
  }

  async onExit(event: GeofenceEventData): Promise<void> {
    await this.sendEvent('geofence_exit', event);
  }

  private async sendEvent(eventName: string, event: GeofenceEventData): Promise<void> {
    if (!this.enabled) return;

    try {
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: event.userId,
            events: [{
              name: eventName,
              params: {
                geofence_name: event.geofence.name,
                geofence_id: event.geofence.id,
                latitude: event.position.latitude,
                longitude: event.position.longitude,
              },
            }],
          }),
        }
      );
    } catch (error) {
      console.error('[GoogleAnalyticsAdapter] Failed:', error);
    }
  }
}
```

## Troubleshooting

### Adapter Not Running

Check:
1. Environment variables are set correctly
2. Adapter is registered in `createAdapterConfig()`
3. `enabled` property is `true`
4. Console logs show adapter initialization

### Events Not Received

Check:
1. Server evaluation mode is enabled in SDK
2. User has moved >50m to trigger position report
3. Server logs show adapter execution
4. External API credentials are valid

### Performance Issues

If adapters are slow:
1. Add timeouts to prevent blocking
2. Use background queues for heavy processing
3. Batch multiple events if possible
4. Monitor adapter execution time

## Support

For questions or issues with the adapter system, please open an issue on GitHub.
