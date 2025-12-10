# Geofence Monorepo

A complete geofencing solution consisting of an admin dashboard, browser-based SDK, and test application for location-based event detection.

## Overview

This monorepo provides everything needed to create, manage, and monitor geographic boundaries (geofences) in web applications:

- **Admin Dashboard**: Next.js web app for creating and managing geofences with visual map interface
- **Browser SDK**: Lightweight JavaScript library for detecting geofence entry/exit events
- **Test App**: Interactive development environment for testing geofence detection

## Architecture

### Packages

```
packages/
├── admin/       # Next.js 16 admin dashboard with Prisma + PostgreSQL
├── sdk/         # Browser geofencing SDK (no dependencies)
└── test-app/    # Vite-based test application with interactive map
```

### Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Database**: PostgreSQL with Prisma ORM v7
- **Authentication**: NextAuth.js v5 with JWT sessions
- **Maps**: Leaflet with react-leaflet
- **Build Tools**: tsup (SDK), Vite (test app)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm 7+ (for workspaces support)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd geofence

# Install dependencies
npm install

# Set up admin environment
cd packages/admin
cp .env.example .env
# Edit .env with your DATABASE_URL, NEXTAUTH_SECRET, and NEXTAUTH_URL

# Run database migrations
npx prisma migrate dev

# Return to root and start development server
cd ../..
npm run dev
```

The admin dashboard will be available at [http://localhost:3000](http://localhost:3000).

### Create Your First User

```bash
# In packages/admin directory
npx prisma studio
```

Or use the registration API endpoint at `/api/auth/register`.

## Development Commands

### Root Level

```bash
npm run dev          # Start admin dashboard (port 3000)
npm run dev:test     # Start test application (port 5173)
npm run build        # Build all packages
npm run lint         # Lint all packages
```

### Package-Specific

```bash
# Admin dashboard
npm run dev -w admin           # Start dev server
npm run build -w admin         # Build for production
npx prisma studio -w admin     # Open database GUI

# SDK
npm run build -w @hcl-cdp-ta/geofence-sdk   # Build SDK
npm run dev -w @hcl-cdp-ta/geofence-sdk     # Build in watch mode

# Test app
npm run dev -w @geofence/test-app           # Start test environment
npm run build -w @geofence/test-app         # Build test app
```

## Usage

### 1. Create Geofences (Admin Dashboard)

1. Start the admin app: `npm run dev`
2. Log in at [http://localhost:3000/login](http://localhost:3000/login)
3. Use the interactive map to create geofences by clicking or using the form
4. Enable/disable geofences with the toggle switches

### 2. Test Geofences (Test App)

```bash
npm run dev:test
```

The test app provides two modes:

- **Manual Mode**: Set positions via input fields or map clicks to simulate movement
- **GPS Mode**: Use your actual browser location (or Chrome DevTools Sensors tab)

Watch the event log to see real-time enter/exit events as you move in and out of geofences.

### 3. Integrate SDK in Your App

```typescript
import { GeofenceMonitor } from '@geofence/sdk';

const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  pollingInterval: 10000, // Check every 10 seconds
});

monitor.on('enter', (geofence) => {
  console.log(`Entered: ${geofence.name}`);
  // Trigger notifications, analytics, etc.
});

monitor.on('exit', (geofence) => {
  console.log(`Exited: ${geofence.name}`);
});

await monitor.start();
```

See [packages/sdk/README.md](packages/sdk/README.md) for complete SDK documentation.

### 4. Server-Authoritative Mode (Advanced)

The SDK now supports **server-side geofence evaluation** for improved security and integration with marketing platforms.

```typescript
import { GeofenceMonitor } from '@geofence/sdk';

const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  userId: 'user-123',                    // Required for server mode
  enableServerEvaluation: true,          // Enable server-side mode
  significantMovementThreshold: 50,      // Only report when moved >50m
});

monitor.on('enter', (geofence) => {
  console.log(`Entered: ${geofence.name}`);
  // Events come from server evaluation
});

