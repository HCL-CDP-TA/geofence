# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 15** social media simulator application that was **migrated from Vite + Supabase** to Next.js + PostgreSQL with custom JWT authentication. See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for complete migration details.

**Purpose**: A full-featured social media simulator that allows users to:

- Create cross-platform promotional ads and visualize them with platform-authentic styling
- Follow other users on specific platforms (platform-specific follower relationships)
- View timeline feeds showing posts from followed users mixed with promotional ads
- Create, share, and delete posts across multiple platforms (Facebook, Instagram, TikTok, Twitter, LinkedIn)

## Commands

### Development

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Generate Prisma client + build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler check
```

### Database (Prisma)

```bash
npx prisma generate                    # Generate Prisma client after schema changes
npx prisma migrate dev --name <name>   # Create and apply migration in development
npx prisma migrate deploy              # Apply migrations in production (used in Docker)
npx prisma studio                      # Open Prisma Studio GUI for database browsing
npx prisma db push                     # Push schema changes without creating migration
```

### Docker Deployment

```bash
./deploy.sh <version-tag> <environment> [--local|--branch]

# Examples:
./deploy.sh v1.0.0 production                      # Deploy from GitHub tag
./deploy.sh local development --local              # Deploy from local directory
./deploy.sh feature/my-branch development --branch # Deploy from specific branch
```

Access deployed app at `http://localhost:3200`

## Architecture

### Tech Stack Post-Migration

- **Framework**: Next.js 15 with App Router
- **Authentication**: Custom JWT (bcryptjs + jose) with httpOnly cookies
- **Database**: PostgreSQL + Prisma ORM with **multi-schema** (auth, public)
- **Styling**: Tailwind CSS
- **Deployment**: Docker with multi-stage build + standalone output

### Directory Structure

```
app/                         # Next.js App Router
├── api/                    # API Routes
│   ├── auth/              # signup, signin, signout, session
│   ├── admin/             # Admin API routes (JWT or Admin API Key auth)
│   │   └── users/         # User management endpoints
│   │       ├── route.ts   # GET list users, POST create user
│   │       └── [id]/
│   │           ├── route.ts            # GET, PATCH, DELETE user
│   │           ├── platforms/          # POST add platform
│   │           │   └── [configId]/     # PATCH, DELETE platform config
│   │           └── followers/          # POST, DELETE follower relationships
│   ├── ads/               # GET, POST, PATCH, DELETE for promotional ads
│   │   └── [id]/          # PATCH update, DELETE delete
│   │       └── bump/      # PATCH bump ad to top (update updated_at)
│   ├── profile/           # GET, PATCH for user profile
│   ├── platform-configs/  # GET, POST, DELETE for platform preferences
│   │   └── [id]/          # PATCH update follower_count, is_verified
│   ├── feed/              # GET timeline feed with posts + ads
│   ├── followers/         # GET, POST, DELETE follower relationships
│   ├── users/             # GET users on specific platforms
│   └── posts/             # POST create, GET list posts
│       └── [id]/          # DELETE soft delete, PATCH restore
│           └── share/     # POST share/repost posts
├── (platform pages)/      # facebook, instagram, tiktok, twitter, linkedin
├── login/, signup/, profile/
├── ads/                   # Ad Manager (dedicated pages with routing)
│   ├── page.tsx           # Ad grid with filtering, toggle switches
│   ├── new/               # Create new ad
│   │   └── page.tsx       # Ad creation form (uses AdForm component)
│   └── [id]/edit/         # Edit existing ad
│       └── page.tsx       # Ad editing form (dynamic route, uses AdForm component)
├── users/                 # User Management (admin tool)
│   ├── page.tsx           # User list with search, filter, create modal
│   └── [id]/edit/         # Edit user page with tabs
│       └── page.tsx       # Profile, Platforms, Following, Content tabs
├── page.tsx               # Home page with platform cards, User Management & Ad Manager buttons
├── layout.tsx
└── globals.css

components/                  # React components (moved from src/)
├── ads/                    # Platform-specific ad components & Ad Manager
│   ├── AdForm.tsx         # Ad creation/editing form with platform-specific targeting
│   ├── FacebookAd.tsx     # Facebook ad rendering
│   ├── InstagramAd.tsx    # Instagram ad rendering
│   ├── TikTokAd.tsx       # TikTok ad rendering
│   ├── TwitterAd.tsx      # Twitter ad rendering
│   ├── LinkedInAd.tsx     # LinkedIn ad rendering
│   └── SmartLink.tsx      # Iframe-aware link component (postMessage support)
├── facebook/              # Facebook-specific components (Header, PostCard)
├── instagram/             # Instagram-specific components (Header, PostCard)
├── tiktok/                # TikTok-specific components (VideoPlayer)
└── ...                    # Other UI components
contexts/                    # ClientAuthContext replaces Supabase auth
hooks/                       # usePromotionalAds, etc.
lib/
├── auth.ts                 # JWT utilities (createToken, verifyToken, getSession, getSessionOrDemo, getAdminSession)
├── prisma.ts               # Prisma client singleton
├── feedService.ts          # Feed generation algorithm
└── utmGenerator.ts         # UTM parameter generation for ad tracking
types/
└── admin.ts                # User management type definitions
utils/
└── sampleAds.ts           # Sample ad creation utilities
data/platforms.ts           # Platform definitions with gradients
prisma/schema.prisma        # Database schema
middleware.ts               # Route protection (JWT validation + demo mode)
```

