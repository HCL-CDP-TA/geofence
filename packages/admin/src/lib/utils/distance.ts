// Ray casting algorithm for point-in-polygon detection
// Server-side copy from SDK (avoiding circular dependencies)
// Determines if a point is inside a polygon defined by coordinates

/**
 * Check if a point is inside a polygon using the ray casting algorithm
 * @param pointLat Latitude of the point to check
 * @param pointLon Longitude of the point to check
 * @param coordinates Array of polygon vertices (must be exactly 8 points)
 * @returns True if point is inside the polygon
 */
export function isPointInPolygon(
  pointLat: number,
  pointLon: number,
  coordinates: Array<{ lat: number; lng: number }>
): boolean {
  // Must have exactly 8 points (per requirements)
  if (coordinates.length !== 8) {
    console.error('Geofence must have exactly 8 coordinates');
    return false;
  }

  let inside = false;

  // Ray casting algorithm (optimized for 8 points)
  // Cast a horizontal ray from the point to infinity (eastward)
  // Count how many polygon edges the ray crosses
  // Odd crossings = inside, even crossings = outside
  for (let i = 0, j = 7; i < 8; j = i++) {
    const xi = coordinates[i].lng;
    const yi = coordinates[i].lat;
    const xj = coordinates[j].lng;
    const yj = coordinates[j].lat;

    // Check if ray crosses edge between vertices i and j
    const intersect =
      yi > pointLat !== yj > pointLat &&
      pointLon < ((xj - xi) * (pointLat - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
