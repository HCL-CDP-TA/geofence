// Geofence detection utilities

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula
 * Used for movement threshold detection in server evaluation mode
 * @param lat1 Latitude of first point in degrees
 * @param lon1 Longitude of first point in degrees
 * @param lat2 Latitude of second point in degrees
 * @param lon2 Longitude of second point in degrees
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Convert degrees to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

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