### Key Architecture Patterns

#### 1. Multi-Schema Database (Prisma)

The database uses **two PostgreSQL schemas**:

- `auth`: Contains `users` table (identifier, encrypted_password, JWT-related)
- `public`: Contains all app tables (profiles, promotional_ads, campaigns, simulated_posts, platform_followers, etc.)

**Important**: Always specify `@@schema("auth")` or `@@schema("public")` in Prisma models.

#### 2. Authentication Flow

- **Authentication Method**: Email OR phone number + password
  - Email format: standard email validation (`user@example.com`)
  - Phone format: international format with + prefix (`+1234567890`)
- **JWT Tokens**: Created with `jose` library, stored in httpOnly cookies (7-day expiration)
- **Password Hashing**: bcryptjs with 10 rounds
- **Session**: Retrieved via `getSession()` from `lib/auth.ts`
- **Demo Mode**: `getSessionOrDemo()` allows pre-authenticated access via URL params (`?demo_key=xxx&user=xxx`)
- **Admin API Key**: `getAdminSession()` supports BOTH JWT cookies AND admin API key (Bearer token in Authorization header)
  - For external/admin access without logging in
  - Uses `ADMIN_API_KEY` environment variable
  - Returns `'admin'` string for API key auth, or `SessionData` object for JWT auth
- **Route Protection**: `middleware.ts` validates JWT for protected routes OR demo mode credentials
- **Client State**: `ClientAuthContext` manages user/profile state
- **Identifier Validation**: `validateIdentifier()` auto-detects email vs phone and validates format

Protected routes: `/profile`, `/ads`, `/users`, `/facebook`, `/instagram`, `/tiktok`, `/twitter`, `/linkedin`

#### 3. API Routes Pattern

All API routes follow this structure:

1. Get session via `await getSession()` or `await getSessionOrDemo()` (for demo mode support)
2. Return 401 if no session (for protected routes)
3. Use Prisma for database operations
4. Return JSON responses with appropriate status codes

Example (with demo mode):

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const demoKey = searchParams.get("demo_key")
  const demoUser = searchParams.get("user")

  const session = await getSessionOrDemo(demoKey, demoUser)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const data = await prisma.profile.findUnique({ where: { id: session.id } })
  return NextResponse.json(data)
}
```

#### 4. Platform Simulators & Feed System

Each platform simulator (`/facebook`, `/instagram`, etc.):

- Uses platform-specific components from `components/[platform]/`
- **Fetches timeline feed** via `/api/feed?platform=xxx` (returns posts from followed users + ads)
- Renders posts using platform-specific PostCard/VideoPlayer components
- Renders ads using `components/ads/[Platform]Ad.tsx`
- Maintains authentic platform styling and layout
- Supports **post deletion** (own posts only) and **sharing/reposting** (any post)
- Shows **shared post attribution** with original author information

**Feed Algorithm** (`lib/feedService.ts`):

- Fetches posts from users the current user follows on that specific platform
- Fetches active promotional ads for that platform
- Merges chronologically with **1 ad inserted every 3 posts**
- Filters out soft-deleted posts and their shares
- Returns array of `FeedItem` objects with `type: 'post' | 'ad'`

#### 5. Tailwind Gradient Safelist

**Critical**: Platform logo gradients use dynamic class names. To ensure they're included in the build, they **must be safelisted** in `tailwind.config.js`:

```javascript
safelist: [
  "from-blue-600",
  "to-blue-700", // Facebook
  "from-pink-500",
  "via-red-500",
  "to-yellow-500", // Instagram
  "from-gray-900",
  "to-black", // TikTok
  "from-sky-400",
  "to-sky-600", // Twitter
  "from-blue-700",
  "to-blue-800", // LinkedIn
  "bg-gradient-to-br",
  "bg-gradient-to-r",
]
```

**When adding new platforms**: Update both `data/platforms.ts` and the Tailwind safelist.

#### 6. Iframe Support & Feed Refresh

The platform simulators support **iframe embedding** with special handling for navigation and refresh functionality:

**Iframe Detection**:

- Uses `window.self !== window.top` to detect iframe context
- Implemented in `useEffect` hooks on each platform page

**Profile Link Behavior**:

- **Not iframed**: Profile links work normally, navigating to `/profile`
- **Iframed**: Profile links are disabled (rendered as non-clickable divs) to prevent navigation outside the iframe context
- This ensures a better mobile experience when embedded in parent applications

**Feed Refresh**:

- All platform "Home" buttons trigger `loadFeed()` to refresh the timeline
- Refresh works on both desktop and mobile layouts
- Implemented across all platforms:
  - **Facebook**: Home button in header ([FacebookHeader.tsx](components/facebook/FacebookHeader.tsx:43))
  - **Instagram**: Home button in header and bottom nav ([InstagramHeader.tsx](components/instagram/InstagramHeader.tsx:48-51), [InstagramBottomNav.tsx](components/instagram/InstagramBottomNav.tsx:26-30))
  - **Twitter**: Home button in sidebar and bottom nav ([page.tsx](app/twitter/page.tsx:365), [page.tsx](app/twitter/page.tsx:341))
  - **TikTok**: Home button in bottom nav ([page.tsx](app/tiktok/page.tsx:188))
  - **LinkedIn**: Home button in desktop nav and bottom nav ([page.tsx](app/linkedin/page.tsx:196), [page.tsx](app/linkedin/page.tsx:466))

**Implementation Pattern**:

```typescript
// Detect iframe
const [isIframed, setIsIframed] = useState(false)
useEffect(() => {
  setIsIframed(window.self !== window.top)
}, [])

