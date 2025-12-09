# Geofence SDK Test App

A test application for the `@geofence/sdk` that provides dual-mode testing with manual position control and real GPS tracking.

## Features

- **Dual Testing Modes**:
  - **Manual Mode**: Set custom latitude/longitude coordinates for precise testing
  - **GPS Mode**: Real browser geolocation with automatic map following (works with Chrome DevTools Sensors)
- **Dual Evaluation Modes**:
  - **Client-Side Evaluation**: Geofences evaluated locally in the browser (default)
  - **Server-Side Evaluation**: Position sent to server, events returned from server
- **Interactive Map**: Visualize geofences and current position with Leaflet
- **Event Logging**: Real-time display of enter/exit/position/error events
- **Quick Positions**: Pre-configured city locations for testing
- **Active Geofence Tracking**: See which geofences you're currently inside
- **Manual Geofence Refresh**: Update geofences without restarting the monitor

## Prerequisites

1. The admin app must be running on `http://localhost:3000`
2. At least one geofence must be created in the admin app
3. Node.js and npm installed

## Getting Started

### 1. Start the Admin App

First, make sure the admin app is running with some geofences:

```bash
# From the repository root
npm run dev
```

Create some test geofences in the admin UI at `http://localhost:3000`

### 2. Start the Test App

In a new terminal:

```bash
# From the repository root
npm run dev:test

# Or from the test-app directory
cd packages/test-app
npm run dev
```

The test app will open at `http://localhost:5173` (or another port if 5173 is in use)

## How to Use

### Choosing Position Mode

Toggle between **Manual** and **GPS** mode before or during monitoring:

#### Manual Mode (Default)
- **Purpose**: Precise position control for testing specific coordinates
- **Position Control**:
  1. Enter latitude/longitude in input fields and click "Update Position"
  2. Click anywhere on the map to set that location
  3. Click inside geofence circles to jump directly into them
  4. Use quick position buttons (SF, NY, London, Tokyo)
  5. Click "Use Current Location" to get your real GPS once
