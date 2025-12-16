// Zod validation schemas for API requests

import { z } from 'zod';

// User schemas
export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Coordinate schema
const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Geofence schemas
export const createGeofenceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  coordinates: z
    .array(coordinateSchema)
    .length(8, 'Geofence must have exactly 8 points'),
  enabled: z.boolean().default(true),
});

export const updateGeofenceSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  coordinates: z
    .array(coordinateSchema)
    .length(8, 'Geofence must have exactly 8 points')
    .optional(),
  enabled: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  name: z.string().optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>;
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