// Conditional profile link rendering
{
  isIframed ? (
    <div className="...">Profile Avatar</div>
  ) : (
    <button onClick={() => router.push("/profile")}>Profile Avatar</button>
  )
}

// Refresh on home button click
;<button onClick={loadFeed}>
  <Home className="..." />
</button>
```

#### 7. Ad Manager Architecture

The Ad Manager system provides comprehensive cross-platform promotional ad creation and management:

**Key Features**:

- **Dedicated pages** with proper routing for better UX
  - `/ads` - Main ad grid with filtering and management
  - `/ads/new` - Create new ad campaign
  - `/ads/[id]/edit` - Edit existing ad campaign (dynamic route)
- **Platform-specific user targeting** with "Target All" functionality
- **Automatic UTM parameter generation** for campaign tracking
- **Manual ad ordering** using `updated_at` timestamp with bump functionality
- **Active/Inactive toggle** with visual distinction and filtering

**Database Schema for Targeting**:

The system uses **three related tables** for platform-specific targeting:

1. **promotional_ads**: Core ad data with `campaign_name`, content, image_url, link_url, cta_text, platforms[], industry, is_active
2. **ad_targets**: Per-platform targeting configuration (ad_id, platform, target_all)
3. **ad_target_users**: Specific user targeting when not targeting all (ad_target_id, user_id)

```prisma
model PromotionalAd {
  id            String   @id @default(uuid()) @db.Uuid
  user_id       String   @db.Uuid
  campaign_name String   // Descriptive campaign name
  content       String   // Ad body text
  image_url     String?
  link_url      String?  // Base URL (UTM params added automatically)
  cta_text      String?  // Call-to-action button text
  platforms     String[] // Array of platform IDs
  industry      String?
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now())
  updated_at    DateTime @default(now()) @updatedAt
  ad_targets    AdTarget[]

  @@schema("public")
  @@index([updated_at])  // For manual ordering
}

model AdTarget {
  id         String   @id @default(uuid()) @db.Uuid
  ad_id      String   @db.Uuid
  platform   String
  target_all Boolean  @default(true)
  created_at DateTime @default(now())

  ad             PromotionalAd @relation(fields: [ad_id], references: [id], onDelete: Cascade)
  targeted_users AdTargetUser[]

  @@unique([ad_id, platform])
  @@index([ad_id, platform])
  @@schema("public")
}

model AdTargetUser {
  id           String   @id @default(uuid()) @db.Uuid
  ad_target_id String   @db.Uuid
  user_id      String   @db.Uuid
  created_at   DateTime @default(now())

  ad_target AdTarget @relation(fields: [ad_target_id], references: [id], onDelete: Cascade)

  @@unique([ad_target_id, user_id])
  @@index([ad_target_id])
  @@schema("public")
}
```

**UTM Parameter Generation** (`lib/utmGenerator.ts`):

All ad URLs automatically get UTM tracking parameters:

- `utm_source`: Platform name (e.g., "facebook", "instagram")
- `utm_medium`: Always "social_media"
- `utm_campaign`: Campaign name (URL encoded)
- `utm_content`: Ad content (first 100 chars, URL encoded)

```typescript
import { generateAdURL } from "@/lib/utmGenerator"

