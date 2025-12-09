# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a geofencing monorepo that consists of:
- **packages/admin**: Next.js 16 admin dashboard for managing geofences (uses App Router)
- **packages/sdk**: Browser-based geofencing SDK that monitors user location and detects geofence entry/exit events
- **packages/test-app**: Test application for the SDK with manual position control and visualization

## Architecture

### Admin App (packages/admin)
- **Framework**: Next.js 16 with App Router and React 19
- **Database**: PostgreSQL with Prisma ORM (v7 using pg adapter)
- **Authentication**: NextAuth.js v5 with credentials provider (bcrypt for password hashing)
- **Session**: JWT-based session strategy
- **Styling**: Tailwind CSS v4
- **Map Library**: Leaflet with react-leaflet for geofence visualization

### SDK (packages/sdk)
- **Purpose**: Browser-based geofencing library that uses the Geolocation API
- **Build Tool**: tsup for dual ESM/CJS builds with TypeScript declarations
- **Core Class**: `GeofenceMonitor` - event-driven API for monitoring geofence entry/exit
- **Distance Calculation**: Haversine formula implementation in [packages/sdk/src/utils/distance.ts](packages/sdk/src/utils/distance.ts)
- **Test Mode**: Supports `testMode: true` option to enable manual position control via `setTestPosition(lat, lng)`
- **Manual Refresh**: `refreshGeofences()` method to update geofences without restarting monitor
- **Configurable Polling**: `pollingInterval` option controls how often position is checked (default: 10000ms)
- **Evaluation Modes**:
  - **Client-Side** (default): SDK fetches geofences and evaluates locally
  - **Server-Side**: SDK sends position to server, which evaluates and returns events (requires `userId` and `enableServerEvaluation: true`)

### Test App (packages/test-app)
- **Purpose**: Interactive test environment for the SDK with dual-mode testing capability
- **Framework**: Vite for fast dev server and hot reload
- **Features**:
  - **Manual Mode**: Set position via input fields, map clicks, or quick position buttons
  - **GPS Mode**: Real browser geolocation with map auto-following (works with Chrome DevTools Sensors tab)
  - **Client/Server Evaluation Toggle**: Switch between client-side and server-side evaluation modes
  - Interactive Leaflet map with geofence visualization
  - Real-time event log showing enter/exit/position/error events
  - Geofence list with active state indicators
  - Manual geofence refresh capability
  - User ID configuration for server-side testing
- **Usage**: Comprehensive testing environment for geofence entry/exit without requiring physical movement, plus server-side integration testing

### Database Schema
Located in [packages/admin/prisma/schema.prisma](packages/admin/prisma/schema.prisma):
- **User**: Authentication users with bcrypt-hashed passwords
- **Geofence**: Geographic zones with latitude, longitude, radius, and enabled status
- **UserGeofenceState**: Tracks active geofences per user for server-side evaluation
- **GeofenceEvent**: Logs all enter/exit events (used by LoggerAdapter)

### API Routes
All routes in [packages/admin/app/api](packages/admin/app/api):
- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers (login/logout)
- `GET /api/geofences` - List geofences (authenticated)
- `POST /api/geofences` - Create geofence (authenticated)
- `PUT /api/geofences/[id]` - Update geofence (authenticated)
- `DELETE /api/geofences/[id]` - Delete geofence (authenticated)
- `GET /api/public/geofences` - Public endpoint for SDK to fetch enabled geofences (client-side mode)
- `POST /api/events/position` - Position reporting for server-side geofence evaluation (server-side mode)
- `GET /api/events` - View logged geofence events with filtering (authenticated)

### Event Adapter System (Server-Side Mode)

The server-side evaluation mode uses a **pluggable adapter pattern** to route geofence events to external systems:

**Core Components**:
- `GeofenceEvaluator` ([packages/admin/src/lib/services/geofence-evaluator.ts](packages/admin/src/lib/services/geofence-evaluator.ts)) - Evaluates position against geofences, maintains user state, dispatches events to adapters
- Adapter types ([packages/admin/src/lib/adapters/types.ts](packages/admin/src/lib/adapters/types.ts)) - `EventAdapter` interface for pluggable integrations
- Adapter registry ([packages/admin/src/lib/adapters/index.ts](packages/admin/src/lib/adapters/index.ts)) - `createAdapterConfig()` initializes all adapters, `dispatchEvent()` calls adapters in parallel

