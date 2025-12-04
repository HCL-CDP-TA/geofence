// Type definitions for the Geofence SDK

export interface GeofenceMonitorOptions {
  apiUrl: string;
  pollingInterval?: number; // milliseconds, default: 10000
  enableHighAccuracy?: boolean; // default: true
  debug?: boolean; // default: false
  testMode?: boolean; // default: false - allows manual position setting for testing
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
