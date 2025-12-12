# Postman Collection Guide

This guide explains how to import and use the Geofence Admin API Postman collection.

## Importing the Collection

1. Open Postman
2. Click **Import** in the top left
3. Select the file `Geofence_Admin_API.postman_collection.json`
4. Click **Import**

The collection will appear in your Collections sidebar with all endpoints organized into folders.

## Setting Up Environment Variables

The collection uses variables for easy configuration. You can set these at the collection or environment level:

### Option 1: Collection Variables (Recommended for Single Project)

1. Right-click the collection in Postman
2. Select **Edit**
3. Go to the **Variables** tab
4. Update the values:
   - `baseUrl`: Your API base URL (default: `http://localhost:3000`)
   - `apiKey`: Your API key from the `.env` file (`GEOFENCE_API_KEY`)
   - `geofenceId`: Auto-populated from responses (leave empty initially)

### Option 2: Environment Variables (Recommended for Multiple Environments)

1. Create a new environment (e.g., "Local", "Staging", "Production")
2. Add the same variables:
   - `baseUrl`: Environment-specific URL
   - `apiKey`: Environment-specific API key
   - `geofenceId`: Leave empty (auto-populated)

## Authentication Setup

The API supports two authentication methods:

### 1. API Key Authentication (Recommended for Postman)

**Setup:**
1. Add `GEOFENCE_API_KEY=your-secret-key` to `packages/admin/.env`
2. Set the `apiKey` variable in Postman to match this value
3. Authenticated requests automatically include `Authorization: Bearer {{apiKey}}`

**Endpoints that require API key:**
- GET /api/geofences
- POST /api/geofences
- PATCH /api/geofences/[id]
- DELETE /api/geofences/[id]

### 2. Session Authentication (For Web Dashboard)

**Setup:**
1. Use the "Register User" request to create an account
2. Use the "Login (NextAuth)" request to authenticate
3. Postman will automatically store the session cookie

**Note:** Session auth is primarily for the web dashboard. For API testing, use API key authentication.

## Collection Structure

### 1. Authentication
- **Register User**: Create a new user account
- **Login (NextAuth)**: Login via credentials provider (sets session cookie)

### 2. Geofences (Authenticated)
All endpoints require authentication (API key or session):
- **List All Geofences**: Get all geofences (enabled and disabled)
- **Create Geofence**: Create a new geofence with lat/lng/radius
- **Update Geofence**: Update geofence properties (all fields optional)
- **Delete Geofence**: Permanently delete a geofence

### 3. Public Endpoints
No authentication required:
- **Get Enabled Geofences**: Public endpoint used by SDK (returns only enabled geofences)

### 4. Server-Side Evaluation
- **Report Position**: Send user position for server-side geofence evaluation
  - Server evaluates geofences and dispatches events to adapters (CDP, webhooks, logger)
  - Returns enter/exit events in response

### 5. Event Logging
View geofence events logged by the LoggerAdapter:
- **Get Events (All)**: View recent events
- **Get Events (By User)**: Filter by userId
- **Get Events (By Type)**: Filter by enter/exit

## Example Workflows

### Workflow 1: Create and Test a Geofence

1. **Set API Key**: Update the `apiKey` collection variable
2. **Create Geofence**:
   ```json
   POST /api/geofences
   {
     "name": "My Store",
     "latitude": 37.7749,
     "longitude": -122.4194,
     "radius": 100,
     "enabled": true
   }
   ```
   The response will auto-populate `{{geofenceId}}`

3. **Verify Creation**:
   ```
   GET /api/geofences
   ```

4. **Test Public Endpoint** (no auth):
   ```
   GET /api/public/geofences
   ```

5. **Test Server Evaluation**:
   ```json
   POST /api/events/position
   {
     "appId": "my-app",
     "userId": "user-123",
     "latitude": 37.7749,
     "longitude": -122.4194,
     "accuracy": 10,
     "timestamp": 1704067200000
   }
   ```

6. **View Logged Events**:
   ```
   GET /api/events?userId=user-123
   ```

### Workflow 2: Update and Disable a Geofence

1. **List Geofences**:
   ```
   GET /api/geofences
   ```
   Copy a geofence ID or use the auto-populated `{{geofenceId}}`