// In platform ad components:
const adUrl = ad.link_url ? generateAdURL(ad.link_url, "facebook", ad.campaign_name, ad.content) : null
// Result: https://example.com/sale?utm_source=facebook&utm_medium=social_media&utm_campaign=Summer%20Sale&utm_content=Get%2050%25%20off
```

**Manual Ad Ordering**:

Ads are ordered by `updated_at` DESC. Users can "bump" ads to the top:

- **Bump button**: Updates `updated_at` to current timestamp via `/api/ads/[id]/bump`
- **Any edit**: Also updates `updated_at`, automatically bumping the ad
- **Newest first**: Most recently created or updated ads appear at the top

**Ad Manager UI**:

**Main Grid** ([app/ads/page.tsx](app/ads/page.tsx)):

- **Grid view**: Shows all ads (active and inactive) with platform icons
- **Platform icons**: Uses same Lucide React icons as home page (Facebook, Instagram, Music, X, Linkedin)
- **Toggle switch**: Active/Inactive status with green (active) or gray (inactive) styling
- **Icon buttons**: Bump (ArrowUp), Edit (Pencil), Delete (Trash2) for compact UI
- **Filter buttons**: All / Active / Inactive with counts
- **Visual distinction**: Inactive ads have `opacity-60`
- **Navigation**: Edit button navigates to `/ads/[id]/edit` using dynamic routing
- **Create button**: "Create New Campaign" navigates to `/ads/new`

**Ad Creation** ([app/ads/new/page.tsx](app/ads/new/page.tsx)):

- Dedicated page for creating new ad campaigns
- Uses AdForm component
- Router navigation back to `/ads` on save/cancel

**Ad Editing** ([app/ads/[id]/edit/page.tsx](app/ads/[id]/edit/page.tsx)):

- Dynamic route for editing specific ads
- Loads ad data with ownership validation
- Error handling for non-existent or unauthorized ads
- Uses Next.js 15 async params pattern
- Router navigation back to `/ads` on save/cancel

**Ad Targeting Flow** ([components/ads/AdForm.tsx](components/ads/AdForm.tsx)):

1. Select platforms (expandable cards)
2. For each platform, choose:
   - **Target All Users** (checkbox): Sets `target_all: true`, no user selection needed
   - **Specific Users** (unchecked): Shows user list with checkboxes, stores in `ad_target_users`
3. On save, creates ad + ad_targets + ad_target_users in single transaction

**Feed Integration**:

When fetching ads for platform feeds:

```typescript
// GET /api/ads?platform=facebook&user_id=xxx
// Returns only active ads where:
// - ad_targets.platform = 'facebook'
// - AND (target_all = true OR user_id in targeted_users)
```

## Database Schema Highlights

### Key Tables

#### Authentication Schema (`auth`)

- **users**: Email or phone-based authentication (identifier, encrypted_password)

#### Public Schema (`public`)

- **profiles**: User profiles (username, avatar_url, bio) - 1:1 with users
- **promotional_ads**: Cross-platform promotional ads with **GIN index** on `platforms[]` array
  - Uses `campaign_name` (not title) for descriptive campaign naming
  - `updated_at` indexed for manual ad ordering
  - `is_active` flag for activation/deactivation
  - Related to `ad_targets` for platform-specific user targeting
- **ad_targets**: Platform-specific targeting configuration for promotional ads
  - One record per (ad_id, platform) combination
  - `target_all` flag determines if ad targets all users or specific users
  - Related to `ad_target_users` when not targeting all
- **ad_target_users**: Specific user targeting for ads (only when target_all = false)
  - Junction table linking ad_targets to specific user IDs
  - Allows granular per-platform, per-user ad targeting
- **platform_configs**: User platform preferences (follower_count, is_verified) - tracks which platforms each user has enabled
- **platform_followers**: **Platform-specific follower relationships** (follower_user_id, following_user_id, platform)
  - Unique constraint: `[follower_user_id, following_user_id, platform]`
  - Allows User A to follow User B on Instagram but not Facebook
- **simulated_posts**: User-generated posts across all platforms (platform, content, engagement_metrics, posted_at)
  - Supports **soft delete** (is_deleted, deleted_at)
  - Supports **sharing/reposting** (is_shared, original_post_id, shared_at)
  - Self-referential relation for shares
  - JSONB content field varies by platform
- **campaigns**: Multi-platform campaigns with JSONB metadata
- **products, brands**: Product/brand data for ads

### Important Indexes

- `promotional_ads.platforms`: GIN index for efficient array queries
- `promotional_ads.updated_at`: Index for manual ad ordering (newest first)
- `ad_targets`: Composite index on `[ad_id, platform]`, unique constraint on same
- `ad_target_users`: Index on `[ad_target_id]`, unique constraint on `[ad_target_id, user_id]`
- `platform_followers`: Composite indexes on `[follower_user_id, platform]` and `[following_user_id, platform]`
- `simulated_posts`: Indexes on `[platform, is_deleted, posted_at]`, `[user_id, platform, is_deleted]`, `[original_post_id]`
- All foreign keys have cascading deletes

### Key Database Patterns

**Soft Delete**: Posts are marked with `is_deleted: true` instead of physical deletion. Shares of deleted posts are automatically hidden in feed queries.

**Platform-Specific Relationships**: The `platform_followers` table uses a composite unique constraint to ensure platform isolation. Users manage separate follower lists for each social platform.

## Common Tasks

### Adding a New Platform

1. Add platform definition to `data/platforms.ts` (id, name, gradient, etc.)
2. Add gradient classes to `tailwind.config.js` safelist
3. Create simulator page: `app/[platform]/page.tsx`
4. Create platform components: `components/[platform]/`
5. Create ad component: `components/ads/[Platform]Ad.tsx` (use `SmartLink` for ad CTAs)
6. Update `middleware.ts` to protect the route if needed

### Creating Platform-Specific Ad Components

When creating a new ad component for a platform:

1. Create `components/ads/[Platform]Ad.tsx`
2. Import and use `SmartLink` for any external links/CTAs
3. Import `generateAdURL` from `@/lib/utmGenerator` for automatic UTM tracking
4. Match the platform's authentic styling and layout
5. Display ad content: campaign_name, content, image_url, cta_text
6. Use the platform's color scheme from `data/platforms.ts`

Example structure:

```typescript
import { SmartLink } from "./SmartLink"
import { generateAdURL } from "@/lib/utmGenerator"
import { PromotionalAd } from "@/types/ads"

