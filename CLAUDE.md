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
- **Geofence Shape**: 8-vertex polygons for precise geographic boundaries
- **Detection Algorithm**: Ray casting algorithm for point-in-polygon detection in [packages/sdk/src/utils/distance.ts](packages/sdk/src/utils/distance.ts)
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
- **Geofence**: Geographic zones defined as 8-vertex polygons stored in JSONB `coordinates` field, with enabled status
- **UserGeofenceState**: Tracks active geofences per (appId, userId) for server-side evaluation
  - Uses composite unique constraint `@@unique([appId, userId])` to support multiple apps
  - Default `appId: "default-app"` for backward compatibility
- **GeofenceEvent**: Logs all enter/exit events with appId tracking (used by LoggerAdapter)
  - Includes `appId` field with default `"default-app"`
  - Indexed on `appId` for efficient querying per application

### API Routes

All routes in [packages/admin/app/api](packages/admin/app/api):

- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers (login/logout)
- `GET /api/users` - List all users (authenticated, excludes password hashes)
- `PATCH /api/users/[id]` - Update user including password reset (authenticated via API key or session)
- `DELETE /api/users/[id]` - Delete user (authenticated via API key or session)
- `GET /api/geofences` - List geofences (authenticated)
- `POST /api/geofences` - Create geofence (authenticated)
- `PUT /api/geofences/[id]` - Update geofence (authenticated)
- `DELETE /api/geofences/[id]` - Delete geofence (authenticated)
- `GET /api/public/geofences` - Public endpoint for SDK to fetch enabled geofences (client-side mode)
- `POST /api/events/position` - Position reporting for server-side geofence evaluation (requires `appId` and `userId`)
- `GET /api/events` - View logged geofence events with filtering by appId, userId, geofence (authenticated)

### Event Adapter System (Server-Side Mode)

The server-side evaluation mode uses a **pluggable adapter pattern** to route geofence events to external systems:

**Core Components**:

- `GeofenceEvaluator` ([packages/admin/src/lib/services/geofence-evaluator.ts](packages/admin/src/lib/services/geofence-evaluator.ts)) - Evaluates position against geofences, maintains user state using composite keys `(appId, userId)`, dispatches events to adapters
- Adapter types ([packages/admin/src/lib/adapters/types.ts](packages/admin/src/lib/adapters/types.ts)) - `EventAdapter` interface for pluggable integrations, includes `appId` in event data
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

- Credentials provider validates username/password using Zod schemas from [packages/admin/src/lib/validations.ts](packages/admin/src/lib/validations.ts)
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

## Database Schema Changes - CRITICAL WORKFLOW

**IMPORTANT**: When modifying the Prisma schema, you **MUST** create a migration. The schema and migrations must always stay in sync.

### Correct Workflow for Schema Changes

1. **Edit the schema**: Modify [packages/admin/prisma/schema.prisma](packages/admin/prisma/schema.prisma)

2. **Create migration immediately**:

   ```bash
   cd packages/admin
   npx prisma migrate dev --name descriptive_migration_name
   ```

   This generates both the migration SQL file AND updates Prisma Client.

3. **Verify the migration**:

   - Check `packages/admin/prisma/migrations/[timestamp]_[name]/migration.sql`
   - Ensure it contains the expected ALTER/CREATE TABLE statements
   - Test locally that the migration applies cleanly

4. **Commit BOTH files together**:
   ```bash
   git add packages/admin/prisma/schema.prisma
   git add packages/admin/prisma/migrations/[timestamp]_[name]/
   git commit -m "feat(admin): add [feature] to database schema"
   ```

### Common Mistakes to Avoid

❌ **NEVER** modify `schema.prisma` without creating a migration  
❌ **NEVER** manually edit the Prisma Client types and forget the migration  
❌ **NEVER** run `prisma generate` alone - use `prisma migrate dev` instead  
❌ **NEVER** commit schema changes without the corresponding migration

### Why This Matters

