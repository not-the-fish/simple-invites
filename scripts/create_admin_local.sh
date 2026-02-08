#!/bin/bash
# Script to create an admin account locally
# Usage: ./scripts/create_admin_local.sh [email] [password]
# 
# This is a convenience script for creating admin accounts when services are already running.
# For full setup, use: ./scripts/start-local.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EMAIL="${1:-admin@example.com}"
PASSWORD="${2:-admin123}"
BACKEND_URL="http://localhost:8000"

# Check if backend is running
if ! curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Backend is not running at $BACKEND_URL${NC}"
  echo -e "${YELLOW}  Start it with: ./scripts/start-local.sh${NC}"
  exit 1
fi

echo -e "${BLUE}Creating admin account...${NC}"
echo -e "  Email: ${BLUE}$EMAIL${NC}"

# Create admin via API
response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/admin/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "201" ]; then
  echo -e "${GREEN}✓ Admin account created successfully!${NC}"
  if command -v jq &> /dev/null; then
    echo "$body" | jq '.'
  fi
  echo ""
  echo -e "You can now login at ${BLUE}http://localhost:5173/admin/login${NC}"
elif [ "$http_code" = "400" ] && echo "$body" | grep -q "already registered"; then
  echo -e "${YELLOW}⚠ Admin account already exists: $EMAIL${NC}"
  exit 0
elif [ "$http_code" = "403" ]; then
  echo -e "${RED}✗ Registration is disabled${NC}"
  echo -e "${YELLOW}  Admins already exist. Use the authenticated endpoint or delete existing admins first.${NC}"
  exit 1
else
  echo -e "${RED}✗ Failed to create admin account${NC}"
  echo "Response ($http_code): $body"
  exit 1
fi
