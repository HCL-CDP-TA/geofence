# Geofencing SDK - Scalability Considerations

## Current Implementation

### Architecture Overview

The SDK currently uses a **fetch-once, poll-position** approach:

1. **Initial Fetch**: On `monitor.start()`, fetches ALL enabled geofences from `/api/public/geofences`
2. **Position Polling**: Continuously polls user position (default: every 10 seconds)
3. **In-Memory Checking**: Compares position against cached geofences using Haversine formula
4. **Event Emission**: Emits `enter`/`exit` events when boundaries are crossed

### Configuration Options

```typescript
const monitor = new GeofenceMonitor({
  apiUrl: 'https://api.example.com',
  pollingInterval: 10000,      // Position check frequency (ms)
  enableHighAccuracy: true,     // GPS accuracy
  debug: false,                 // Debug logging
  testMode: false               // Manual position control
});
```

## Known Limitations

### 1. Stale Geofence Data

**Problem**: Geofences are fetched once at startup and cached in memory.

**Impact**:
- New geofences added on server won't be detected
- Deleted geofences remain in client memory
- Radius/position changes not reflected
- Enable/disable status changes ignored

**Current Solution**: Manual refresh via `monitor.refreshGeofences()`

```typescript
// Manually refresh when needed
await monitor.refreshGeofences();
```

**Alternative Solutions**:
- **Periodic Auto-refresh**: Add `geofenceRefreshInterval` option to auto-refresh every N minutes
- **Version Checking**: API returns `lastModified` timestamp, SDK checks on each position poll
- **WebSockets/SSE**: Real-time push notifications when geofences change
- **Page Reload**: Simple but loses state - acceptable for many use cases

### 2. Scalability Issues

**Problem**: Fetches ALL enabled geofences globally, regardless of user location.

**Current Limitations**:
- **~100 geofences**: Acceptable (few KB payload)
- **~1,000 geofences**: Noticeable impact (~50-100 KB payload)
- **~10,000 geofences**: Slow download, high memory usage (~500 KB - 1 MB)
- **100,000+ geofences**: Unusable (multi-MB payload, browser memory limits)

**Performance Impact**:
```
Geofences  | Payload Size | Parse Time | Memory Usage | Status
-----------|--------------|------------|--------------|--------
100        | ~5 KB        | <10ms      | ~50 KB       | ✅ Good
1,000      | ~50 KB       | ~20ms      | ~500 KB      | ⚠️ OK
10,000     | ~500 KB      | ~200ms     | ~5 MB        | ❌ Slow
100,000    | ~5 MB        | ~2s        | ~50 MB       | ❌ Unusable
```

## Recommended Solutions for Scale

### Solution 1: Location-Based Filtering (Recommended)

**Server-side filtering** based on user location:

```typescript
// Modify API to accept position parameters
GET /api/public/geofences?lat=37.7749&lng=-122.4194&radius=50000

// Returns only geofences within 50km of user
```

**Benefits**:
- Scales to millions of geofences
- Small payloads regardless of total count
- Leverages database spatial indexes (PostGIS)
- Can re-fetch when user moves significantly

**Implementation**:

```sql
-- Server-side query with PostGIS
SELECT * FROM geofences
WHERE enabled = true
AND ST_DWithin(
  ST_MakePoint(longitude, latitude)::geography,
  ST_MakePoint($userLng, $userLat)::geography,
  $searchRadius
);
```

**SDK Changes**:

```typescript
// Add to GeofenceMonitorOptions
interface GeofenceMonitorOptions {
  // ...existing options
  searchRadius?: number;         // Default: 50000 (50km)
  refetchOnMove?: boolean;       // Default: true
  refetchDistance?: number;      // Default: 10000 (10km)
}

// Automatically refetch when user moves X meters
private async checkPosition() {
  const position = await this.getCurrentPosition();

  // Check if moved significantly
  if (this.shouldRefetch(position)) {
    await this.fetchGeofences(position.coords);
  }

  this.processPosition(position);
}
```