export function PlatformAd({ ad }: { ad: PromotionalAd }) {
  const adUrl = ad.link_url ? generateAdURL(ad.link_url, "platform-id", ad.campaign_name, ad.content) : null

  return (
    <div className="platform-specific-styling">
      {ad.image_url && <img src={ad.image_url} alt={ad.campaign_name} />}
      <h3>{ad.campaign_name}</h3>
      <p>{ad.content}</p>
      {adUrl && <SmartLink href={adUrl}>{ad.cta_text || "Learn More"}</SmartLink>}
    </div>
  )
}
```

### Creating an API Route

1. Create file in `app/api/[route]/route.ts`
2. Export async functions: `GET`, `POST`, `PATCH`, `DELETE`
3. Use `getSession()` for auth
4. Use Prisma for database operations
5. Return `NextResponse.json()`

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Run `npx prisma migrate dev --name <description>`
4. Update API routes and types as needed

### Working with Authentication

- **Server-side**: Use `await getSession()` or `await getSessionOrDemo(demoKey, userId)` from `lib/auth.ts`
- **Client-side**: Use `useAuth()` hook from `ClientAuthContext`
- **Creating tokens**: Use `createToken(userId, identifier)`
- **Setting cookies**: Use `setAuthCookie(response, token)` in API routes
- **Identifier validation**: Use `validateIdentifier(identifier)` which returns `{ type: 'email' | 'phone', valid: boolean }`
  - Automatically detects whether identifier is an email or phone number
  - Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - Phone regex: `/^\+\d{1,15}$/` (international format with +)
- **Demo mode**: Add `?demo_key=xxx&user=xxx` to URLs for pre-authenticated access (requires `DEMO_SECRET_KEY` env var)

### Working with the Follower System

The app implements **platform-specific follower relationships**:

#### Following/Unfollowing Users

```typescript
// Follow a user on a specific platform
await fetch("/api/followers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    following_user_id: "user-uuid",
    platform: "instagram",
  }),
})

// Unfollow
await fetch("/api/followers", {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    following_user_id: "user-uuid",
    platform: "instagram",
  }),
})

// Get who you're following on a platform
const response = await fetch("/api/followers?platform=instagram&type=following")
const following = await response.json()

// Get your followers on a platform
const response = await fetch("/api/followers?platform=instagram&type=followers")
const followers = await response.json()
```

#### User Discovery

```typescript
// Get all users who have enabled a specific platform
const response = await fetch("/api/users?platform=instagram")
const users = await response.json()
// Returns users with their profiles and platform_configs
```

#### Feed Generation

```typescript
// Get personalized feed for a platform
const response = await fetch("/api/feed?platform=instagram")
const feed = await response.json()
// Returns array of { type: 'post' | 'ad', data: {...} }
```

#### Post Management

```typescript
// Soft delete a post (only own posts)
await fetch(`/api/posts/${postId}`, { method: "DELETE" })