2. **Update Geofence**:
   ```json
   PATCH /api/geofences/{{geofenceId}}
   {
     "name": "Updated Name",
     "enabled": false
   }
   ```

3. **Verify Update**:
   ```
   GET /api/public/geofences
   ```
   The disabled geofence should not appear

### Workflow 3: Test Multi-App Support

1. **Create geofences** (once)

2. **Report position for App 1**:
   ```json
   POST /api/events/position
   {
     "appId": "app-1",
     "userId": "user-123",
     ...
   }
   ```

3. **Report position for App 2** (same userId):
   ```json
   POST /api/events/position
   {
     "appId": "app-2",
     "userId": "user-123",
     ...
   }
   ```

4. **View events per app**:
   ```
   GET /api/events?userId=user-123
   ```
   Events will show different `appId` values, demonstrating namespace isolation

## Auto-Populated Variables

The collection includes test scripts that automatically populate variables:

- **geofenceId**: Set when creating or listing geofences
  - Captured from "Create Geofence" response
  - Captured from first geofence in "List All Geofences" response
  - Used in Update and Delete requests

## Request Examples

### Create Geofence
```json
POST {{baseUrl}}/api/geofences
Authorization: Bearer {{apiKey}}

{
  "name": "Downtown Office",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radius": 100,
  "enabled": true
}
```

### Update Geofence (Partial)
```json
PATCH {{baseUrl}}/api/geofences/{{geofenceId}}
Authorization: Bearer {{apiKey}}

{
  "enabled": false
}
```

### Report Position (Server-Side Evaluation)
```json
POST {{baseUrl}}/api/events/position

{
  "appId": "my-mobile-app",
  "userId": "user-456",
  "latitude": 37.7750,
  "longitude": -122.4195,
  "accuracy": 15,
  "timestamp": 1704067200000,
  "speed": null,
  "heading": null
}
```

## Response Examples

### Successful Geofence Creation (201)
```json
{
  "geofence": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Downtown Office",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "radius": 100,
    "enabled": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "message": "Geofence created successfully"
}
```

### Validation Error (400)
```json
{
  "error": "Invalid input",
  "details": [
    {
      "code": "too_small",
      "minimum": -90,
      "type": "number",
      "inclusive": true,
      "message": "Number must be greater than or equal to -90",
      "path": ["latitude"]
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "error": "Unauthorized"
}
```

## Testing Server-Side Features

### Testing Event Adapters

To test server-side evaluation with adapters, configure your `.env`:

```bash
# Webhook Adapter
GEOFENCE_WEBHOOK_URL="https://webhook.site/your-unique-url"

# HCL CDP Adapter
CDP_API_KEY="your-api-key"
CDP_PASS_KEY="your-pass-key"
CDP_ENDPOINT="https://pl.dev.hxcd.now.hclsoftware.cloud"
```

Then use the "Report Position" endpoint. Events will be:
1. Logged to database (LoggerAdapter - always enabled)
2. POSTed to webhook URL (if configured)
3. Sent to HCL CDP (if configured)

## Tips

1. **Use Folders**: Requests are organized by functionality - use folders to navigate
2. **Check Test Scripts**: Some requests have test scripts that auto-populate variables
3. **Environment Switching**: Create multiple environments for local/staging/production
4. **Save Responses**: Use Postman's "Save Response" to create example responses
5. **Collection Runner**: Use Collection Runner to test full workflows automatically

## Troubleshooting

### 401 Unauthorized Error
- Verify `apiKey` variable matches `GEOFENCE_API_KEY` in `.env`
- Check that the Authorization header is included in the request
- Ensure the API server is running

### 404 Not Found
- Verify the `baseUrl` variable is correct
- Check that the geofence ID exists (use List endpoint)
- Ensure the API server is running on the correct port

### CORS Errors
- The API includes CORS headers for cross-origin requests
- If testing from a browser, ensure the API allows your origin
- Postman doesn't enforce CORS, so this should not affect API testing

### Connection Refused
- Start the admin dev server: `npm run dev` (from monorepo root)
- Verify the server is running on the correct port (default: 3000)
- Check that PostgreSQL database is running

## Additional Resources

- **API Documentation**: See [packages/admin/README.md](packages/admin/README.md)
- **CLAUDE.md**: Complete project documentation with architecture details
- **Environment Setup**: [packages/admin/.env.example](packages/admin/.env.example)
