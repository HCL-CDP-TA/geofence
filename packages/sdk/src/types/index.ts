// Type definitions for the Geofence SDK

export interface GeofenceMonitorOptions {
  apiUrl: string;
  appId?: string; // optional, default: 'default-app'
  pollingInterval?: number; // milliseconds, default: 10000
  enableHighAccuracy?: boolean; // default: true
  debug?: boolean; // default: false
  testMode?: boolean; // default: false - allows manual position setting for testing
  userId?: string; // Required for server-side evaluation
  enableServerEvaluation?: boolean; // default: false - enables server-authoritative geofence evaluation
  significantMovementThreshold?: number; // meters, default: 50 - only report position when moved this distance
}

export interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
}

export type GeofenceEvent = 'enter' | 'exit' | 'error' | 'position';

export interface MonitorStatus {
  isRunning: boolean;
  currentGeofences: Geofence[];
  lastPosition: GeolocationPosition | null;
}

// Server-side evaluation types
export interface PositionReport {
  appId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
}

export interface ServerGeofenceEvent {
  type: 'enter' | 'exit';
  geofence: Geofence;
  timestamp: string;
}

export interface PositionReportResponse {
  success: boolean;
  events: ServerGeofenceEvent[];
  error?: string;
}