// Restore a deleted post
await fetch(`/api/posts/${postId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ restore: true }),
})

// Share/repost a post
await fetch(`/api/posts/${postId}/share`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    platform: "instagram",
    content: {}, // Optional caption/comment
  }),
})
```

### Working with Promotional Ads

The app provides a comprehensive **Ad Manager** at `/ads` for creating and managing cross-platform promotional content with platform-specific user targeting.

#### Accessing the Ad Manager

The Ad Manager is a **dedicated page** (not a modal) accessible via:

- Click "Ad Manager" button in the home page navigation (authenticated users only)
- Navigate directly to `/ads` (requires authentication)

#### Creating & Managing Ads

**Create a new ad campaign** with platform-specific targeting:

```typescript
// POST /api/ads
await fetch("/api/ads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    campaign_name: "Summer Sale 2024", // Changed from 'title'
    content: "Get 50% off all items this summer!",
    image_url: "https://example.com/image.jpg",
    link_url: "https://yourstore.com/sale", // UTM params added automatically
    cta_text: "Shop Now",
    industry: "Retail",
    platforms: ["facebook", "instagram"], // Only platforms being targeted
    is_active: true,
    targeting: {
      facebook: {
        target_all: true, // Target all Facebook users
      },
      instagram: {
        target_all: false, // Target specific Instagram users
        user_ids: ["user-uuid-1", "user-uuid-2"],
      },
    },
  }),
})
// Creates promotional_ad + ad_targets + ad_target_users in single transaction
```

**Update an existing ad**:

```typescript
// PATCH /api/ads/[id]
await fetch(`/api/ads/${adId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    campaign_name: "Updated Campaign Name",
    is_active: false, // Deactivate ad (still visible in "Inactive" filter)
    // ... other fields
    // Note: updated_at is automatically updated (bumps ad to top)
  }),
})
```

**Bump an ad to the top** (manual ordering):

```typescript
// PATCH /api/ads/[id]/bump
await fetch(`/api/ads/${adId}/bump`, {
  method: "PATCH",
})
// Updates updated_at to current timestamp, moving ad to top of list
```

**Toggle active/inactive status**:

```typescript
// PATCH /api/ads/[id]
await fetch(`/api/ads/${adId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    is_active: !currentStatus,
  }),
})
```

**Delete an ad** (permanent):

```typescript
// DELETE /api/ads/[id]
await fetch(`/api/ads/${adId}`, { method: "DELETE" })
// Cascading delete removes ad_targets and ad_target_users
```

**Get all ads for current user** (includes active AND inactive):

```typescript
// GET /api/ads (no query params)
const response = await fetch("/api/ads")
const ads = await response.json()
// Returns all ads with ad_targets and targeted_users included
// Ordered by updated_at DESC (newest/most recently bumped first)
```

**Get ads for a platform feed** (only active, with targeting filter):

```typescript
// GET /api/ads?platform=facebook&user_id=xxx
const response = await fetch(`/api/ads?platform=facebook&user_id=${userId}`)
const ads = await response.json()
// Returns only active ads where:
// - ad_targets.platform = 'facebook'
// - AND (target_all = true OR user_id in targeted_users)
```

#### Sample Ads

The Ad Manager includes a "Try Sample Fashion Ad" button on the `/ads` page:

```typescript
import { createSampleFashionAd } from "@/utils/sampleAds"

// Creates a pre-configured fashion industry ad with realistic content
// Targets all users on all platforms by default
await createSampleFashionAd(userId)
```

The sample ad includes:

- Campaign name, content, image from Pexels
- All 5 platforms enabled (Facebook, Instagram, TikTok, Twitter, LinkedIn)
- Each platform set to `target_all: true`
- Fashion industry category
- Active by default

#### Ad Display in Feeds

Ads are automatically inserted into platform feeds via the feed algorithm (`lib/feedService.ts`):

1. **Feed query** fetches posts from followed users + active targeted ads:

   ```typescript
   const ads = await prisma.promotionalAd.findMany({
     where: {
       is_active: true,
       ad_targets: {
         some: {
           platform: "facebook",
           OR: [{ target_all: true }, { target_all: false, targeted_users: { some: { user_id: currentUserId } } }],
         },
       },
     },
     orderBy: { updated_at: "desc" },
   })
   ```

2. **Merging**: 1 ad is inserted every 3 posts in chronological order

3. **Rendering**: Ads use platform-specific components:

   - `components/ads/FacebookAd.tsx`
   - `components/ads/InstagramAd.tsx`
   - `components/ads/TikTokAd.tsx`
   - `components/ads/TwitterAd.tsx`
   - `components/ads/LinkedInAd.tsx`

4. **UTM tracking**: All ad links automatically include UTM parameters via `generateAdURL()`

#### Ad Manager UI Features

**Filter System** ([app/ads/page.tsx](app/ads/page.tsx)):

- **All**: Shows all ads (active + inactive)
- **Active**: Shows only `is_active: true` ads
- **Inactive**: Shows only `is_active: false` ads
- Each filter button displays count in real-time

**Visual Design**:

- **Platform icons**: Same Lucide React icons as home page (Facebook, Instagram, Music, X, Linkedin)
- **Active/Inactive toggle**: Green switch (active) or gray switch (inactive) with sliding animation
- **Icon buttons**: Pencil (edit) and Trash2 (delete) for compact UI
- **Bump button**: Purple button with ArrowUp icon to promote ad to top
- **Inactive styling**: Ads with `is_active: false` have `opacity-60` for visual distinction

**Navigation & Routing**:

- **Create button**: Navigates to `/ads/new` for creating new campaigns
- **Edit button**: Navigates to `/ads/[id]/edit` for editing specific campaigns (dynamic route)
- **Ad creation page**: Uses `AdForm` component, router navigation back to `/ads` on save/cancel
- **Ad editing page**: Loads ad data with ownership validation, uses Next.js 15 async params pattern
- Form pre-fills with existing ad data on edit page
- Platform targeting shows current target_all and user selections
- Dedicated pages provide better UX with shareable URLs and proper browser history

#### SmartLink Component for Iframe Support

When ads contain links and the app is embedded in an iframe, the `SmartLink` component handles navigation:

```typescript
import { SmartLink } from "@/components/ads/SmartLink"

// Usage in ad components
;<SmartLink href={ad.link_url}>{ad.cta_text}</SmartLink>

// Behavior:
// - Detects if app is running in an iframe (window.self !== window.top)
// - If in iframe: sends postMessage to parent window with URL
// - If not in iframe: opens link normally
// - Message format: { type: 'open-url', url: string }
```

**Parent window integration:**

```typescript
// Parent window should listen for messages
window.addEventListener("message", event => {
  if (event.data.type === "open-url") {
    window.open(event.data.url, "_blank")
  }
})
```

### User Management System

The app provides a comprehensive **User Management** system at `/users` for creating, editing, and managing all users in the system. This is an admin/testing tool accessible to all logged-in users.

#### Accessing User Management

- Click "User Management" button in the home page navigation (authenticated users only)
- Navigate directly to `/users` (requires authentication)

#### Authentication Methods

Admin API routes (`/api/admin/users/*`) support **dual authentication**:

1. **JWT Cookie** (normal logged-in users via browser)
2. **Admin API Key** (external tools, scripts, testing)
   - Set `ADMIN_API_KEY` in environment variables
   - Pass as Bearer token: `Authorization: Bearer <ADMIN_API_KEY>`
   - Returns `'admin'` string instead of session object

#### User List Page (`/users`)

**Features**:

- **Search**: Debounced search box (500ms) for partial match on identifier (email or phone)
- **Platform Filter**: Filter users by enabled platforms (All, Facebook, Instagram, TikTok, Twitter, LinkedIn)
- **User Table**: Shows avatar, username, identifier, platform badges, content count, network stats
- **Actions**: Edit (navigate to edit page), Delete (with confirmation)
- **Create User**: Modal for creating new users with default password

**Creating Users**:

```typescript
// POST /api/admin/users
await fetch("/api/admin/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer <ADMIN_API_KEY>", // Optional: for external access
  },
  body: JSON.stringify({
    identifier: "user@example.com", // Email or phone (+1234567890)
    username: "johndoe", // Optional: auto-generated from identifier
    password: "custompass", // Optional: uses DEFAULT_USER_PASSWORD
    bio: "User bio", // Optional
    avatar_url: "https://...", // Optional: uses dicebear
  }),
})
```

**Username Auto-Generation**:

- **Email**: Uses part before `@` (e.g., `john@example.com` → `john`)
- **Phone**: Removes `+` and uses last 10 digits (e.g., `+1234567890` → `1234567890`)

**Searching and Filtering**:

```typescript
// Search by identifier
GET /api/admin/users?search=john

// Filter by platform
GET /api/admin/users?platform=instagram

// Combine filters
GET /api/admin/users?search=john&platform=instagram
```

#### Edit User Page (`/users/[id]/edit`)

Dedicated page with **4 tabs** for comprehensive user management:

**Tab 1: Profile**

- Edit identifier (email or phone)
- Change password
- Edit username, avatar URL (with refresh button), bio
- Save button updates all profile fields

**Tab 2: Platforms**

- **Expandable platform cards** (similar to profile page)
- Each enabled platform shows:
  - Follower count (editable)
  - Verified status checkbox
  - Expand/collapse button
- **When expanded**:
  - Search box to filter users on that platform
  - List of all users on that platform
  - Follow/Unfollow buttons (updates in real-time)
- **Add platforms**: Grid of available platforms to enable

**Tab 3: Following**

- List of all users this user follows (across all platforms)
- Shows avatar, username, platform, identifier
- Unfollow button for each relationship
- Count of total relationships

**Tab 4: Content**

- **Posts**: Shows recent posts (platform, timestamp)
- **Campaigns**: Shows campaigns with status
- Read-only view

**Managing Platforms**:

```typescript
// Add platform to user
POST /api/admin/users/[id]/platforms
{
  platform: 'instagram',
  follower_count: 100,
  is_verified: true
}

// Update platform config
PATCH /api/admin/users/[id]/platforms/[configId]
{
  follower_count: 500,
  is_verified: true
}

// Remove platform
DELETE /api/admin/users/[id]/platforms/[configId]
```

**Managing Follower Relationships**:

```typescript
// Follow a user
POST /api/admin/users/[id]/followers
{
  following_user_id: 'target-user-id',
  platform: 'instagram'
}

// Unfollow a user
DELETE /api/admin/users/[id]/followers
{
  following_user_id: 'target-user-id',
  platform: 'instagram'
}
```

**Updating User Profile**:

```typescript
// PATCH /api/admin/users/[id]
await fetch(`/api/admin/users/${userId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    identifier: "newemail@example.com", // Optional
    password: "newpassword", // Optional
    profile: {
      username: "newusername", // Optional
      avatar_url: "https://...", // Optional
      bio: "New bio", // Optional
    },
  }),
})
```

**Deleting Users**:

```typescript
// DELETE /api/admin/users/[id]
await fetch(`/api/admin/users/${userId}`, {
  method: "DELETE",
  headers: { Authorization: "Bearer <ADMIN_API_KEY>" },
})
// Cascades to profile, platform_configs, posts, follows, campaigns
// Manually deletes promotional_ads (no FK constraint)
```

#### Environment Variables

```env
# Admin API Key for user management (generate with: openssl rand -hex 32)
ADMIN_API_KEY=your-secure-admin-key-here

