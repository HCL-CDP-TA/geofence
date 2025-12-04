'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import { LocateFixed } from 'lucide-react';

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
}

interface LeafletMapProps {
  geofences: Geofence[];
  onMapClick?: (lat: number, lng: number) => void;
  onGeofenceClick?: (geofence: Geofence) => void;
  selectedGeofenceId?: string | null;
  editingGeofence?: Geofence | null;
  onGeofenceDrag?: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
}

export function Map({
  geofences,
  onMapClick,
  onGeofenceClick,
  selectedGeofenceId,
  editingGeofence,
  onGeofenceDrag,
  onRadiusChange,
}: LeafletMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const currentLocationMarkerRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false);

  useEffect(() => {
    // Import Leaflet dynamically to avoid SSR issues
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!containerRef.current || mapRef.current) return;

      // Get user's current location or use default
      const initializeMap = (lat: number, lng: number, zoom: number) => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current).setView([lat, lng], zoom);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Handle map clicks
        if (onMapClick) {
          map.on('click', (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
          });
        }

        mapRef.current = map;
        setIsLoaded(true);
      };

      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            initializeMap(position.coords.latitude, position.coords.longitude, 13);
          },
          () => {
            // Fallback to default location if geolocation fails
            initializeMap(51.505, -0.09, 13); // London
          },
          {
            timeout: 5000,
            maximumAge: 300000, // Cache for 5 minutes
          }
        );
      } else {
        // Fallback if geolocation not supported
        initializeMap(51.505, -0.09, 13); // London
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update geofences on map
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const L = require('leaflet');
    const map = mapRef.current;

    // Clear existing layers (except base tile layer)
    map.eachLayer((layer) => {
      if (layer instanceof L.Circle || layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add geofences
    geofences.forEach((geofence) => {
      const isSelected = geofence.id === selectedGeofenceId;
      const isEditing = editingGeofence?.id === geofence.id;

      // Use editing geofence position if this is the one being edited
      const lat = isEditing && editingGeofence ? editingGeofence.latitude : geofence.latitude;
      const lng = isEditing && editingGeofence ? editingGeofence.longitude : geofence.longitude;
      const radius = isEditing && editingGeofence ? editingGeofence.radius : geofence.radius;

      // Add circle for geofence
      const circle = L.circle([lat, lng], {
        radius: radius,
        color: isEditing ? '#f59e0b' : isSelected ? '#3b82f6' : geofence.enabled ? '#10b981' : '#6b7280',
        fillColor: isEditing ? '#f59e0b' : isSelected ? '#3b82f6' : geofence.enabled ? '#10b981' : '#6b7280',
        fillOpacity: 0.2,
        weight: isEditing ? 3 : isSelected ? 3 : 2,
      }).addTo(map);

      // Add center marker (draggable if editing)
      const marker = L.circleMarker([lat, lng], {
        radius: isEditing ? 8 : 6,
        color: 'white',
        fillColor: isEditing ? '#f59e0b' : isSelected ? '#3b82f6' : geofence.enabled ? '#10b981' : '#6b7280',
        fillOpacity: 1,
        weight: 2,
        draggable: false, // CircleMarker doesn't support draggable
      }).addTo(map);

      // If editing, add a draggable marker instead
      if (isEditing && onGeofenceDrag) {
        const draggableMarker = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
            className: 'editing-marker',
            html: `
              <div style="
                width: 16px;
                height: 16px;
                background: #f59e0b;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: move;
              "></div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(map);

        // Update circle position during drag without re-rendering
        draggableMarker.on('drag', (e) => {
          const { lat, lng } = e.target.getLatLng();
          circle.setLatLng([lat, lng]);
          marker.setLatLng([lat, lng]);
        });

        // Only update state when drag is complete
        draggableMarker.on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng();
          onGeofenceDrag(lat, lng);
        });

        // Add a radius handle on the edge of the circle (to the right/east)
        // Calculate a point at the edge of the circle
        const earthRadiusKm = 6371;
        const latRad = lat * Math.PI / 180;
        const radiusInDegrees = (radius / 1000) / earthRadiusKm * (180 / Math.PI);
        const handleLat = lat;
        const handleLng = lng + radiusInDegrees / Math.cos(latRad);
        const radiusHandleLatLng = L.latLng(handleLat, handleLng);

        const radiusHandle = L.marker(radiusHandleLatLng, {
          draggable: true,
          icon: L.divIcon({
            className: 'radius-handle',
            html: `
              <div style="
                width: 12px;
                height: 12px;
                background: white;
                border: 2px solid #f59e0b;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: ew-resize;
              "></div>
            `,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        }).addTo(map);

        // Update circle size during drag without re-rendering
        radiusHandle.on('drag', (e) => {
          const handlePos = e.target.getLatLng();
          const newRadius = map.distance([lat, lng], [handlePos.lat, handlePos.lng]);
          circle.setRadius(newRadius);
        });

        // Only update state when drag is complete
        radiusHandle.on('dragend', (e) => {
          const handlePos = e.target.getLatLng();
          const newRadius = Math.round(map.distance([lat, lng], [handlePos.lat, handlePos.lng]));
          if (onRadiusChange) {
            onRadiusChange(newRadius);
          }
        });
      }

      // Add popup
      const popup = L.popup().setContent(`
        <div class="font-sans">
          <strong class="text-base">${geofence.name}</strong><br/>
          <span class="text-sm text-gray-600">Radius: ${geofence.radius}m</span><br/>
          <span class="text-sm text-gray-600">Status: ${geofence.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      `);

      if (!isEditing) {
        circle.bindPopup(popup);
        marker.bindPopup(popup);
      }

      // Handle clicks (only if not editing)
      if (onGeofenceClick && !isEditing) {
        circle.on('click', () => onGeofenceClick(geofence));
        marker.on('click', () => onGeofenceClick(geofence));
      }
    });

    // Fit bounds to show all geofences (only on first load)
    if (geofences.length > 0 && !hasAutoFittedRef.current) {
      const bounds = L.latLngBounds(
        geofences.map((g) => [g.latitude, g.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      hasAutoFittedRef.current = true;
    }
  }, [geofences, isLoaded, selectedGeofenceId, onGeofenceClick, editingGeofence, onGeofenceDrag, onRadiusChange]);

  // Update current location marker
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !currentLocation) return;

    const L = require('leaflet');
    const map = mapRef.current;

    // Remove existing current location marker
    if (currentLocationMarkerRef.current) {
      map.removeLayer(currentLocationMarkerRef.current);
    }

    // Add current location marker
    const marker = L.marker([currentLocation.lat, currentLocation.lng], {
      icon: L.divIcon({
        className: 'current-location-marker',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map);

    marker.bindPopup('<strong>Your Location</strong>');
    currentLocationMarkerRef.current = marker;

    // Center map on current location
    map.setView([currentLocation.lat, currentLocation.lng], 15);
  }, [currentLocation, isLoaded]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
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
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full rounded-lg overflow-hidden shadow-lg" />

      {/* Current Location Button */}
      <button
        onClick={handleGetCurrentLocation}
        disabled={isGettingLocation}
        className="absolute top-4 right-4 z-1000 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow-lg border border-gray-200 font-medium text-sm transition-colors flex items-center gap-2"
        title="Show my location"
      >
        <LocateFixed className="w-4 h-4" />
        {isGettingLocation ? 'Locating...' : 'My Location'}
      </button>
    </div>
  );
}
