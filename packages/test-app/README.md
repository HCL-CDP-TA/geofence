# Geofence SDK Test App

A test application for the `@geofence/sdk` that provides dual-mode testing with manual position control and real GPS tracking.

## Features

- **Dual Testing Modes**:
  - **Manual Mode**: Set custom latitude/longitude coordinates for precise testing
  - **GPS Mode**: Real browser geolocation with automatic map following (works with Chrome DevTools Sensors)
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

### Choosing a Mode

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

### Monitor Controls

- **Start Monitoring**: Fetches geofences from the API and begins monitoring
- **Stop Monitoring**: Stops the geofence monitoring
- **Refresh Geofences**: Manually reload geofences from the server without restarting

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

## SDK Modes

The test app demonstrates both SDK modes:

### Manual Mode (Test Mode)
```javascript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  pollingInterval: 5000,
  debug: true,
  testMode: true  // Enables manual position control
});

// Set custom position
monitor.setTestPosition(37.7749, -122.4194);
```

### GPS Mode (Production Mode)
```javascript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  pollingInterval: 5000,
  debug: true,
  testMode: false  // Uses real browser geolocation
});

// Position is automatically polled from navigator.geolocation
```

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