# Default password for users created via admin interface
DEFAULT_USER_PASSWORD=password
```

### Profile Page Structure

The profile page ([app/profile/page.tsx](app/profile/page.tsx)) serves as the central hub for:

1. **Profile editing** (username, bio, avatar)
2. **Platform management** (enable/disable platforms, set verified status)
3. **User discovery** (view and follow users per platform)

Each platform card:

- Shows enabled/disabled status with toggle
- **Verified account toggle**: When platform is expanded, shows checkbox to set `is_verified` status
  - Updates via `PATCH /api/platform-configs/[id]`
  - Verified users display with checkmark badge across the app
- Expands to show all users on that platform
- Allows follow/unfollow with optimistic UI updates
- Displays user avatars and verification status

## Docker Deployment Notes

### Environment Variables Required

```
DATABASE_URL=postgresql://user:pass@shared-postgres-multitenant:5432/social_media_simulator
JWT_SECRET=<minimum-32-character-secret>
NODE_ENV=production
PORT=3200

# Cookie security settings
# Set to false for HTTP (development/test), true for HTTPS (production)
COOKIE_SECURE=false

# Admin API Key for user management (generate with: openssl rand -hex 32)
ADMIN_API_KEY=your-secure-admin-key-here

# Default password for users created via admin interface
DEFAULT_USER_PASSWORD=password