- **Development**: Prisma Client is generated from schema (has new fields)
- **Production**: Database uses migrations (missing columns if migration doesn't exist)
- **Result**: Runtime error `P2022: The column does not exist in the current database`

### Deployment Behavior

The Docker entrypoint automatically runs `prisma migrate deploy` on startup, which:

- Checks for pending migrations
- Applies them in order
- Detects migration drift and resets schema if needed

This only works if migrations exist for all schema changes!

````

### SDK (packages/sdk)
```bash
npm run build -w @hcl-cdp-ta/geofence-sdk  # Build SDK (outputs to dist/)
npm run dev -w @hcl-cdp-ta/geofence-sdk    # Build SDK in watch mode
````

### Test App (packages/test-app)

```bash
npm run dev:test                         # Start test app (from root)
npm run dev -w @geofence/test-app        # Alternative: start with workspace flag
```

## Environment Setup

The admin app requires a `.env` file at [packages/admin/.env](packages/admin/.env):

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/geofence"

# NextAuth - IMPORTANT: These are required for authentication to work
NEXTAUTH_SECRET="your-secret-key"        # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"     # Must match your actual URL in production
AUTH_TRUST_HOST=true                     # Required for Docker/proxy/load balancer environments

# Geofence API Key for external applications
GEOFENCE_API_KEY="your-api-key"          # Generate with: openssl rand -hex 32

# Event Adapters (optional - only needed for server-side evaluation mode)

# Webhook Adapter - POST geofence events to this URL
GEOFENCE_WEBHOOK_URL="https://your-webhook-endpoint.com/geofence-events"

# HCL CDP Adapter - Send events to HCL Customer Data Platform
CDP_API_KEY="your-cdp-api-key"
CDP_PASS_KEY="your-cdp-pass-key"
CDP_ENDPOINT="https://pl.dev.hxcd.now.hclsoftware.cloud"
```

## Production Deployment

### Critical Environment Variables

When deploying to production, ensure these environment variables are set correctly:

**Required:**
- `DATABASE_URL`: Production PostgreSQL connection string
- `NEXTAUTH_SECRET`: Strong random secret (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: **MUST** match your production URL exactly (e.g., `https://yourdomain.com`)
- `AUTH_TRUST_HOST=true`: Required when behind a proxy, load balancer, or in Docker

**Optional:**
- `GEOFENCE_API_KEY`: For API-based authentication
- `GEOFENCE_WEBHOOK_URL`: For webhook event notifications
- `CDP_API_KEY`, `CDP_PASS_KEY`, `CDP_ENDPOINT`: For HCL CDP integration

### Common Production Issues

#### CSRF Token Error (`MissingCSRF`)

If you see this error in production:
```
[auth][error] MissingCSRF: CSRF token was missing during an action callback
```

**Cause:** NextAuth.js cannot validate CSRF tokens due to misconfigured environment or cookies.

**Solutions:**

1. **Set `NEXTAUTH_URL` correctly:**
   ```bash
   # Must match your production domain exactly
   NEXTAUTH_URL="https://yourdomain.com"
   ```

2. **Enable `AUTH_TRUST_HOST`:**
   ```bash
   # Required for Docker/proxy environments
   AUTH_TRUST_HOST=true
   ```

3. **Verify `NEXTAUTH_SECRET` is set:**
   ```bash
   # Generate a strong secret
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   ```

4. **Check proxy/load balancer headers:**
   - Ensure `X-Forwarded-Host` header is passed through
   - Ensure `X-Forwarded-Proto` is set to `https` in production

5. **Restart the application** after changing environment variables

#### Database Migration Issues

The Docker entrypoint automatically runs `prisma migrate deploy` on startup. If migrations fail:

1. Check database connectivity
2. Verify `DATABASE_URL` is correct
3. Check migration files exist in `packages/admin/prisma/migrations`
4. Manually apply migrations: `npx prisma migrate deploy -w admin`

## Key Implementation Details

### SDK Usage Pattern

The SDK supports two evaluation modes:

**Client-Side Mode (Default)**:

```typescript
import { GeofenceMonitor } from "@geofence/sdk"

const monitor = new GeofenceMonitor({
  apiUrl: "http://localhost:3000",
  appId: "my-app-id", // Optional, defaults to 'default-app'
  pollingInterval: 10000, // Check position every 10s
  enableHighAccuracy: true,
  debug: false,
  testMode: false, // Set true for manual position control
})

monitor.on("enter", geofence => console.log("Entered:", geofence.name))
monitor.on("exit", geofence => console.log("Exited:", geofence.name))

await monitor.start()

// Manually refresh geofences when they may have changed
await monitor.refreshGeofences()
```

**Server-Side Mode (For Martech Integrations)**:

```typescript
import { GeofenceMonitor } from "@geofence/sdk"

const monitor = new GeofenceMonitor({
  apiUrl: "http://localhost:3000",
  appId: "my-app-id", // Optional, defaults to 'default-app'
  userId: "user-123", // Required for server mode
  enableServerEvaluation: true, // Enable server-authoritative mode
  significantMovementThreshold: 50, // Only report when moved >50m (default: 50)
  pollingInterval: 10000,
  enableHighAccuracy: true,
  debug: false,
  testMode: false,
})

monitor.on("enter", geofence => {
  console.log("Entered:", geofence.name)
  // Event came from server evaluation
  // Server has already fired adapters (CDP, webhooks, etc.)
  // Event includes appId for tracking which application triggered it
})

monitor.on("exit", geofence => console.log("Exited:", geofence.name))

await monitor.start()
```

**Server-Side Mode Behavior**:

- Client polls GPS every `pollingInterval` ms
- Position sent to server only when moved > `significantMovementThreshold` meters
- Position report includes `appId` and `userId` for namespace isolation
- Server evaluates geofences using composite key `(appId, userId)` to track state per application
- Server dispatches events to configured adapters (CDP, webhooks, database logger) with `appId` included
- Client receives events from server response and emits locally

**Multi-App Support**:

- Multiple applications can share the same geofencing backend without user ID collisions
- Each app uses unique `appId` to maintain separate user state tracking
- Events logged with `appId` for per-application analytics and debugging
- Default `appId: "default-app"` ensures backward compatibility

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
import { GeofenceMonitor } from "@geofence/sdk"

// Initialize the monitor
const monitor = new GeofenceMonitor({
  apiUrl: "https://your-api-server.com", // URL to your geofence API
  pollingInterval: 10000, // Check position every 10s (default)
  enableHighAccuracy: true, // Request high-accuracy GPS (default: true)
  debug: false, // Enable debug logging (default: false)
  testMode: false, // Use test mode for manual control (default: false)
})

// Set up event listeners
monitor.on("enter", geofence => {
  console.log(`User entered: ${geofence.name}`)
  // Handle geofence entry (show notification, update UI, etc.)
})

monitor.on("exit", geofence => {
  console.log(`User exited: ${geofence.name}`)
  // Handle geofence exit
})

monitor.on("position", position => {
  console.log(`Position update: ${position.coords.latitude}, ${position.coords.longitude}`)
  // Optional: Update UI with current position
})

monitor.on("error", error => {
  console.error("Geofence monitor error:", error.message)
  // Handle errors (permission denied, network issues, etc.)
})

// Start monitoring
try {
  await monitor.start()
  console.log("Geofence monitoring started")
} catch (error) {
  console.error("Failed to start monitoring:", error)
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
    "coordinates": [
      { "lat": 37.7749, "lng": -122.4194 },
      { "lat": 37.7750, "lng": -122.4194 },
      { "lat": 37.7750, "lng": -122.4195 },
      { "lat": 37.7749, "lng": -122.4195 },
      { "lat": 37.7748, "lng": -122.4195 },
      { "lat": 37.7748, "lng": -122.4194 },
      { "lat": 37.7748, "lng": -122.4193 },
      { "lat": 37.7749, "lng": -122.4193 }
    ],
    "enabled": true
  }
]
```

**Reference implementation**: See [packages/admin/app/api/public/geofences/route.ts](packages/admin/app/api/public/geofences/route.ts)

### Configuration Options

| Option                         | Type    | Default       | Description                                               |
| ------------------------------ | ------- | ------------- | --------------------------------------------------------- |
| `apiUrl`                       | string  | **required**  | Base URL of your geofence API server                      |
| `appId`                        | string  | "default-app" | Application identifier for multi-app support              |
| `userId`                       | string  | undefined     | User identifier (required for server-side evaluation)     |
| `enableServerEvaluation`       | boolean | false         | Enable server-side geofence evaluation                    |
| `significantMovementThreshold` | number  | 50            | Meters moved before reporting position (server mode only) |
| `pollingInterval`              | number  | 10000         | How often to check position (milliseconds)                |
| `enableHighAccuracy`           | boolean | true          | Request high-accuracy GPS from browser                    |
| `debug`                        | boolean | false         | Enable console debug logging                              |
| `testMode`                     | boolean | false         | Enable manual position control for testing                |

### Advanced Features

#### Manual Geofence Refresh

If geofences are updated on the server, refresh them without restarting:

```typescript
await monitor.refreshGeofences()
```

#### Get Current Status

```typescript
const status = monitor.getStatus()
console.log(status.isRunning) // boolean
console.log(status.geofenceCount) // number of loaded geofences
console.log(status.activeGeofences) // array of currently active geofence IDs
```

#### Get Loaded Geofences

```typescript
const geofences = monitor.getGeofences()
// Returns array of all loaded geofences
```

#### Test Mode (for development)

```typescript
const monitor = new GeofenceMonitor({
  apiUrl: "http://localhost:3000",
  testMode: true, // Enable manual position control
})

await monitor.start()

// Manually set position instead of using GPS
monitor.setTestPosition(37.7749, -122.4194)
```

### Browser Permissions

The SDK requires browser geolocation permission. Handle the permission flow in your UI:

```typescript
// Check if geolocation is supported
if (!navigator.geolocation) {
  console.error("Geolocation not supported")
}

// The browser will prompt for permission when monitor.start() is called
// Handle permission denial via the 'error' event
monitor.on("error", error => {
  if (error.message.includes("Permission denied")) {
    // Show UI explaining why location access is needed
  }
})
```

### Framework-Specific Examples

#### React

```typescript
import { useEffect, useState } from "react"
import { GeofenceMonitor } from "@geofence/sdk"

function App() {
  const [monitor, setMonitor] = useState(null)
  const [activeGeofences, setActiveGeofences] = useState([])

  useEffect(() => {
    const geofenceMonitor = new GeofenceMonitor({
      apiUrl: "https://your-api.com",
      debug: true,
    })

    geofenceMonitor.on("enter", geofence => {
      setActiveGeofences(prev => [...prev, geofence])
    })

    geofenceMonitor.on("exit", geofence => {
      setActiveGeofences(prev => prev.filter(g => g.id !== geofence.id))
    })

    geofenceMonitor.start()
    setMonitor(geofenceMonitor)

    return () => {
      geofenceMonitor.stop()
    }
  }, [])

  return (
    <div>
      <h1>Active Geofences: {activeGeofences.length}</h1>
      {activeGeofences.map(g => (
        <div key={g.id}>{g.name}</div>
      ))}
    </div>
  )
}
```

#### Vue 3

```typescript
import { ref, onMounted, onUnmounted } from "vue"
import { GeofenceMonitor } from "@geofence/sdk"

export default {
  setup() {
    const activeGeofences = ref([])
    let monitor = null

    onMounted(async () => {
      monitor = new GeofenceMonitor({
        apiUrl: "https://your-api.com",
        debug: true,
      })

      monitor.on("enter", geofence => {
        activeGeofences.value.push(geofence)
      })

      monitor.on("exit", geofence => {
        activeGeofences.value = activeGeofences.value.filter(g => g.id !== geofence.id)
      })

      await monitor.start()
    })

    onUnmounted(() => {
      if (monitor) {
        monitor.stop()
      }
    })

    return { activeGeofences }
  },
}
```

### Geofence Detection Algorithm

- Fetches enabled geofences from `/api/public/geofences` once at startup
- Polls user's position using Geolocation API at configured interval (default: 10s)
- Uses **ray casting algorithm** to determine if position is inside each 8-vertex polygon
  - Casts horizontal ray from point, counts intersections with polygon edges
  - Odd number of intersections = inside, even number = outside
  - O(8) = O(1) constant time performance per geofence
- Emits 'enter' event when user enters a geofence polygon
- Emits 'exit' event when user leaves a geofence polygon
- Maintains state of currently active geofences to detect transitions
- **Note**: Geofences are cached after initial fetch - use `refreshGeofences()` to update

### Frontend Components

UI components in [packages/admin/src/components](packages/admin/src/components):

- `GeofenceList`: Displays and manages geofences with inline editing
- `GeofenceForm`: Form for naming geofences and setting enabled status (polygon shape edited on map)
- `LeafletMap`: Interactive map for visualizing, creating, and editing 8-vertex polygon geofences
  - **Creating**: Click map → 8-point square appears → drag vertices to reshape → save
  - **Editing**: Select geofence → click Edit → drag vertices → update
  - Draggable vertex markers for precise polygon shaping
- UI primitives: Button, Modal, Switch (custom Tailwind components)

## Development Workflow

1. **Database Setup**: Create PostgreSQL database, configure `DATABASE_URL`, run `npx prisma migrate dev -w admin`
2. **Start Dev**: Run `npm run dev` from root to start admin app
3. **SDK Development**: Use `npm run dev -w @hcl-cdp-ta/geofence-sdk` for watch mode when developing SDK features
4. **Testing Geofences**: Use the admin UI at `http://localhost:3000` (requires login)
5. **SDK Testing**: Use `npm run dev:test` to start the test app
   - **Manual Mode**: Set positions via input fields, map clicks, or quick buttons
   - **GPS Mode**: Use Chrome DevTools Sensors tab to emulate GPS locations - map auto-follows position

## Releases and Publishing

This monorepo uses **release-please** for automated versioning and publishing. Each package (SDK and Admin) versions independently based on conventional commits.

### Quick Reference

**To release SDK changes:**

```bash
git commit -m "fix(sdk): your bug fix description"
# or
git commit -m "feat(sdk): your new feature description"
git push origin main
```

→ Release-please creates PR → Merge PR → SDK auto-published to npm

**To release admin changes:**

```bash
git commit -m "feat(admin): your feature description"
git push origin main
```

→ Release-please creates PR → Merge PR → GitHub release only (no npm publish)

**Commit format:**

- `fix(scope):` → Patch version bump (1.0.0 → 1.0.1)
- `feat(scope):` → Minor version bump (1.0.0 → 1.1.0)
- `feat(scope)!:` or `BREAKING CHANGE:` → Major version bump (1.0.0 → 2.0.0)

**Key points:**

- Packages version independently (SDK can be v1.2.5 while Admin is v1.1.3)
- SDK changes auto-publish to npm when release PR is merged
- Admin changes create GitHub releases only (admin is private)
- Release-please detects which packages changed based on file paths

**For complete details, see [docs/RELEASES.md](docs/RELEASES.md)**

## Important Notes

- The admin app uses Next.js 16 App Router - all pages are in `packages/admin/app/`
- Server-side code can import from `@/lib/auth` and `@/lib/prisma`
- **CRITICAL**: When changing Prisma schema, ALWAYS create a migration using `npx prisma migrate dev` (see Database Schema Changes section above)
- The SDK has no dependencies (except dev dependencies) - keep it lightweight for browser use
- All authenticated API routes should use `auth()` from [packages/admin/src/lib/auth.ts](packages/admin/src/lib/auth.ts) to verify session
- **Scalability**: Current implementation fetches ALL geofences at startup - suitable for <100 geofences. See [SCALABILITY.md](SCALABILITY.md) for scaling strategies
