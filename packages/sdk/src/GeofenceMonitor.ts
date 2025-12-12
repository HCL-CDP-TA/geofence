// GeofenceMonitor - Main SDK class for geofence tracking

import type {
  GeofenceMonitorOptions,
  Geofence,
  GeofenceEvent,
  MonitorStatus,
  PositionReport,
  PositionReportResponse,
} from './types';
import { isPointInGeofence, calculateDistance } from './utils/distance';

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
  private lastReportedPosition: { latitude: number; longitude: number } | null = null;
  private serverEvaluationEnabled: boolean = false;
  private serverCallInProgress: boolean = false;
  private lastServerReportTime: number = 0;
  private positionProcessingInProgress: boolean = false;

  constructor(options: GeofenceMonitorOptions) {
    // Validate server evaluation options
    if (options.enableServerEvaluation && !options.userId) {
      throw new Error('userId is required when enableServerEvaluation is true');
    }

    this.options = {
      appId: 'default-app',
      pollingInterval: 10000,
      enableHighAccuracy: true,
      debug: false,
      testMode: false,
      enableServerEvaluation: false,
      significantMovementThreshold: 50,
      ...options,
    } as Required<GeofenceMonitorOptions>;

    this.serverEvaluationEnabled = this.options.enableServerEvaluation;

    if (this.options.debug) {
      console.log('[GeofenceMonitor] 🔧 SDK VERSION WITH RACE CONDITION FIX LOADED 🔧');
      console.log('[GeofenceMonitor] Initialized with options:', this.options);
      if (this.serverEvaluationEnabled) {
        console.log('[GeofenceMonitor] Server-side evaluation enabled for user:', this.options.userId);
      }
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

    // Immediately check geofences with new position (don't await to not block caller)
    if (this.isRunning) {
      // Use void to explicitly ignore the promise (fire and forget)
      void this.processPosition(mockPosition);
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
  private async processPosition(position: GeolocationPosition): Promise<void> {
    // Prevent concurrent position processing (especially important in test mode with rapid setTestPosition calls)
    if (this.positionProcessingInProgress) {
      if (this.options.debug) {
        console.log('[GeofenceMonitor] Position processing already in progress, skipping');
      }
      return;
    }

    this.positionProcessingInProgress = true;
    try {
      if (this.serverEvaluationEnabled) {
        await this.handleServerEvaluation(position);
      } else {
        this.processPositionClientSide(position);
      }
    } finally {
      this.positionProcessingInProgress = false;
    }
  }

  /**
   * Client-side position processing (original logic)
   */
  private processPositionClientSide(position: GeolocationPosition): void {
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

  /**
   * Server-side evaluation handler
   */
  private async handleServerEvaluation(position: GeolocationPosition): Promise<void> {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;

    // Prevent concurrent server calls (race condition protection)
    if (this.serverCallInProgress) {
      if (this.options.debug) {
        console.log('[GeofenceMonitor] Server call already in progress, skipping');
      }
      return;
    }

    // Rate limiting: Enforce minimum 5 second interval between server reports
    const now = Date.now();
    const timeSinceLastReport = now - this.lastServerReportTime;
    const MIN_REPORT_INTERVAL = 5000; // 5 seconds

    if (this.lastServerReportTime > 0 && timeSinceLastReport < MIN_REPORT_INTERVAL) {
      if (this.options.debug) {
        console.log(`[GeofenceMonitor] Rate limit: ${Math.ceil((MIN_REPORT_INTERVAL - timeSinceLastReport) / 1000)}s until next report allowed`);
      }
      return;
    }

    // Check if movement is significant enough to report
    if (!this.shouldReportPosition(latitude, longitude)) {
      if (this.options.debug) {
        console.log('[GeofenceMonitor] Movement below threshold, skipping server report');
      }
      return;
    }

    // Report position to server
    this.serverCallInProgress = true;
    try {
      const report: PositionReport = {
        appId: this.options.appId!,
        userId: this.options.userId!,
        latitude,
        longitude,
        accuracy,
        timestamp: position.timestamp,
        speed,
        heading,
      };

      if (this.options.debug) {
        console.log(`[GeofenceMonitor] Sending position to server: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }

      const response = await this.reportPositionToServer(report);

      if (this.options.debug) {
        console.log(`[GeofenceMonitor] Server response received:`, response);
      }

      // Update last reported position and timestamp
      this.lastReportedPosition = { latitude, longitude };
      this.lastServerReportTime = Date.now();

      // Emit events received from server (dedupe against local state)
      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          if (event.type === 'enter') {
            // Only emit if not already tracked as inside this geofence
            if (!this.currentGeofences.has(event.geofence.id)) {
              if (this.options.debug) {
                console.log(`[GeofenceMonitor] ✓ Emitting ENTER event for: ${event.geofence.name} (currently in ${this.currentGeofences.size} geofences)`);
              }
              this.currentGeofences.add(event.geofence.id);
              this.emit('enter', event.geofence);
            } else if (this.options.debug) {
              console.log(`[GeofenceMonitor] ✗ Skipping duplicate ENTER event for: ${event.geofence.name}`);
            }
          } else if (event.type === 'exit') {
            // Only emit if currently tracked as inside this geofence
            if (this.currentGeofences.has(event.geofence.id)) {
              if (this.options.debug) {
                console.log(`[GeofenceMonitor] ✓ Emitting EXIT event for: ${event.geofence.name} (currently in ${this.currentGeofences.size} geofences)`);
              }
              this.currentGeofences.delete(event.geofence.id);
              this.emit('exit', event.geofence);
            } else if (this.options.debug) {
              console.log(`[GeofenceMonitor] ✗ Skipping duplicate EXIT event for: ${event.geofence.name}`);
            }
          }
        }

        // If we received events, enforce a longer cooldown to prevent boundary oscillation
        // Reset the rate limit timer to enforce minimum 15 seconds before next report
        const EVENT_COOLDOWN = 15000; // 15 seconds after an event
        this.lastServerReportTime = Date.now() + (EVENT_COOLDOWN - MIN_REPORT_INTERVAL);

        if (this.options.debug) {
          console.log(`[GeofenceMonitor] Event cooldown: waiting 15s before next position report`);
        }
      }

      if (this.options.debug) {
        console.log(`[GeofenceMonitor] Server returned ${response.events.length} events`);
      }
    } catch (error) {
      this.emit('error', error as Error);
    } finally {
      this.serverCallInProgress = false;
    }
  }

  /**
   * Check if position should be reported to server
   */
  private shouldReportPosition(lat: number, lng: number): boolean {
    if (!this.lastReportedPosition) {
      return true; // Always report first position
    }

    const distance = calculateDistance(
      this.lastReportedPosition.latitude,
      this.lastReportedPosition.longitude,
      lat,
      lng
    );

    return distance >= this.options.significantMovementThreshold!;
  }

  /**
   * Report position to server for evaluation
   */
  private async reportPositionToServer(report: PositionReport): Promise<PositionReportResponse> {
    const response = await fetch(`${this.options.apiUrl}/api/events/position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Failed to report position: ${response.statusText}`);
    }

    return await response.json();
  }
}
