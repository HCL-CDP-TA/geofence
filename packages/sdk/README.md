# @geofence/sdk

A browser-based geofencing SDK for detecting when users enter or exit defined geographic areas.

## Features

- Real-time geolocation tracking with configurable polling intervals
- Event-driven architecture for geofence entry/exit detection
- TypeScript support with full type definitions
- Lightweight with no external dependencies
- Works with any geofence management backend

## Installation

```bash
npm install @geofence/sdk
```

## Quick Start

```typescript
import { GeofenceMonitor } from "@geofence/sdk"

// Initialize the monitor
const monitor = new GeofenceMonitor({
  apiUrl: "https://your-geofence-api.com",
  pollingInterval: 5000, // Check location every 5 seconds
  enableHighAccuracy: true,
  debug: true, // Enable console logging
})

// Listen for geofence events
monitor.on("enter", geofence => {
  console.log(`Entered geofence: ${geofence.name}`)
  // Send event to your analytics platform (e.g., HCL CDP)
  sendToAnalytics({
    event: "geofence_enter",
    geofenceId: geofence.id,
    geofenceName: geofence.name,
  })
})

monitor.on("exit", geofence => {
  console.log(`Exited geofence: ${geofence.name}`)
  sendToAnalytics({
    event: "geofence_exit",
    geofenceId: geofence.id,
    geofenceName: geofence.name,
  })
})

monitor.on("error", error => {
  console.error("Geofence monitoring error:", error)
})

monitor.on("position", position => {
  console.log("Current position:", position.coords.latitude, position.coords.longitude)
})

// Start monitoring
await monitor.start()

// Later: stop monitoring
monitor.stop()
```

## API Reference

### `GeofenceMonitor`

The main class for monitoring geofences.

#### Constructor

```typescript
new GeofenceMonitor(options: GeofenceMonitorOptions)
```

**Options:**

| Option               | Type      | Default  | Description                                |
| -------------------- | --------- | -------- | ------------------------------------------ |
| `apiUrl`             | `string`  | Required | Base URL of your geofence API              |
| `pollingInterval`    | `number`  | `10000`  | How often to check location (milliseconds) |
| `enableHighAccuracy` | `boolean` | `true`   | Use GPS for high accuracy positioning      |
| `debug`              | `boolean` | `false`  | Enable debug logging to console            |

#### Methods

##### `start(): Promise<void>`

Start monitoring geofences. Fetches geofences from the API and begins tracking user location.

```typescript
await monitor.start()
```

##### `stop(): void`

Stop monitoring geofences and clear all intervals.

```typescript
monitor.stop()
```

##### `getStatus(): MonitorStatus`

Get the current monitoring status.

```typescript
const status = monitor.getStatus()
console.log("Is running:", status.isRunning)
console.log("Current geofences:", status.currentGeofences)
console.log("Last position:", status.lastPosition)
```

**Returns:**

```typescript
{
  isRunning: boolean;
  currentGeofences: Geofence[];
  lastPosition: GeolocationPosition | null;
}
```

##### `checkPosition(): Promise<void>`

Manually trigger a position check (useful for testing).

```typescript
await monitor.checkPosition()
```

##### `on(event: GeofenceEvent, listener: Function): void`

Add an event listener.

**Events:**

- `'enter'` - Fired when entering a geofence. Receives `Geofence` object.
- `'exit'` - Fired when exiting a geofence. Receives `Geofence` object.
- `'position'` - Fired on each position update. Receives `GeolocationPosition` object.
- `'error'` - Fired on errors. Receives `Error` object.

```typescript
monitor.on("enter", (geofence: Geofence) => {
  // Handle entry
})
```

##### `off(event: GeofenceEvent, listener: Function): void`

Remove an event listener.

```typescript
const handleEnter = geofence => {
  /* ... */
}
monitor.on("enter", handleEnter)
monitor.off("enter", handleEnter)
```

### Types

#### `Geofence`

```typescript
interface Geofence {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number // in meters
}
```

#### `MonitorStatus`

```typescript
interface MonitorStatus {
  isRunning: boolean
  currentGeofences: Geofence[]
  lastPosition: GeolocationPosition | null
}
```

## Usage Examples

### React Integration

```tsx
import { useEffect, useState } from "react"
import { GeofenceMonitor, Geofence } from "@geofence/sdk"

function GeofenceTracker() {
  const [currentGeofences, setCurrentGeofences] = useState<Geofence[]>([])
  const [monitor] = useState(
    () =>
      new GeofenceMonitor({
        apiUrl: "https://api.example.com",
        pollingInterval: 5000,
      }),
  )

  useEffect(() => {
    monitor.on("enter", geofence => {
      console.log("Entered:", geofence.name)
      setCurrentGeofences(prev => [...prev, geofence])
    })

    monitor.on("exit", geofence => {
      console.log("Exited:", geofence.name)
      setCurrentGeofences(prev => prev.filter(g => g.id !== geofence.id))
    })

    monitor.on("error", error => {
      console.error("Error:", error)
    })

    monitor.start()

    return () => {
      monitor.stop()
    }
  }, [monitor])

  return (
    <div>
      <h2>Current Geofences</h2>
      {currentGeofences.length === 0 ? (
        <p>Not in any geofence</p>
      ) : (
        <ul>
          {currentGeofences.map(g => (
            <li key={g.id}>{g.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Next.js Integration

```tsx
"use client"

import { useEffect } from "react"
import { GeofenceMonitor } from "@geofence/sdk"

export default function GeofencePage() {
  useEffect(() => {
    const monitor = new GeofenceMonitor({
      apiUrl: process.env.NEXT_PUBLIC_API_URL!,
      pollingInterval: 5000,
      debug: process.env.NODE_ENV === "development",
    })

    monitor.on("enter", geofence => {
      console.log("Entered:", geofence.name)
    })

    monitor.on("exit", geofence => {
      console.log("Exited:", geofence.name)
    })

    monitor.start()

    return () => monitor.stop()
  }, [])

  return <div>Geofence tracking active</div>
}
```

## Browser Compatibility

The SDK requires browser support for:

- Geolocation API
- Fetch API
- ES6 features (Map, Set, Promise)

Supported browsers:

- Chrome 50+
- Firefox 52+
- Safari 10+
- Edge 14+

## Performance Considerations

### Battery Life

Frequent geolocation polling can drain battery. Consider:

- Use longer polling intervals (10-30 seconds) for better battery life
- Set `enableHighAccuracy: false` when precision isn't critical
- Stop monitoring when the app is backgrounded

### Accuracy

- GPS accuracy is typically 5-50 meters
- Use geofence radii of at least 100 meters for reliable detection
- Higher polling intervals may miss brief entries into small geofences

### Network Usage

- Geofences are fetched once on `start()`
- Each location check is local (no network requests)
- Consider refetching geofences periodically if they change frequently

## API Endpoint Requirements

The SDK expects a public API endpoint at `{apiUrl}/api/public/geofences` that returns:

```json
{
  "geofences": [
    {
      "id": "abc123",
      "name": "Downtown Store",
      "latitude": 40.7128,
      "longitude": -74.006,
      "radius": 500
    }
  ]
}
```

The endpoint should:

- Accept GET requests
- Return JSON with a `geofences` array
- Support CORS for browser requests
- Only return enabled/active geofences

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
