// GeofenceMonitor - Main SDK class for geofence tracking

import type {
  GeofenceMonitorOptions,
  Geofence,
  GeofenceEvent,
  MonitorStatus,
} from './types';
import { isPointInGeofence } from './utils/distance';

type EventListener = (...args: any[]) => void;

export class GeofenceMonitor {
  private options: Required<GeofenceMonitorOptions>;
  private isRunning: boolean = false;
  private geofences: Geofence[] = [];
  private currentGeofences: Set<string> = new Set();
  private lastPosition: GeolocationPosition | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private watchId: number | null = null;
  private eventListeners: Map<string, EventListener[]> = new Map();
  private testPosition: { latitude: number; longitude: number } | null = null;

  constructor(options: GeofenceMonitorOptions) {
    this.options = {
      pollingInterval: 10000,
      enableHighAccuracy: true,
      debug: false,
      testMode: false,
      ...options,
    };

    if (this.options.debug) {
      console.log('[GeofenceMonitor] Initialized with options:', this.options);
    }
  }

  /**
   * Start monitoring geofences
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      if (this.options.debug) {
        console.log('[GeofenceMonitor] Already running');
      }
      return;
    }

    if (!this.options.testMode && !('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported by this browser');
    }

    // Fetch geofences from API
    await this.fetchGeofences();

    // Request initial position (only if not in test mode)
    if (!this.options.testMode) {
      try {
        await this.getCurrentPosition();
      } catch (error) {
        this.emit('error', error as Error);
        throw error;
      }
    }

    // Start polling
    this.pollingInterval = setInterval(() => {
      this.checkPosition();
    }, this.options.pollingInterval);

    this.isRunning = true;

    if (this.options.debug) {
      console.log('[GeofenceMonitor] Started monitoring');
    }
  }

  /**
   * Stop monitoring geofences
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isRunning = false;

    if (this.options.debug) {
      console.log('[GeofenceMonitor] Stopped monitoring');
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      currentGeofences: Array.from(this.currentGeofences)
        .map((id) => this.geofences.find((g) => g.id === id))
        .filter((g): g is Geofence => g !== undefined),
      lastPosition: this.lastPosition,
    };
  }

  /**
   * Set position manually (test mode only)
   */
  setTestPosition(latitude: number, longitude: number): void {
    if (!this.options.testMode) {
      throw new Error('setTestPosition can only be used in test mode');
    }

    this.testPosition = { latitude, longitude };

    // Create a mock GeolocationPosition
    const coords = {
      latitude,
      longitude,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({ latitude, longitude, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }),
    };
    const timestamp = Date.now();
    const mockPosition: GeolocationPosition = {
      coords,
      timestamp,
      toJSON: () => ({ coords, timestamp }),
    };

    this.lastPosition = mockPosition;
    this.emit('position', mockPosition);

    if (this.options.debug) {
      console.log(`[GeofenceMonitor] Test position set: ${latitude}, ${longitude}`);
    }

    // Immediately check geofences with new position
    if (this.isRunning) {
      this.processPosition(mockPosition);
    }
  }

  /**
   * Get all geofences
   */
  getGeofences(): Geofence[] {
    return this.geofences;
  }

  /**
   * Manually refresh geofences from API
   * Useful when geofences may have changed on the server
   */
  async refreshGeofences(): Promise<void> {
    if (this.options.debug) {
      console.log('[GeofenceMonitor] Refreshing geofences...');
    }

    await this.fetchGeofences();

    if (this.options.debug) {
      console.log(`[GeofenceMonitor] Refreshed ${this.geofences.length} geofences`);
    }

    // Re-check current position against updated geofences
    if (this.lastPosition) {
      this.processPosition(this.lastPosition);
    }
  }

  /**
   * Manually check position
   */
  async checkPosition(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      this.processPosition(position);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Add event listener
   */
  on(event: GeofenceEvent, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: GeofenceEvent, listener: EventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: GeofenceEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`[GeofenceMonitor] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Fetch geofences from API
   */
  private async fetchGeofences(): Promise<void> {
    try {
      const response = await fetch(`${this.options.apiUrl}/api/public/geofences`);

      if (!response.ok) {
        throw new Error(`Failed to fetch geofences: ${response.statusText}`);
      }

      const data = await response.json();
      this.geofences = data.geofences;

      if (this.options.debug) {
        console.log(`[GeofenceMonitor] Fetched ${this.geofences.length} geofences`);
      }
    } catch (error) {
      console.error('[GeofenceMonitor] Error fetching geofences:', error);
      throw error;
    }
  }

  /**
   * Get current position using Geolocation API or test position
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    // In test mode, use test position if available
    if (this.options.testMode) {
      if (this.testPosition) {
        const { latitude, longitude } = this.testPosition;
        const coords = {
          latitude,
          longitude,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({ latitude, longitude, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }),
        };
        const timestamp = Date.now();
        const mockPosition: GeolocationPosition = {
          coords,
          timestamp,
          toJSON: () => ({ coords, timestamp }),
        };
        this.lastPosition = mockPosition;
        this.emit('position', mockPosition);
        return Promise.resolve(mockPosition);
      }
      // If no test position set, return a rejected promise
      return Promise.reject(new Error('No test position set. Use setTestPosition() first.'));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.lastPosition = position;
          this.emit('position', position);
          resolve(position);
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Process position and check for geofence entry/exit
   */
  private processPosition(position: GeolocationPosition): void {
    const { latitude, longitude } = position.coords;

    if (this.options.debug) {
      console.log(`[GeofenceMonitor] Position: ${latitude}, ${longitude}`);
    }

    const newCurrentGeofences = new Set<string>();

    // Check each geofence
    for (const geofence of this.geofences) {
      const isInside = isPointInGeofence(
        latitude,
        longitude,
        geofence.latitude,
        geofence.longitude,
        geofence.radius
      );

      if (isInside) {
        newCurrentGeofences.add(geofence.id);

        // Check for entry event
        if (!this.currentGeofences.has(geofence.id)) {
          if (this.options.debug) {
            console.log(`[GeofenceMonitor] Entered: ${geofence.name}`);
          }
          this.emit('enter', geofence);
        }
      } else {
        // Check for exit event
        if (this.currentGeofences.has(geofence.id)) {
          if (this.options.debug) {
            console.log(`[GeofenceMonitor] Exited: ${geofence.name}`);
          }
          this.emit('exit', geofence);
        }
      }
    }

    this.currentGeofences = newCurrentGeofences;
  }
}
