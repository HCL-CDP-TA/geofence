# Geofence Admin Dashboard

A Next.js 16 web application for creating, managing, and visualizing geographic geofences with an interactive map interface.

## Features

- Interactive Leaflet map for visual geofence creation and management
- User authentication with NextAuth.js v5
- PostgreSQL database with Prisma ORM v7
- Real-time geofence visualization
- CRUD operations for geofences
- Enable/disable geofence toggles
- Public API endpoint for SDK integration
- Responsive design with Tailwind CSS v4

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 with TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma v7 with pg adapter
- **Authentication**: NextAuth.js v5 (JWT strategy)
- **Styling**: Tailwind CSS v4
- **Maps**: Leaflet + react-leaflet
- **Password Hashing**: bcrypt

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Installation

```bash
# Install dependencies (from monorepo root)
npm install

# Navigate to admin package
cd packages/admin

# Set up environment variables
cp .env.example .env
```

## Environment Setup

Create a `.env` file in `packages/admin/`:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/geofence"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"  # Generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Geofence API Key (for external applications)
GEOFENCE_API_KEY="your-secure-api-key-here"  # Generate: openssl rand -hex 32

# Event Adapters (optional)

# Webhook Adapter - POST geofence events to this URL
GEOFENCE_WEBHOOK_URL="https://your-webhook-endpoint.com/geofence-events"

# HCL CDP Adapter - Send events to HCL Customer Data Platform
CDP_API_KEY="your-cdp-api-key"
CDP_PASS_KEY="your-cdp-pass-key"
CDP_ENDPOINT="https://pl.dev.hxcd.now.hclsoftware.cloud"
```

## Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev

# (Optional) Open Prisma Studio to view/edit data
npx prisma studio
```

## Development

```bash
# From monorepo root
npm run dev

# Or from packages/admin directory
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Creating Your First User

### Option 1: API Endpoint

Send a POST request to `/api/auth/register`:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-secure-password",
    "name": "Admin User"
  }'
```

### Option 2: Prisma Studio

```bash
npx prisma studio
```

**Note**: When creating users directly in Prisma Studio, passwords must be pre-hashed with bcrypt.

## Project Structure

