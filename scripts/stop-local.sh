#!/bin/bash
# Script to stop local development services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_PORT=8000
FRONTEND_PORT=5173

echo -e "${BLUE}Stopping local development services...${NC}"

# Stop backend
if [ -f /tmp/simple-invites-backend.pid ]; then
  pid=$(cat /tmp/simple-invites-backend.pid)
  if kill -0 $pid 2>/dev/null; then
    echo -e "${YELLOW}Stopping backend (PID: $pid)...${NC}"
    kill $pid
    rm /tmp/simple-invites-backend.pid
    echo -e "${GREEN}✓ Backend stopped${NC}"
  else
    rm /tmp/simple-invites-backend.pid
  fi
fi

# Stop any process on backend port
if lsof -ti :$BACKEND_PORT > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing process on port $BACKEND_PORT...${NC}"
  lsof -ti :$BACKEND_PORT | xargs kill -9 2>/dev/null || true
fi

# Stop frontend
if [ -f /tmp/simple-invites-frontend.pid ]; then
  pid=$(cat /tmp/simple-invites-frontend.pid)
  if kill -0 $pid 2>/dev/null; then
    echo -e "${YELLOW}Stopping frontend (PID: $pid)...${NC}"
    kill $pid
    rm /tmp/simple-invites-frontend.pid
    echo -e "${GREEN}✓ Frontend stopped${NC}"
  else
    rm /tmp/simple-invites-frontend.pid
  fi
fi

# Stop any process on frontend port
if lsof -ti :$FRONTEND_PORT > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing process on port $FRONTEND_PORT...${NC}"
  lsof -ti :$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
fi

echo -e "${GREEN}✓ All services stopped${NC}"
echo ""
echo -e "${BLUE}Note: Database is still running. To stop it:${NC}"
echo -e "  docker-compose down"


