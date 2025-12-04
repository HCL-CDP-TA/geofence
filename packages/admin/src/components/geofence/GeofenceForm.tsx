'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
}

interface GeofenceFormProps {
  geofence?: Geofence;
  initialLat?: number;
  initialLng?: number;
  onSubmit: (data: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function GeofenceForm({
  geofence,
  initialLat,
  initialLng,
  onSubmit,
  onCancel,
  isLoading = false,
}: GeofenceFormProps) {
  const [name, setName] = useState(geofence?.name || '');
  const [latitude, setLatitude] = useState(
    geofence?.latitude?.toString() || initialLat?.toString() || ''
  );
  const [longitude, setLongitude] = useState(
    geofence?.longitude?.toString() || initialLng?.toString() || ''
  );
  const [radius, setRadius] = useState(geofence?.radius?.toString() || '100');
  const [enabled, setEnabled] = useState(geofence?.enabled ?? true);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (initialLat !== undefined && initialLng !== undefined && !geofence) {
      setLatitude(initialLat.toFixed(6));
      setLongitude(initialLng.toFixed(6));
    }
  }, [initialLat, initialLng, geofence]);

  // Update form when geofence prop changes (e.g., from dragging)
  useEffect(() => {
    if (geofence) {
      setLatitude(geofence.latitude.toString());
      setLongitude(geofence.longitude.toString());
      setRadius(geofence.radius.toString());
      setEnabled(geofence.enabled);
      setName(geofence.name);
    }
  }, [geofence?.latitude, geofence?.longitude, geofence?.radius, geofence?.enabled, geofence?.name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: parseFloat(radius),
      enabled,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert(`Failed to get location: ${error.message}`);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Downtown Store"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleUseCurrentLocation}
            disabled={isGettingLocation || isLoading}
          >
            {isGettingLocation ? 'Getting location...' : 'Use Current Location'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="latitude" className="block text-xs text-gray-600 mb-1">
              Latitude
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="40.7128"
            />
          </div>

          <div>
            <label htmlFor="longitude" className="block text-xs text-gray-600 mb-1">
              Longitude
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="-74.0060"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="radius" className="block text-sm font-medium text-gray-700 mb-1">
          Radius (meters)
        </label>
        <input
          id="radius"
          type="number"
          min="1"
          required
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="100"
        />
      </div>

      <div className="flex items-center">
        <input
          id="enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
          Enabled
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Saving...' : geofence ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