```
packages/admin/
├── app/
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   ├── register/         # User registration endpoint
│   │   │   └── [...nextauth]/    # NextAuth handlers
│   │   ├── geofences/            # Geofence CRUD endpoints
│   │   │   └── [id]/             # Update/delete specific geofence
│   │   └── public/
│   │       └── geofences/        # Public endpoint for SDK
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Dashboard page
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration history
│
├── src/
│   ├── components/
│   │   ├── GeofenceList.tsx     # Geofence table with inline editing
│   │   ├── GeofenceForm.tsx     # Create/edit modal form
│   │   ├── LeafletMap.tsx       # Interactive map component
│   │   └── ui/                   # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       └── Switch.tsx
│   │
│   └── lib/
│       ├── auth.ts               # NextAuth configuration
│       ├── prisma.ts             # Prisma client singleton
│       └── validations.ts        # Zod schemas
│
├── public/                       # Static assets
├── .env                          # Environment variables (not in git)
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## Database Schema

### User Model

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // bcrypt hashed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Geofence Model

```prisma
model Geofence {
  id        String          @id @default(cuid())
  name      String
  latitude  Float
  longitude Float
  radius    Float
  enabled   Boolean         @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  events    GeofenceEvent[] // Relation to logged events
}
```

### UserGeofenceState Model

Tracks active geofences per user for server-side evaluation:

```prisma
model UserGeofenceState {
  id                String   @id @default(cuid())
  userId            String   @unique
  activeGeofenceIds String[] // Array of currently active geofence IDs
  lastLatitude      Float
  lastLongitude     Float
  lastReportedAt    DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### GeofenceEvent Model

Logs all geofence enter/exit events:

```prisma
model GeofenceEvent {
  id         String   @id @default(cuid())
  userId     String
  eventType  String   // 'enter' or 'exit'
  geofenceId String
  geofence   Geofence @relation(fields: [geofenceId], references: [id], onDelete: Cascade)
  latitude   Float
  longitude  Float
  accuracy   Float?
  speed      Float?
  heading    Float?
  timestamp  DateTime
  createdAt  DateTime @default(now())
}
```

## API Routes

### Authentication

#### `POST /api/auth/register`

Create a new user account.

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### `POST /api/auth/signin`

Login (handled by NextAuth).

#### `POST /api/auth/signout`

Logout (handled by NextAuth).

### Geofences (Authenticated)

All geofence routes require authentication via either:

1. **Session cookie** (for web dashboard)
2. **API key** in Authorization header (for external applications)

#### Authentication Methods

**Method 1: Session Cookie (Web Dashboard)**

```bash
# Automatically handled by NextAuth session
# No additional headers needed when logged in
```

**Method 2: API Key (External Apps)**

```bash
# Add Authorization header with Bearer token
curl -H "Authorization: Bearer YOUR_GEOFENCE_API_KEY" \
  http://localhost:3000/api/geofences
```

Set `GEOFENCE_API_KEY` in your `.env` file:

```bash
GEOFENCE_API_KEY="your-secure-api-key-here"  # Generate: openssl rand -hex 32
```

#### `GET /api/geofences`

List all geofences.

**Response:**

```json
[
  {
    "id": "clx...",
    "name": "Downtown Store",
    "latitude": 40.7128,
    "longitude": -74.006,
    "radius": 500,
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### `POST /api/geofences`

Create a new geofence.

**Request body:**

```json
{
  "name": "New Store",
  "latitude": 40.7589,
  "longitude": -73.9851,
  "radius": 300,
  "enabled": true
}
```

#### `PUT /api/geofences/[id]`

Update an existing geofence.

**Request body:** (all fields optional)

```json
{
  "name": "Updated Name",
  "latitude": 40.7589,
  "longitude": -73.9851,
  "radius": 400,
  "enabled": false
}
```

#### `DELETE /api/geofences/[id]`

Delete a geofence.

### Public API

#### `GET /api/public/geofences`

Public endpoint that returns only enabled geofences. Used by the SDK in client-side evaluation mode.

**Response:**

```json
[
  {
    "id": "clx...",
    "name": "Downtown Store",
    "latitude": 40.7128,
    "longitude": -74.006,
    "radius": 500,
    "enabled": true
  }
]
```

### Server-Side Evaluation API

#### `POST /api/events/position`

Position reporting endpoint for server-side geofence evaluation. Used by the SDK when `enableServerEvaluation: true` is configured.

**Request body:**

```json
{
  "userId": "user-123",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10,
  "timestamp": 1234567890000,
  "speed": 2.5,
  "heading": 180
}
```

**Response:**

```json
{
  "success": true,
  "events": [
    {
      "type": "enter",
      "geofence": {
        "id": "clx...",
        "name": "Downtown Store",
        "latitude": 40.7128,
        "longitude": -74.006,
        "radius": 500
      },
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**How it works:**
1. SDK sends position when moved > threshold meters (default: 50m)
2. Server evaluates geofences using Haversine distance formula
3. Server compares current geofences vs last known state for the user
4. Server detects transitions (enter/exit events)
5. Server dispatches events to configured adapters (CDP, webhooks, database logger)
6. Server updates user state in database
7. Server returns events to SDK, which emits them locally

#### `GET /api/events`

View logged geofence events (requires authentication).

**Query parameters:**
- `userId` (optional): Filter by user ID
- `eventType` (optional): Filter by event type ('enter' or 'exit')
- `limit` (optional): Max number of events to return (default: 100)

**Response:**

```json
{
  "events": [
    {
      "id": "clx...",
      "userId": "user-123",
      "eventType": "enter",
      "geofenceId": "clx...",
      "geofence": {
        "id": "clx...",
        "name": "Downtown Store"
      },
      "latitude": 40.7128,
      "longitude": -74.006,
      "accuracy": 10,
      "speed": 2.5,
      "heading": 180,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "createdAt": "2024-01-01T12:00:01.000Z"
    }
  ]
}
```

## Server-Side Evaluation & Event Adapters

The admin app supports server-side geofence evaluation with a **pluggable adapter system** for routing events to external systems.

### How It Works

When the SDK is configured with `enableServerEvaluation: true`:
1. SDK sends position updates to `POST /api/events/position`
2. Server evaluates geofences and detects transitions
3. Server dispatches events to all enabled adapters in parallel
4. Adapters route events to their respective destinations
5. Server returns events to SDK

### Built-In Adapters

#### LoggerAdapter (Always Enabled)
- Logs all events to the `GeofenceEvent` database table
- Provides audit trail and event history
- View events at `GET /api/events`

#### WebhookAdapter (Optional)
- POSTs events to a configurable webhook URL
- Enable by setting `GEOFENCE_WEBHOOK_URL` environment variable
- Sends JSON payload with event details

**Configuration:**
```bash
GEOFENCE_WEBHOOK_URL="https://your-webhook-endpoint.com/geofence-events"
```

**Payload format:**
```json
{
  "userId": "user-123",
  "eventType": "enter",
  "geofence": {
    "id": "clx...",
    "name": "Downtown Store",
    "latitude": 40.7128,
    "longitude": -74.006,
    "radius": 500
  },
  "position": {
    "latitude": 40.7128,
    "longitude": -74.006,
    "accuracy": 10,
    "speed": 2.5,
    "heading": 180
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### CDPAdapter (Optional)
- Sends track events to HCL Customer Data Platform
- Enable by setting `CDP_API_KEY` and `CDP_PASS_KEY` environment variables
- Events appear as "HTTP API" source in CDP (not "JavaScript/Web")

**Configuration:**
```bash
CDP_API_KEY="your-cdp-api-key"
CDP_PASS_KEY="your-cdp-pass-key"
CDP_ENDPOINT="https://pl.dev.hxcd.now.hclsoftware.cloud"
```

### Creating Custom Adapters

See [docs/ADAPTERS.md](../../docs/ADAPTERS.md) for a comprehensive guide on implementing custom event adapters for Slack, email, analytics platforms, and more.

## Authentication

The app uses NextAuth.js v5 with the following configuration:

- **Provider**: Credentials (email/password)
- **Session**: JWT-based
- **Password Hashing**: bcrypt with 10 salt rounds
- **Protected Routes**: All geofence API routes require authentication

### Session Structure

```typescript
{
  user: {
    id: string;
    email: string;
    name?: string;
  }
}
```

## Components

### GeofenceList

Displays geofences in a table with:

- Toggle switches to enable/disable
- Edit buttons to modify geofence properties
- Delete buttons with confirmation
- Responsive design

### GeofenceForm

Modal form for creating/editing geofences with:

- Name input
- Latitude/longitude inputs
- Radius input (meters)
- Enabled toggle
- Validation with error messages

### LeafletMap

Interactive map component featuring:

- Geofence visualization as circles
- Click-to-create functionality
- Center marker with coordinates
- Zoom controls
- OpenStreetMap tiles

## Styling

The app uses Tailwind CSS v4 with a custom configuration. Key features:

- Responsive design (mobile-first)
- Custom color palette
- Dark mode ready (not yet implemented)
- Utility-first approach

## Database Migrations

### Creating a Migration

```bash
# After editing schema.prisma
npx prisma migrate dev --name description_of_changes
```

### Deploying Migrations (Production)

```bash
npx prisma migrate deploy
```

### Resetting the Database (Development)

```bash
npx prisma migrate reset
```

## Building for Production

```bash
# Build the application
npm run build

# Start production server
npm run start
```

## Deployment Checklist

- [ ] Set up PostgreSQL database
- [ ] Configure environment variables on hosting platform
- [ ] Run `npx prisma migrate deploy` on production database
- [ ] Generate Prisma Client: `npx prisma generate`
- [ ] Build application: `npm run build`
- [ ] Set `NEXTAUTH_URL` to production domain
- [ ] Generate secure `NEXTAUTH_SECRET`
- [ ] Enable CORS if SDK is hosted on different domain

## Deployment Platforms

The admin app can be deployed to:

- **Vercel**: Native Next.js support (recommended)
- **Netlify**: Next.js Runtime support
- **Railway**: Docker or Nixpacks
- **Render**: Docker support
- **AWS/GCP/Azure**: Via Docker or manual setup

## Environment Variables for Production

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="long-random-string"
NEXTAUTH_URL="https://your-domain.com"
```

## Security Considerations

- Passwords are hashed with bcrypt before storage
- JWT tokens are signed with NEXTAUTH_SECRET
- API routes verify authentication using NextAuth's `auth()` helper
- Public endpoint (`/api/public/geofences`) only returns enabled geofences
- Input validation using Zod schemas
- SQL injection protection via Prisma parameterized queries

## Performance

- Geofences are cached client-side after initial fetch
- Server-side rendering for initial page load
- Optimistic updates for toggle switches
- Lazy loading of map components

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db pull
```

### Migration Errors

```bash
# Reset migrations (development only)
npx prisma migrate reset

# Re-apply migrations
npx prisma migrate dev
```

### NextAuth Issues

- Ensure `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your domain
- Check browser cookies are enabled
- Clear cookies and try logging in again

### Map Not Displaying

- Check browser console for Leaflet errors
- Ensure you have internet connection (for map tiles)
- Verify react-leaflet is properly installed

## Development Tips

1. **Hot Reload**: Next.js automatically reloads on file changes
2. **Prisma Studio**: Use `npx prisma studio` for database GUI
3. **Type Safety**: Run `npx prisma generate` after schema changes to update types
4. **Debugging**: Enable `debug: true` in NextAuth config for verbose logging
5. **Testing**: Use the test app (`npm run dev:test`) to verify geofence API

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio    # Open database GUI
npx prisma migrate dev    # Create and apply migration
npx prisma generate  # Generate Prisma Client
```

## License

MIT

## Support

For issues or questions, please refer to the main project documentation or open an issue on GitHub.