- **Map Behavior**: Map stays where you position it (doesn't auto-follow)

#### GPS Mode
- **Purpose**: Realistic testing with automatic GPS tracking
- **Position Control**:
  - Uses real browser geolocation API (polls every 5 seconds)
  - Works with Chrome DevTools → Sensors tab for GPS emulation
  - Manual position controls are disabled in this mode
- **Map Behavior**: Map automatically follows your GPS position with smooth panning
- **How to Test**:
  1. Switch to GPS mode
  2. Open Chrome DevTools (F12) → Sensors tab
  3. Select a preset location or enter custom lat/lng
  4. Start monitoring - map will follow as you change locations

### Choosing Evaluation Mode

Toggle between **Client Mode** and **Server Mode** before or during monitoring:

#### Client-Side Evaluation (Default)
- **Purpose**: Geofences are fetched and evaluated locally in the browser
- **How it works**:
  - SDK fetches geofences from `GET /api/public/geofences`
  - Distance calculations performed locally using Haversine formula
  - Events fired immediately when transitions detected
  - No network requests during monitoring (only initial fetch)
- **When to use**: For most testing scenarios, simple integrations
- **Network**: Minimal (one-time geofence fetch)

#### Server-Side Evaluation
- **Purpose**: Server evaluates geofences and fires events to adapters
- **How it works**:
  - Position sent to server `POST /api/events/position` only when moved >50 meters
  - Server evaluates geofences and detects transitions
  - Server dispatches events to configured adapters (CDP, webhooks, database logger)
  - Server returns events in response, which SDK emits locally
- **When to use**: Testing martech integrations, webhooks, CDP event routing
- **Network**: Position sent only when significant movement detected
- **User ID**: Enter a user ID (defaults to "test-user-1") to identify the user in the server

**To switch modes:**
1. Enter a User ID in the text field
2. Click "Client Mode" or "Server Mode" button
3. Monitor will restart with the new configuration
4. Event log will show which mode is active

### Monitor Controls

- **Start Monitoring**: Fetches geofences from the API and begins monitoring
- **Stop Monitoring**: Stops the geofence monitoring
- **Refresh Geofences**: Manually reload geofences from the server without restarting (Client mode only)

### Event Log

The event log shows:
- **Enter events** (green): When you move into a geofence
- **Exit events** (red): When you leave a geofence
- **Position events** (blue): When your position is updated
- **Error events** (red): If any errors occur

### Geofence List

Shows all loaded geofences with:
- Name and coordinates
- Radius in meters
- **Active highlight** (green): Geofences you're currently inside

### Map Visualization

- **Blue marker**: Your current position
- **Green circles**: Geofence boundaries
- **Orange circles**: Active geofences (you're inside)
- Click on circles to see geofence details

## Testing Workflows

### Manual Mode Testing
1. Start the admin app and create a geofence (e.g., center at 37.7749, -122.4194 with 1000m radius)
2. Start the test app (defaults to Manual mode)
3. Click "Start Monitoring"
4. Set a position outside the geofence (e.g., 37.7600, -122.4000)
5. Gradually move the position closer to enter the geofence
6. Watch for "Entered" events in the log
7. Move away to see "Exited" events

### GPS Mode Testing (with Chrome DevTools)
1. Start the admin app and create geofences in different locations
2. Start the test app
3. Switch to **GPS mode**
4. Open Chrome DevTools (F12) → More tools → Sensors
5. Select a location in the Sensors tab (e.g., "San Francisco")
6. Click "Start Monitoring"
7. Map will auto-center on your GPS location
8. Change location in Sensors tab (e.g., switch to "Tokyo")
9. Within 5 seconds, watch the map pan to the new location
10. Observe enter/exit events as you move between locations

### Testing Geofence Refresh
1. While monitoring is active, go to the admin app
2. Create a new geofence or modify an existing one
3. Return to the test app
4. Click "🔄 Refresh Geofences"
5. The new/updated geofences will appear without restarting

## SDK Configuration Examples

The test app demonstrates all SDK modes and configurations:

### Manual Mode + Client-Side Evaluation (Default)
```javascript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  pollingInterval: 1000,
  debug: true,
  testMode: true  // Enables manual position control
});

// Set custom position
monitor.setTestPosition(37.7749, -122.4194);
```

### GPS Mode + Client-Side Evaluation
```javascript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  pollingInterval: 1000,
  debug: true,
  testMode: false  // Uses real browser geolocation
});

// Position is automatically polled from navigator.geolocation
```

### Manual Mode + Server-Side Evaluation
```javascript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  userId: 'test-user-1',
  enableServerEvaluation: true,
  significantMovementThreshold: 50,
  pollingInterval: 1000,
  debug: true,
  testMode: true
});

// Set custom position - will be sent to server when >50m movement
monitor.setTestPosition(37.7749, -122.4194);
```

### GPS Mode + Server-Side Evaluation
```javascript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  userId: 'test-user-1',
  enableServerEvaluation: true,
  significantMovementThreshold: 50,
  pollingInterval: 1000,
  debug: true,
  testMode: false
});

// Position automatically polled and sent to server when >50m movement
```

## Testing Server-Side Integrations

### Testing CDP Adapter

1. Configure CDP credentials in admin app `.env`:
   ```bash
   CDP_API_KEY="your-cdp-api-key"
   CDP_PASS_KEY="your-cdp-pass-key"
   CDP_ENDPOINT="https://pl.dev.hxcd.now.hclsoftware.cloud"
   ```

2. In test app:
   - Enter a User ID (e.g., "test-user-1")
   - Switch to **Server Mode**
   - Start monitoring
   - Move position to enter/exit geofences

3. Check CDP dashboard:
   - Events should appear as "HTTP API" source (not "JavaScript/Web")
   - Event type: "Geofence Enter" or "Geofence Exit"
   - User ID: "test-user-1"

### Testing Webhook Adapter

1. Set up a webhook endpoint (e.g., webhook.site)

2. Configure webhook URL in admin app `.env`:
   ```bash
   GEOFENCE_WEBHOOK_URL="https://webhook.site/your-unique-url"
   ```

3. In test app:
   - Switch to **Server Mode**
   - Start monitoring and trigger events

4. View webhook payloads at your webhook endpoint

### Viewing Logged Events

All events are logged to the database regardless of adapter configuration:

1. Use the API endpoint:
   ```bash
   curl http://localhost:3000/api/events?userId=test-user-1
   ```

2. Or use Prisma Studio:
   ```bash
   cd packages/admin
   npx prisma studio
   ```
   Navigate to the `GeofenceEvent` table

## Troubleshooting

**No geofences loaded**
- Make sure the admin app is running
- Check that you've created at least one enabled geofence
- Verify the API URL is correct (http://localhost:3000)

**Events not firing (Manual Mode)**
- Ensure monitoring is started
- Check that you've set a position using "Update Position"
- Verify the position is within/outside the geofence radius
- Check the browser console for errors

**GPS Mode not updating**
- Ensure you've granted location permission when prompted
- Check that Chrome DevTools Sensors tab is open and location is set
- Verify location permission isn't blocked (check browser address bar icon)
- Position updates every 5 seconds - wait for the next poll cycle
- Check browser console for "Geolocation error" messages

**Map not following in GPS Mode**
- Verify you've switched to GPS mode (button should be green/active)
- Check that monitoring is started
- Look for position updates in the event log
- Browser console should show `[GeofenceMonitor] Position: ...` every 5s

**"No test position set" error**
- This is expected in Manual mode if you haven't set a position yet
- Click "Update Position", use a quick button, or click the map

**Map not loading**
- Check your internet connection (Leaflet tiles require internet)
- Look for errors in the browser console

**Server Mode events not firing**
- Ensure you've entered a User ID
- Check admin app is running and database is connected
- Verify you've moved >50 meters (significant movement threshold)
- Check admin app console for server-side logs
- Use browser network tab to verify `POST /api/events/position` requests

**Adapters not working**
- Check admin app `.env` for correct credentials
- Verify environment variables are loaded (restart admin app)
- Check admin app console for adapter error logs
- All adapters fail gracefully - check console for specific errors
- LoggerAdapter always works - check `GET /api/events` endpoint