### Solution 2: Hierarchical/Tile-Based Loading

**Divide world into tiles**, load geofences per tile:

```typescript
// Load geofences for specific map tiles
GET /api/public/geofences?tiles=x1_y1,x2_y2,x3_y3
```

**Benefits**:
- Predictable payload sizes
- Works well with map-based interfaces
- Can pre-fetch adjacent tiles

**Trade-offs**:
- More complex implementation
- Multiple API requests may be needed
- Requires tile coordinate management

### Solution 3: Bounding Box Filtering

**Client calculates bounding box**, server filters:

```typescript
// Calculate user's visible/relevant area
const bounds = {
  north: userLat + 0.5,  // ~55km
  south: userLat - 0.5,
  east: userLng + 0.5,
  west: userLng - 0.5
};

GET /api/public/geofences?bounds=${JSON.stringify(bounds)}
```

**Benefits**:
- Simple to implement
- Works well for rectangular regions
- Good for map-based UIs

**Trade-offs**:
- Less accurate than radius-based
- May fetch unnecessary geofences in corners

## Migration Path

### Phase 1: Current (Suitable for <100 geofences)
- ✅ Simple implementation
- ✅ No server changes needed
- ✅ Manual refresh available
- ⚠️ Stale data between refreshes
- ❌ Doesn't scale beyond 100s of geofences

### Phase 2: Add Auto-Refresh (Short-term improvement)
- Add `geofenceRefreshInterval` option
- Automatically refresh every 5-10 minutes
- Still limited by total geofence count

### Phase 3: Location-Based Filtering (Recommended for scale)
- Modify API to accept lat/lng/radius params
- Add spatial indexes to database
- SDK automatically fetches nearby geofences
- Scales to millions of geofences

### Phase 4: Real-time Updates (Optional, for dynamic scenarios)
- WebSocket connection for live updates
- Push notifications when geofences change
- Best user experience but adds complexity

## Current Best Practices

Until location-based filtering is implemented:

1. **Keep geofence count low** (<100 for best performance)
2. **Use manual refresh** when geofences may have changed:
   ```typescript
   // After admin makes changes
   await monitor.refreshGeofences();
   ```

3. **Configure polling interval** based on use case:
   ```typescript
   // High precision (more battery drain)
   pollingInterval: 5000  // 5 seconds

   // Balanced (recommended)
   pollingInterval: 10000  // 10 seconds

   // Battery saving
   pollingInterval: 30000  // 30 seconds
   ```

4. **Consider refresh strategy**:
   - Page load: Always fetches fresh data
   - Manual refresh: User-triggered when needed
   - Periodic refresh: Coming in future update
   - Real-time: WebSockets (future consideration)

## Performance Monitoring

Monitor these metrics to identify when scaling is needed:

- **Initial load time**: Time to fetch and parse geofences
- **Memory usage**: Browser DevTools → Memory
- **API response size**: Network tab payload size
- **Position check latency**: Time to process each position update

Thresholds indicating need for location-based filtering:
- Initial load > 1 second
- Payload size > 100 KB
- Memory usage > 5 MB
- More than 500 geofences in system

## Future Enhancements

Potential improvements for consideration:

1. **Predictive Pre-fetching**: Based on user velocity/direction
2. **Offline Support**: Cache geofences in IndexedDB
3. **Differential Updates**: Only fetch changes since last sync
4. **Geofence Priorities**: Load important geofences first
5. **Background Sync**: Service worker for background monitoring

## See Also

- [packages/sdk/src/GeofenceMonitor.ts](packages/sdk/src/GeofenceMonitor.ts) - Main SDK implementation
- [packages/admin/app/api/public/geofences/route.ts](packages/admin/app/api/public/geofences/route.ts) - Public API endpoint
- [packages/sdk/src/utils/distance.ts](packages/sdk/src/utils/distance.ts) - Haversine distance calculation