**Built-in Adapters**:
1. **LoggerAdapter** ([packages/admin/src/lib/adapters/logger.ts](packages/admin/src/lib/adapters/logger.ts)) - Always enabled, logs events to `GeofenceEvent` table
2. **WebhookAdapter** ([packages/admin/src/lib/adapters/webhook.ts](packages/admin/src/lib/adapters/webhook.ts)) - POSTs to `GEOFENCE_WEBHOOK_URL` if configured
3. **CDPAdapter** ([packages/admin/src/lib/adapters/cdp.ts](packages/admin/src/lib/adapters/cdp.ts)) - Sends track events to HCL CDP if `CDP_API_KEY` and `CDP_PASS_KEY` configured

**Adding Custom Adapters**:
- Implement `EventAdapter` interface (`onEnter()`, `onExit()`)
- Register in `createAdapterConfig()`
- Configure via environment variables
- See [docs/ADAPTERS.md](docs/ADAPTERS.md) for detailed guide

### Authentication Flow
NextAuth v5 configuration in [packages/admin/src/lib/auth.ts](packages/admin/src/lib/auth.ts):
- Credentials provider validates email/password using Zod schemas from [packages/admin/src/lib/validations.ts](packages/admin/src/lib/validations.ts)
- Passwords are hashed with bcrypt before storage
- JWT tokens include user ID in the session
- Login page at `/login`

### Prisma Setup
Prisma client singleton in [packages/admin/src/lib/prisma.ts](packages/admin/src/lib/prisma.ts):
- Uses `@prisma/adapter-pg` with `pg` connection pool (required for Prisma v7)
- Singleton pattern prevents multiple instances during dev hot-reload
- Requires `DATABASE_URL` environment variable

## Common Development Commands

### Monorepo Root
```bash
npm run dev          # Start admin app dev server
npm run dev:test     # Start test app dev server
npm run build        # Build all workspaces
npm run lint         # Lint all workspaces
```

### Admin App (packages/admin)
```bash
npm run dev -w admin         # Start Next.js dev server (port 3000)
npm run build -w admin       # Build for production
npm run start -w admin       # Start production server
npm run lint -w admin        # Run ESLint

# Prisma commands
npx prisma migrate dev -w admin      # Run migrations in dev
npx prisma migrate deploy -w admin   # Deploy migrations to prod
npx prisma generate -w admin         # Generate Prisma Client
npx prisma studio -w admin           # Open Prisma Studio UI
```

### SDK (packages/sdk)
```bash
npm run build -w sdk        # Build SDK (outputs to dist/)
npm run dev -w sdk          # Build SDK in watch mode
```

### Test App (packages/test-app)
```bash
npm run dev:test            # Start test app (from root)
npm run dev -w test-app     # Alternative: start with workspace flag
```

## Environment Setup

The admin app requires a `.env` file at [packages/admin/.env](packages/admin/.env):
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/geofence"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Event Adapters (optional - only needed for server-side evaluation mode)

# Webhook Adapter - POST geofence events to this URL
GEOFENCE_WEBHOOK_URL="https://your-webhook-endpoint.com/geofence-events"

# HCL CDP Adapter - Send events to HCL Customer Data Platform
CDP_API_KEY="your-cdp-api-key"
CDP_PASS_KEY="your-cdp-pass-key"
CDP_ENDPOINT="https://pl.dev.hxcd.now.hclsoftware.cloud"
```

## Key Implementation Details

### SDK Usage Pattern

The SDK supports two evaluation modes:

**Client-Side Mode (Default)**:
```typescript
import { GeofenceMonitor } from '@geofence/sdk';

const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  pollingInterval: 10000,  // Check position every 10s
  enableHighAccuracy: true,
  debug: false,
  testMode: false  // Set true for manual position control
});

monitor.on('enter', (geofence) => console.log('Entered:', geofence.name));
monitor.on('exit', (geofence) => console.log('Exited:', geofence.name));

await monitor.start();

// Manually refresh geofences when they may have changed
await monitor.refreshGeofences();
```

**Server-Side Mode (For Martech Integrations)**:
```typescript
import { GeofenceMonitor } from '@geofence/sdk';

