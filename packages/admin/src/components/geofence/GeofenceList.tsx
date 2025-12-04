'use client';

import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
}

interface GeofenceListProps {
  geofences: Geofence[];
  selectedId?: string | null;
  onSelect: (geofence: Geofence) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (geofence: Geofence) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export function GeofenceList({
  geofences,
  selectedId,
  onSelect,
  onToggleEnabled,
  onEdit,
  onDelete,
  onCreate,
}: GeofenceListProps) {
  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Geofences</h2>
          <span className="text-sm text-gray-500">{geofences.length} total</span>
        </div>
        <Button onClick={onCreate} className="w-full">
          Create Geofence
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {geofences.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No geofences yet.</p>
            <p className="text-sm mt-1">Click the map or the button above to create one.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {geofences.map((geofence) => (
              <div
                key={geofence.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedId === geofence.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => onSelect(geofence)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{geofence.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {geofence.latitude.toFixed(4)}, {geofence.longitude.toFixed(4)}
                    </p>
                    <p className="text-sm text-gray-500">Radius: {geofence.radius}m</p>
                  </div>
                  <Switch
                    checked={geofence.enabled}
                    onChange={(enabled) => {
                      onToggleEnabled(geofence.id, enabled);
                    }}
                  />
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(geofence);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${geofence.name}"?`)) {
                        onDelete(geofence.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
