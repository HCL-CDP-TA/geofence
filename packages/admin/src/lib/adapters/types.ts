// Event adapter interfaces for pluggable geofence event routing

export interface GeofenceEventData {
  appId: string;
  userId: string;
  eventType: 'enter' | 'exit';
  geofence: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  };
  position: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number | null;
    heading?: number | null;
  };
  timestamp: Date;
}

export interface EventAdapter {
  name: string;
  enabled: boolean;

  onEnter(event: GeofenceEventData): Promise<void>;
  onExit(event: GeofenceEventData): Promise<void>;
}

export interface AdapterConfig {
  adapters: EventAdapter[];
}