const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  userId: 'user-123',                    // Required for server mode
  enableServerEvaluation: true,          // Enable server-authoritative mode
  significantMovementThreshold: 50,      // Only report when moved >50m (default: 50)
  pollingInterval: 10000,
  enableHighAccuracy: true,
  debug: false,
  testMode: false
});

monitor.on('enter', (geofence) => {
  console.log('Entered:', geofence.name);
  // Event came from server evaluation
  // Server has already fired adapters (CDP, webhooks, etc.)
});

monitor.on('exit', (geofence) => console.log('Exited:', geofence.name));

await monitor.start();
```

**Server-Side Mode Behavior**:
- Client polls GPS every `pollingInterval` ms
- Position sent to server only when moved > `significantMovementThreshold` meters
- Server evaluates geofences and returns enter/exit events
- Server dispatches events to configured adapters (CDP, webhooks, database logger)
- Client receives events from server response and emits locally

**Note**: For scalability considerations and best practices, see [SCALABILITY.md](SCALABILITY.md).

## Implementing the SDK in Your Project

### Installation

The SDK is currently a local package in this monorepo. To use it in another project:

**Option 1: Link locally (for development)**
```bash
# In the SDK directory
cd packages/sdk
npm link

# In your project
npm link @geofence/sdk
```

**Option 2: Install from file path**
```bash
npm install /path/to/geofence/packages/sdk
```

**Option 3: Publish to npm (for production)**
Publish the SDK package to npm or a private registry, then:
```bash
npm install @geofence/sdk
```

### Basic Integration

```typescript
import { GeofenceMonitor } from '@geofence/sdk';

// Initialize the monitor
const monitor = new GeofenceMonitor({
  apiUrl: 'https://your-api-server.com',  // URL to your geofence API
  pollingInterval: 10000,                  // Check position every 10s (default)
  enableHighAccuracy: true,                // Request high-accuracy GPS (default: true)
  debug: false,                            // Enable debug logging (default: false)
  testMode: false                          // Use test mode for manual control (default: false)
});

// Set up event listeners
monitor.on('enter', (geofence) => {
  console.log(`User entered: ${geofence.name}`);
  // Handle geofence entry (show notification, update UI, etc.)
});

monitor.on('exit', (geofence) => {
  console.log(`User exited: ${geofence.name}`);
  // Handle geofence exit
});

monitor.on('position', (position) => {
  console.log(`Position update: ${position.coords.latitude}, ${position.coords.longitude}`);
  // Optional: Update UI with current position
});

monitor.on('error', (error) => {
  console.error('Geofence monitor error:', error.message);
  // Handle errors (permission denied, network issues, etc.)
});

// Start monitoring
try {
  await monitor.start();
  console.log('Geofence monitoring started');
} catch (error) {
  console.error('Failed to start monitoring:', error);
}

// Stop monitoring when done
// monitor.stop();
```

### Required API Endpoint

Your backend must provide a public endpoint that returns enabled geofences:

**Endpoint**: `GET /api/public/geofences`

**Response format**:
```json
[
  {
    "id": "uuid",
    "name": "Store Location",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "radius": 100,
    "enabled": true
  }
]
```

**Reference implementation**: See [packages/admin/app/api/public/geofences/route.ts](packages/admin/app/api/public/geofences/route.ts)

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | **required** | Base URL of your geofence API server |
| `pollingInterval` | number | 10000 | How often to check position (milliseconds) |
| `enableHighAccuracy` | boolean | true | Request high-accuracy GPS from browser |
| `debug` | boolean | false | Enable console debug logging |
| `testMode` | boolean | false | Enable manual position control for testing |

### Advanced Features

#### Manual Geofence Refresh
If geofences are updated on the server, refresh them without restarting:
```typescript
await monitor.refreshGeofences();
```

#### Get Current Status
```typescript
const status = monitor.getStatus();
console.log(status.isRunning);          // boolean
console.log(status.geofenceCount);      // number of loaded geofences
console.log(status.activeGeofences);    // array of currently active geofence IDs
```

#### Get Loaded Geofences
```typescript
const geofences = monitor.getGeofences();
// Returns array of all loaded geofences
```

#### Test Mode (for development)
```typescript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  testMode: true  // Enable manual position control
});

await monitor.start();

// Manually set position instead of using GPS
monitor.setTestPosition(37.7749, -122.4194);
```

### Browser Permissions

The SDK requires browser geolocation permission. Handle the permission flow in your UI:

```typescript
// Check if geolocation is supported
if (!navigator.geolocation) {
  console.error('Geolocation not supported');
}

