#!/bin/bash

# Test script for user update endpoint
# Usage: ./test-user-update.sh USER_ID NEW_USERNAME

BASE_URL="https://geofence.demo.now.hclsoftware.cloud"
API_KEY="bb79cee16083352b86b20381ac63cbc552e049e878dd142b79166f84ea263ffc"

USER_ID="${1}"
NEW_USERNAME="${2:-testuser$(date +%s)}"

if [ -z "$USER_ID" ]; then
  echo "Usage: $0 USER_ID [NEW_USERNAME]"
  echo "Example: $0 clxxx123 newusername"
  exit 1
fi

echo "Testing user update endpoint..."
echo "User ID: $USER_ID"
echo "New Username: $NEW_USERNAME"
echo ""

# Update username
echo "Sending PATCH request..."
curl -X PATCH \
  "${BASE_URL}/api/users/${USER_ID}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${NEW_USERNAME}\"}" \
  | python3 -m json.tool

echo ""
echo "Done! Check the response above to verify the username was updated."
