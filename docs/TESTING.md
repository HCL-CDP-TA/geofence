# Testing

## Overview

Unit tests exist for the admin package (`packages/admin`). They cover the `locationId` feature and backward compatibility with clients that don't provide one.

**Test runner**: [Vitest](https://vitest.dev/)
**Total tests**: 17 across 4 test files

---

## Running Tests

From the monorepo root:

```bash
# Run all tests once
npm run test -w admin

# Watch mode (re-runs on file changes)
npm run test:watch -w admin
```

From the admin package directory:

```bash
cd packages/admin

# Run all tests once
npm run test

# Watch mode
npm run test:watch
```

---

## Test Files

### `src/lib/validations.test.ts`

Tests the Zod validation schemas used by the API routes.

| Test | What it verifies |
|---|---|
| `createGeofenceSchema` accepts `locationId` | Field is accepted and passed through |
| `createGeofenceSchema` works without `locationId` | Field is optional (backward compat) |
| `updateGeofenceSchema` accepts `locationId` | Field is accepted on update |
| `updateGeofenceSchema` works without `locationId` | Field is optional on update |

No mocking required — pure schema validation.

---

### `src/lib/adapters/webhook.test.ts`

Tests the `WebhookAdapter` that POSTs geofence events to a configured URL.

`fetch` is stubbed via `vi.stubGlobal` to avoid real HTTP calls.

| Test | What it verifies |
|---|---|
| Sends `locationId` in geofence payload | Feature: `locationId` flows into webhook body |
| Sends `null` `locationId` when geofence has none | Backward compat: null is serialised correctly |
| Does not call `fetch` when disabled | Existing behavior: no URL = no requests |

---

### `src/lib/adapters/cdp.test.ts`

Tests the `CDPAdapter` that tracks events in HCL CDP.

`fetch` is stubbed via `vi.stubGlobal`. `CDP_API_KEY` and `CDP_PASS_KEY` env vars are set in `beforeEach` and cleaned up in `afterEach`.

| Test | What it verifies |
|---|---|
| Includes `location_id` in CDP properties | Feature: field appears in CDP event payload |
| Sends `null` `location_id` when geofence has none | Backward compat: null is sent correctly |
| Does not call `fetch` when credentials absent | Existing behavior: missing env vars disables adapter |
| Uses `Geofence_Entered` event name on enter | Existing behavior: correct CDP event name |
| Uses `Geofence_Exited` event name on exit | Existing behavior: correct CDP event name |

---

### `src/lib/services/geofence-evaluator.test.ts`

Tests the `GeofenceEvaluator` service that evaluates user position against geofences and dispatches events.

Three modules are mocked:
- `@/src/lib/prisma` — avoids real database calls
- `@/src/lib/utils/distance` — controls `isPointInPolygon` return value
- `@/src/lib/adapters` — prevents real adapter initialisation; verifies `dispatchEvent` calls

`invalidateGeofenceCache()` is called in `beforeEach` to clear the module-level geofence cache between tests.

| Test | What it verifies |
|---|---|
| Enter event includes `locationId` | Feature: `locationId` in event result and adapter call |
| Enter event has `null` `locationId` when geofence has none | Backward compat |
| Exit event includes `locationId` | Feature: `locationId` in exit event result and adapter call |
| Exit event has `null` `locationId` when geofence has none | Backward compat |
| No events when user stays inside geofence | Existing behavior: no redundant events |

---

## Configuration

Vitest is configured in `packages/admin/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: { environment: 'node', globals: true },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
})
```

The `@` alias mirrors the TypeScript path alias in `tsconfig.json`, allowing test files to import using the same `@/src/lib/...` paths as production code.