// The browser will prompt for permission when monitor.start() is called
// Handle permission denial via the 'error' event
monitor.on('error', (error) => {
  if (error.message.includes('Permission denied')) {
    // Show UI explaining why location access is needed
  }
});
```

### Framework-Specific Examples

#### React
```typescript
import { useEffect, useState } from 'react';
import { GeofenceMonitor } from '@geofence/sdk';

function App() {
  const [monitor, setMonitor] = useState(null);
  const [activeGeofences, setActiveGeofences] = useState([]);

  useEffect(() => {
    const geofenceMonitor = new GeofenceMonitor({
      apiUrl: 'https://your-api.com',
      debug: true
    });

    geofenceMonitor.on('enter', (geofence) => {
      setActiveGeofences(prev => [...prev, geofence]);
    });

    geofenceMonitor.on('exit', (geofence) => {
      setActiveGeofences(prev => prev.filter(g => g.id !== geofence.id));
    });

    geofenceMonitor.start();
    setMonitor(geofenceMonitor);

    return () => {
      geofenceMonitor.stop();
    };
  }, []);

  return (
    <div>
      <h1>Active Geofences: {activeGeofences.length}</h1>
      {activeGeofences.map(g => (
        <div key={g.id}>{g.name}</div>
      ))}
    </div>
  );
}
```

#### Vue 3
```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { GeofenceMonitor } from '@geofence/sdk';

export default {
  setup() {
    const activeGeofences = ref([]);
    let monitor = null;

    onMounted(async () => {
      monitor = new GeofenceMonitor({
        apiUrl: 'https://your-api.com',
        debug: true
      });

      monitor.on('enter', (geofence) => {
        activeGeofences.value.push(geofence);
      });

      monitor.on('exit', (geofence) => {
        activeGeofences.value = activeGeofences.value.filter(
          g => g.id !== geofence.id
        );
      });

      await monitor.start();
    });

    onUnmounted(() => {
      if (monitor) {
        monitor.stop();
      }
    });

    return { activeGeofences };
  }
};
```

### Geofence Detection Algorithm
- Fetches enabled geofences from `/api/public/geofences` once at startup
- Polls user's position using Geolocation API at configured interval (default: 10s)
- Calculates distance using Haversine formula against cached geofences
- Emits 'enter' event when user enters a geofence radius
- Emits 'exit' event when user leaves a geofence radius
- Maintains state of currently active geofences to detect transitions
- **Note**: Geofences are cached after initial fetch - use `refreshGeofences()` to update

### Frontend Components
UI components in [packages/admin/src/components](packages/admin/src/components):
- `GeofenceList`: Displays and manages geofences with inline editing
- `GeofenceForm`: Modal form for creating/editing geofences
- `LeafletMap`: Interactive map for visualizing and creating geofences
- UI primitives: Button, Modal, Switch (custom Tailwind components)

## Development Workflow

1. **Database Setup**: Create PostgreSQL database, configure `DATABASE_URL`, run `npx prisma migrate dev -w admin`
2. **Start Dev**: Run `npm run dev` from root to start admin app
3. **SDK Development**: Use `npm run dev -w sdk` for watch mode when developing SDK features
4. **Testing Geofences**: Use the admin UI at `http://localhost:3000` (requires login)
5. **SDK Testing**: Use `npm run dev:test` to start the test app
   - **Manual Mode**: Set positions via input fields, map clicks, or quick buttons
   - **GPS Mode**: Use Chrome DevTools Sensors tab to emulate GPS locations - map auto-follows position

## Important Notes

- The admin app uses Next.js 16 App Router - all pages are in `packages/admin/app/`
- Server-side code can import from `@/lib/auth` and `@/lib/prisma`
- Prisma Client must be regenerated after schema changes: `npx prisma generate -w admin`
- The SDK has no dependencies (except dev dependencies) - keep it lightweight for browser use
- All authenticated API routes should use `auth()` from [packages/admin/src/lib/auth.ts](packages/admin/src/lib/auth.ts) to verify session
- **Scalability**: Current implementation fetches ALL geofences at startup - suitable for <100 geofences. See [SCALABILITY.md](SCALABILITY.md) for scaling strategies