await monitor.start();
```

**Server-Side Benefits:**
- Server evaluates geofences (source of truth)
- Position only sent when moved >50m (reduces network traffic)
- Events routed to pluggable adapters (CDP, webhooks, database)
- Suitable for martech integrations and analytics

See [docs/ADAPTERS.md](docs/ADAPTERS.md) for implementing custom event adapters.

## Project Structure

```
geofence/
├── packages/
│   ├── admin/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── api/            # API routes
│   │   │   ├── login/          # Login page
│   │   │   └── page.tsx        # Dashboard home
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   │       ├── components/     # React components
│   │       └── lib/            # Auth, Prisma, utilities
│   │
│   ├── sdk/
│   │   ├── src/
│   │   │   ├── index.ts        # GeofenceMonitor class
│   │   │   └── utils/          # Distance calculations
│   │   └── README.md           # SDK documentation
│   │
│   └── test-app/
│       ├── src/
│       │   ├── App.tsx         # Main test interface
│       │   └── main.tsx        # Entry point
│       └── index.html
│
├── CLAUDE.md                    # Project documentation
├── SCALABILITY.md              # Scaling considerations
└── package.json                # Monorepo config
```

## Features

### Admin Dashboard

- Interactive Leaflet map with geofence visualization
- Create geofences by clicking map or entering coordinates
- Edit geofence properties (name, radius, coordinates)
- Enable/disable geofences
- User authentication with NextAuth.js
- PostgreSQL storage with Prisma ORM

### SDK Features

- Event-driven API (enter, exit, position, error)
- Configurable polling interval
- High-accuracy GPS option
- Test mode for manual position control
- Manual geofence refresh
- TypeScript support with full type definitions
- Zero runtime dependencies
- Works with any backend

### Test App Features

- Dual-mode testing (Manual + GPS)
- Interactive map with geofence visualization
- Real-time event log
- Active geofence indicators
- Quick position buttons for common test locations
- Manual geofence refresh

## API Endpoints

The admin app provides these endpoints:

```
POST   /api/auth/register              # Create new user
POST   /api/auth/[...nextauth]         # Login/logout
GET    /api/geofences                  # List geofences (auth required)
POST   /api/geofences                  # Create geofence (auth required)
PUT    /api/geofences/[id]             # Update geofence (auth required)
DELETE /api/geofences/[id]             # Delete geofence (auth required)
GET    /api/public/geofences           # Public endpoint for SDK (client mode)
POST   /api/events/position            # Position reporting (server evaluation mode)
```

## Environment Variables

Create `packages/admin/.env`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/geofence"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Optional: Server Evaluation Mode Adapters
GEOFENCE_WEBHOOK_URL="https://your-webhook-endpoint.com/events"  # Webhook adapter
CDP_API_KEY="your-cdp-api-key"                                    # HCL CDP adapter
CDP_PASS_KEY="your-cdp-passkey"                                   # HCL CDP adapter
CDP_ENDPOINT="https://your-cdp-instance.com/api"                  # HCL CDP adapter
```

## Deployment

### Admin Dashboard

Deploy the admin app to any Next.js-compatible platform:

```bash
cd packages/admin
npm run build
npm run start
```

Ensure environment variables are set in your deployment platform.

### SDK

The SDK can be:
- Published to npm: `npm publish` from `packages/sdk`
- Linked locally: `npm link` for development
- Installed from file path: `npm install /path/to/packages/sdk`

## How It Works

1. **Geofence Storage**: Admin app stores geofences in PostgreSQL
2. **Public API**: SDK fetches enabled geofences from `/api/public/geofences`
3. **Location Tracking**: SDK polls browser Geolocation API at configured interval
4. **Distance Calculation**: Uses Haversine formula to calculate distance to each geofence
5. **Event Detection**: Emits enter/exit events when user crosses geofence boundaries

## Performance Considerations

- **Battery Life**: Longer polling intervals (10-30s) improve battery life
- **Accuracy**: GPS typically accurate to 5-50m; use geofence radii ≥ 100m
- **Scalability**: Current implementation suitable for <100 geofences (see [SCALABILITY.md](SCALABILITY.md))
- **Network**: Geofences cached after initial fetch; use `refreshGeofences()` for updates

## Browser Requirements

The SDK requires:
- Geolocation API support
- Modern JavaScript (ES6+)
- Fetch API support

Supported browsers: Chrome 50+, Firefox 52+, Safari 10+, Edge 14+

## Contributing

This is a monorepo using npm workspaces. When making changes:

1. Follow existing code style and conventions
2. Test changes in the test app before committing
3. Update relevant README files
4. Run `npm run lint` to check for issues

## Releases and Publishing

This monorepo uses automated release management with independent versioning for each package:

- **SDK**: Published to npm as `@hcl-cdp-ta/geofence-sdk`
- **Admin**: GitHub releases only (private package)

### Publishing SDK Changes

Changes to the SDK are automatically published to npm:

```bash
# Make SDK changes
git commit -m "fix(sdk): your bug fix"
# or
git commit -m "feat(sdk): your new feature"
git push origin main
```

Release-please will create a release PR → merge it → SDK publishes automatically to npm.

**Version bumps:**
- `fix:` commits → patch version (1.0.0 → 1.0.1)
- `feat:` commits → minor version (1.0.0 → 1.1.0)
- Breaking changes → major version (1.0.0 → 2.0.0)

For complete details, see [docs/RELEASES.md](docs/RELEASES.md).

## Documentation

- [Release Guide](docs/RELEASES.md) - Automated release and publishing workflow
- [SDK Documentation](packages/sdk/README.md) - Complete SDK API reference
- [Event Adapters](docs/ADAPTERS.md) - Creating custom geofence event adapters
- [CLAUDE.md](CLAUDE.md) - Detailed project documentation for AI assistants
- [SCALABILITY.md](SCALABILITY.md) - Scaling strategies and best practices

## License

MIT

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