# Optional: Demo mode support (for pre-authenticated access via URL params)
DEMO_SECRET_KEY=<your-demo-secret-key>

# Optional: Custom SSH key path for GitHub access (defaults to ~/.ssh/id_ed25519)
GITHUB_SSH_KEY_PATH=/path/to/your/ssh/key
```

### Deployment Flow

1. `deploy.sh` clones from GitHub (or uses local with `--local`, or branch with `--branch`)
2. Builds Docker image with standalone Next.js output
3. `docker-entrypoint.sh` waits for PostgreSQL
4. Creates database if it doesn't exist
5. Runs `prisma migrate deploy` (only for fresh DBs)
6. Starts server on port 3000 (mapped to 3200 externally)

### Docker Network

Container connects to `multitenant-network` network. PostgreSQL must be accessible on this network.

### SSH Key Setup for Private Repository

The deployment script uses **SSH authentication** to clone from GitHub. Setup requirements:

1. **Generate SSH key** (if you don't have one):

   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Default location: ~/.ssh/id_ed25519
   ```

2. **Add SSH key to GitHub**:

   - Copy public key: `cat ~/.ssh/id_ed25519.pub`
   - Go to GitHub → Settings → SSH and GPG keys → New SSH key
   - Paste the public key content
   - Or add as a Deploy Key (repo-specific, read-only): Repository Settings → Deploy Keys

3. **Configure custom SSH key path** (optional):

   - Add to `.env`: `GITHUB_SSH_KEY_PATH=/path/to/your/key`
   - If not specified, defaults to `~/.ssh/id_ed25519`

4. **Verify SSH access**:
   ```bash
   ssh -T git@github.com
   # Should respond: "Hi username! You've successfully authenticated..."
   ```

**Note**: The deployment script automatically:

- Validates SSH key exists and has correct permissions (600 or 400)
- Disables host key checking for automated deployments
- Uses the SSH key for all git operations

## Migration Context

This project was **completely migrated** from Vite + Supabase to Next.js + PostgreSQL. Key changes:

- **Removed**: All Supabase dependencies, React Router, Vite config, src/ directory
- **Added**: Next.js App Router, custom JWT auth, Prisma ORM, Docker deployment
- **Replaced**: `AuthContext` → `ClientAuthContext`, Supabase queries → API routes
- **Updated**: All imports to use `@/*` path aliases

See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for complete details including:

- Before/after architecture comparison
- All database schema details
- Authentication system implementation
- Docker configuration
- Testing checklist
- Known issues and future enhancements

## Working on Issues assigned to Claude in Github

When you work on on issues assigned in Github and create a PR:

- Create a new branch from `main` with a succinct summary name as the issue (e.g., fix: my-issue).
- Target the main branch (this repo uses release-please for releases).
- Use Conventional Commits for all commits (feat:, fix:, docs:, etc.).
- Make sure documentation is updated in the same PR (README + any relevant docs/ files).
- The PR description should list:
- Summary of code changes
- Summary of documentation changes
- Any breaking changes or migration notes
- Do not open a separate “release” PR; release-please will handle that automatically.

## Important Technical Details

### TypeScript Strict Mode

The project uses strict TypeScript. All components and functions should be properly typed.

### React 19 + Next.js 15

- Using React 19 (released) and Next.js 15
- May require `--legacy-peer-deps` for some npm installs due to peer dependency conflicts
- `'use client'` directive required for all client components

### ESLint Configuration

Uses `eslint-config-next` with typescript-eslint. Some files may need:

- `// eslint-disable-next-line react-hooks/exhaustive-deps` for complex useEffect dependencies
- Unused catch variables should be removed or prefixed with `_`

### Image Handling

Currently uses standard `<img>` tags. **Future enhancement**: Migrate to Next.js `<Image>` component for optimization.

### Platform Configs

Users can toggle platform preferences in their profile. These are stored in `platform_configs` table and displayed on the profile page with toggleable cards.

Each platform config includes:

- **Enabled status**: Toggle to enable/disable the platform
- **Follower count**: Displayed follower count (can be customized)
- **Verified status**: Toggle to mark account as verified on that platform (shows checkmark badge)

Update via:

```typescript
// PATCH /api/platform-configs/[id]
await fetch(`/api/platform-configs/${configId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    follower_count: 1000,
    is_verified: true,
  }),
})
```

## Security Considerations

- **JWT Secret**: Must be at least 32 characters in production
- **httpOnly Cookies**: Prevents XSS attacks on auth tokens
- **Password Hashing**: bcryptjs with 10 rounds (consider increasing for production)
- **API Route Auth**: All protected routes check session
- **Prisma**: Automatically prevents SQL injection
- **Future**: Add rate limiting, CSRF protection, refresh tokens

## References

- [Next.js 15 App Router Docs](https://nextjs.org/docs/app)
- [Prisma Multi-Schema](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema)
- [jose JWT Library](https://github.com/panva/jose)
- [Tailwind CSS Safelist](https://tailwindcss.com/docs/content-configuration#safelisting-classes)
