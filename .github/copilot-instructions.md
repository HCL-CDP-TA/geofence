# GitHub Copilot Instructions - Geofence Monorepo

This file provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

This is a geofencing monorepo consisting of:
- **packages/admin**: Next.js 16 admin dashboard for managing geofences
- **packages/sdk**: Browser-based geofencing SDK for location monitoring
- **packages/test-app**: Test application for SDK with manual position control

## Tech Stack

- **Admin**: Next.js 16 App Router, React 19, PostgreSQL, Prisma ORM v7, NextAuth.js v5, Tailwind CSS v4, Leaflet maps
- **SDK**: TypeScript, tsup for dual ESM/CJS builds, zero runtime dependencies
- **Test App**: Vite, React, Leaflet for interactive testing

## Key Architecture Patterns

### Multi-App Support

The system supports multiple applications sharing the same geofencing backend using `appId` for namespace isolation:

- **Database**: Composite unique constraint `@@unique([appId, userId])` on `UserGeofenceState`
- **SDK**: Optional `appId` parameter (defaults to "default-app")
- **Backend**: All operations use composite key `(appId, userId)` for state tracking
- **Events**: All adapters receive `appId` in event data for per-application analytics

### Server-Side Evaluation

Two evaluation modes:
1. **Client-Side** (default): SDK fetches geofences, evaluates locally
2. **Server-Side**: SDK sends position to server, server evaluates and dispatches to adapters

Server-side requires `userId` and `enableServerEvaluation: true` in SDK options.

### Event Adapter System

Pluggable adapter pattern for routing geofence events:
- **LoggerAdapter**: Always enabled, logs to database with appId
- **WebhookAdapter**: POSTs to configured URL with app_id field
- **CDPAdapter**: Sends to HCL CDP with app_id property

All adapters receive `GeofenceEventData` with `appId` field.

## Database Schema

### Key Models (Prisma)

```prisma
model UserGeofenceState {
  appId             String   @default("default-app")
  userId            String
  activeGeofenceIds String[]
  // ...
  @@unique([appId, userId])
  @@index([appId])
}

model GeofenceEvent {
  appId      String   @default("default-app")
  userId     String
  eventType  String   // 'enter' or 'exit'
  // ...
  @@index([appId])
}
```

## SDK Usage Examples

### Client-Side Mode
```typescript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  appId: 'my-app-id',  // Optional, defaults to 'default-app'
  pollingInterval: 10000,
});
```

### Server-Side Mode
```typescript
const monitor = new GeofenceMonitor({
  apiUrl: 'http://localhost:3000',
  appId: 'my-app-id',
  userId: 'user-123',  // Required
  enableServerEvaluation: true,
  significantMovementThreshold: 50,
});
```

## API Routes

- `GET /api/public/geofences` - Public endpoint for SDK (client-side mode)
- `POST /api/events/position` - Position reporting (requires appId, userId)
- `GET /api/events` - View logged events (filter by appId, userId, geofence)

## Coding Standards

### TypeScript
- Use strict mode
- Properly type all functions and components
- Export interfaces from SDK types file

### SDK Development
- Keep zero runtime dependencies
- Build with tsup for dual ESM/CJS output
- Include TypeScript declarations

### API Routes
- Always validate session with `getSession()` or `getSessionOrDemo()`
- Return proper HTTP status codes
- Use Prisma for all database operations

### Multi-App Considerations
- Always include `appId` in server-side position reports
- Use composite keys `(appId, userId)` for user state queries
- Include `appId` in all event adapter payloads
- Default `appId` to "default-app" for backward compatibility

## Common Commands

```bash
# Root
npm run dev          # Start admin app
npm run dev:test     # Start test app
npm run build        # Build all packages

# Admin
npx prisma migrate dev -w admin      # Run migrations
npx prisma generate -w admin         # Generate Prisma client
npx prisma studio -w admin           # Open Prisma Studio

# SDK
npm run build -w @hcl-cdp-ta/geofence-sdk  # Build SDK
npm run dev -w @hcl-cdp-ta/geofence-sdk    # Watch mode
```

## Important Notes

- Prisma Client must be regenerated after schema changes
- SDK should remain lightweight for browser use
- All authenticated API routes use NextAuth session validation
- Geofences cached after initial fetch - use `refreshGeofences()` for updates
- Current implementation suitable for <100 geofences (see SCALABILITY.md)

## Release Process

Uses release-please for automated versioning:
- SDK changes auto-publish to npm when release PR is merged
- Use conventional commits: `feat(sdk):`, `fix(admin):`, etc.
- Packages version independently

## References

- [CLAUDE.md](../CLAUDE.md) - Detailed project documentation
- [README.md](../README.md) - User-facing documentation
- [docs/ADAPTERS.md](../docs/ADAPTERS.md) - Event adapter guide
- [SCALABILITY.md](../SCALABILITY.md) - Scaling strategies
