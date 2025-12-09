// Haversine formula for calculating distance between two coordinates
// Server-side copy from SDK (avoiding circular dependencies)
// Returns distance in meters

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula
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
 * Check if a point is inside a circular geofence
 * @param pointLat Latitude of the point to check
 * @param pointLon Longitude of the point to check
 * @param centerLat Latitude of geofence center
 * @param centerLon Longitude of geofence center
 * @param radius Radius of geofence in meters
 * @returns True if point is inside the geofence
 */
export function isPointInGeofence(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radius: number
): boolean {
  const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon);
  return distance <= radius;
}
