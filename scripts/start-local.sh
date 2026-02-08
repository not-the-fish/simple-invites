#!/bin/bash
# Unified script to start the local development environment
# Usage: ./scripts/start-local.sh [--hard-reset] [--admin-email EMAIL] [--admin-password PASSWORD]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
HARD_RESET=false
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
BACKEND_PORT=8000
FRONTEND_PORT=5173
DB_PORT=5432

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --hard-reset)
      HARD_RESET=true
      shift
      ;;
    --admin-email)
      ADMIN_EMAIL="$2"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--hard-reset] [--admin-email EMAIL] [--admin-password PASSWORD]"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Helper functions
check_port() {
  local port=$1
  lsof -i :$port > /dev/null 2>&1
}

check_backend() {
  curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1
}

check_admin_exists() {
  local email=$1
  
  # Check directly in database for more reliability
  cd "$PROJECT_ROOT/backend"
  
  # Determine which Python to use
  if [ -f ".venv/bin/python" ]; then
    PYTHON_CMD=".venv/bin/python"
  elif [ -f "venv/bin/python" ]; then
    PYTHON_CMD="venv/bin/python"
  else
    PYTHON_CMD="python3"
  fi
  
  # Check if admin exists in database
  result=$("$PYTHON_CMD" -c "
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.admin import Admin

db = SessionLocal()
try:
    admin = db.query(Admin).filter(Admin.email == '$email').first()
    sys.exit(0 if admin else 1)
finally:
    db.close()
" 2>/dev/null)
  
  return $result
}

create_admin() {
  local email=$1
  local password=$2
  
  echo -e "${BLUE}Creating admin account: $email${NC}"
  
  # Use direct database creation for reliability (ensures correct password hashing)
  cd "$PROJECT_ROOT/backend"
  
  # Determine which Python to use
  if [ -f ".venv/bin/python" ]; then
    PYTHON_CMD=".venv/bin/python"
  elif [ -f "venv/bin/python" ]; then
    PYTHON_CMD="venv/bin/python"
  else
    PYTHON_CMD="python3"
  fi
  
  # Create admin directly in database
  if "$PYTHON_CMD" "$PROJECT_ROOT/scripts/create_admin_direct.py" "$email" "$password"; then
    echo -e "${GREEN}✓ Admin account created successfully${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed to create admin account${NC}"
    return 1
  fi
}

wait_for_backend() {
  local max_attempts=30
  local attempt=0
  
  echo -e "${BLUE}Waiting for backend to be ready...${NC}"
  while [ $attempt -lt $max_attempts ]; do
    if check_backend; then
      echo -e "${GREEN}✓ Backend is ready${NC}"
      return 0
    fi
    attempt=$((attempt + 1))
    if [ $((attempt % 5)) -eq 0 ]; then
      echo -e "${YELLOW}  Still waiting... (${attempt}/${max_attempts})${NC}"
    fi
    sleep 1
  done
  
  echo -e "${RED}✗ Backend failed to start within $max_attempts seconds${NC}"
  echo -e "${YELLOW}Checking backend logs...${NC}"
  if [ -f /tmp/simple-invites-backend.log ]; then
    echo -e "${BLUE}Last 20 lines of backend log:${NC}"
    tail -n 20 /tmp/simple-invites-backend.log
  fi
  echo -e "${YELLOW}Check full logs: tail -f /tmp/simple-invites-backend.log${NC}"
  return 1
}

# Hard reset
if [ "$HARD_RESET" = true ]; then
  echo -e "${YELLOW}🔄 Performing hard reset...${NC}"
  
  # Stop backend
  if check_port $BACKEND_PORT; then
    echo -e "${BLUE}Stopping backend...${NC}"
    lsof -ti :$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
  
  # Stop frontend
  if check_port $FRONTEND_PORT; then
    echo -e "${BLUE}Stopping frontend...${NC}"
    lsof -ti :$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
  
  # Stop and completely reset database (remove volumes)
  echo -e "${BLUE}Resetting database (this will delete all data)...${NC}"
  cd "$PROJECT_ROOT"
  docker-compose down -v 2>/dev/null || true
  echo -e "${BLUE}Starting fresh database...${NC}"
  docker-compose up -d db
  
  # Wait for database to be healthy
  echo -e "${BLUE}Waiting for database to be ready...${NC}"
  max_attempts=30
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps db 2>/dev/null | grep -q "healthy"; then
      break
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  
  if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ Database failed to become healthy${NC}"
    exit 1
  fi
  
  sleep 2  # Give it a moment to be fully ready
  
  # Run migrations
  echo -e "${BLUE}Running database migrations...${NC}"
  cd "$PROJECT_ROOT/backend"
  
  # Check for virtual environment first
  if [ -d ".venv" ] && [ -f ".venv/bin/alembic" ]; then
    echo -e "${BLUE}Using alembic from .venv...${NC}"
    .venv/bin/alembic upgrade head
  elif [ -d "venv" ] && [ -f "venv/bin/alembic" ]; then
    echo -e "${BLUE}Using alembic from venv...${NC}"
    venv/bin/alembic upgrade head
  elif command -v alembic &> /dev/null; then
    # Alembic is in PATH
    alembic upgrade head
  else
    # Ensure dependencies are installed first
    if ! python3 -c "import alembic" 2>/dev/null; then
      echo -e "${YELLOW}⚠ Alembic not found, installing dependencies...${NC}"
      if command -v uv &> /dev/null; then
        # Use uv pip install (doesn't require pyproject.toml)
        uv pip install alembic sqlalchemy pydantic pydantic-settings psycopg2-binary python-dotenv
      else
        # Fallback to pip3
        pip3 install alembic sqlalchemy pydantic pydantic-settings psycopg2-binary python-dotenv
      fi
    fi
    
    # Try to find alembic in Python's bin directory
    python_bin=$(python3 -c "import sys; print(sys.executable)")
    python_dir=$(dirname "$python_bin")
    alembic_path="$python_dir/alembic"
    
    if [ -f "$alembic_path" ] || [ -f "${alembic_path}.exe" ]; then
      "$alembic_path" upgrade head
    else
      # Try using the alembic module's CLI entry point
      python3 -c "from alembic.config import main; main(['upgrade', 'head'])" || {
        echo -e "${RED}✗ Cannot run migrations: alembic not available${NC}"
        echo -e "${YELLOW}  Tried: .venv/bin/alembic, venv/bin/alembic, alembic command, and alembic module${NC}"
        exit 1
      }
    fi
  fi
  
  echo -e "${GREEN}✓ Hard reset complete (database cleared and migrations applied)${NC}"
fi

# Check database
echo -e "${BLUE}Checking database...${NC}"
if ! check_port $DB_PORT; then
  echo -e "${YELLOW}⚠ Database not running, starting it...${NC}"
  cd "$PROJECT_ROOT"
  docker-compose up -d db
  echo -e "${BLUE}Waiting for database to be ready...${NC}"
  sleep 5
  
  # Wait for database to be healthy
  max_attempts=30
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps db | grep -q "healthy"; then
      break
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  
  echo -e "${GREEN}✓ Database started${NC}"
else
  echo -e "${GREEN}✓ Database is running${NC}"
fi

# Ensure backend dependencies are installed
echo -e "${BLUE}Checking backend dependencies...${NC}"
cd "$PROJECT_ROOT/backend"

# Determine which Python to use for checks
if [ -f ".venv/bin/python" ]; then
  PYTHON_CHECK=".venv/bin/python"
elif [ -f "venv/bin/python" ]; then
  PYTHON_CHECK="venv/bin/python"
else
  PYTHON_CHECK="python3"
fi

if ! "$PYTHON_CHECK" -c "import fastapi" 2>/dev/null; then
  echo -e "${YELLOW}⚠ Backend dependencies not found, installing...${NC}"
  if command -v uv &> /dev/null; then
    # Use uv pip install (doesn't require pyproject.toml)
    uv pip install fastapi "uvicorn[standard]" sqlalchemy alembic pydantic pydantic-settings "passlib[bcrypt]" "python-jose[cryptography]" psycopg2-binary python-dotenv email-validator
  else
    # Fallback to pip3
    pip3 install fastapi "uvicorn[standard]" sqlalchemy alembic pydantic pydantic-settings "passlib[bcrypt]" "python-jose[cryptography]" psycopg2-binary python-dotenv email-validator
  fi
  echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
  echo -e "${GREEN}✓ Backend dependencies available${NC}"
fi

# Check backend
echo -e "${BLUE}Checking backend...${NC}"
if ! check_backend; then
  if check_port $BACKEND_PORT; then
    echo -e "${YELLOW}⚠ Port $BACKEND_PORT is in use but backend is not responding${NC}"
    echo -e "${YELLOW}  Killing process on port $BACKEND_PORT...${NC}"
    lsof -ti :$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
  
  echo -e "${BLUE}Starting backend...${NC}"
  cd "$PROJECT_ROOT/backend"
  
  # Check if .env exists
  if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found, creating it...${NC}"
    cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/simple_invites_db
SECRET_KEY=dev-secret-key-change-in-production-$(openssl rand -hex 16)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ENVIRONMENT=development
APP_NAME=Simple Invites
EOF
  fi
  
  # Determine which Python to use
  if [ -f ".venv/bin/python" ]; then
    PYTHON_CMD=".venv/bin/python"
    echo -e "${BLUE}Using Python from .venv${NC}"
  elif [ -f "venv/bin/python" ]; then
    PYTHON_CMD="venv/bin/python"
    echo -e "${BLUE}Using Python from venv${NC}"
  else
    PYTHON_CMD="python3"
    echo -e "${BLUE}Using system Python${NC}"
  fi
  
  # Start backend in background
  nohup "$PYTHON_CMD" -m uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > /tmp/simple-invites-backend.log 2>&1 &
  echo $! > /tmp/simple-invites-backend.pid
  echo -e "${BLUE}Backend starting (PID: $(cat /tmp/simple-invites-backend.pid))${NC}"
  
  wait_for_backend || exit 1
else
  echo -e "${GREEN}✓ Backend is running${NC}"
fi

# Check and create admin
echo -e "${BLUE}Checking admin account...${NC}"
if check_admin_exists "$ADMIN_EMAIL"; then
  echo -e "${GREEN}✓ Admin account exists: $ADMIN_EMAIL${NC}"
else
  echo -e "${YELLOW}⚠ Admin account not found, creating...${NC}"
  # After hard reset, there should be no admins, so registration should work
  # But if it fails with 403, it means admins exist - try to create anyway
  if ! create_admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD"; then
    if [ "$HARD_RESET" = true ]; then
      echo -e "${YELLOW}⚠ Admin creation failed after hard reset. This might indicate the database wasn't fully reset.${NC}"
      echo -e "${YELLOW}  You may need to manually delete admins or use a different email.${NC}"
    else
      echo -e "${RED}✗ Failed to create admin account${NC}"
      exit 1
    fi
  fi
fi

# Check frontend
echo -e "${BLUE}Checking frontend...${NC}"
if ! check_port $FRONTEND_PORT; then
  echo -e "${BLUE}Starting frontend...${NC}"
  cd "$PROJECT_ROOT/frontend"
  
  # Start frontend in background
  nohup npm run dev > /tmp/simple-invites-frontend.log 2>&1 &
  echo $! > /tmp/simple-invites-frontend.pid
  
  echo -e "${GREEN}✓ Frontend starting (may take a moment)${NC}"
  echo -e "${YELLOW}  Check logs: tail -f /tmp/simple-invites-frontend.log${NC}"
else
  echo -e "${GREEN}✓ Frontend is running${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Local development environment ready!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "📋 Services:"
echo -e "  ${GREEN}✓${NC} Database:    http://localhost:$DB_PORT"
echo -e "  ${GREEN}✓${NC} Backend:     http://localhost:$BACKEND_PORT"
echo -e "  ${GREEN}✓${NC} Frontend:    http://localhost:$FRONTEND_PORT"
echo ""
echo -e "👤 Admin Account:"
echo -e "  Email:    ${BLUE}$ADMIN_EMAIL${NC}"
echo -e "  Password: ${BLUE}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "🔗 Quick Links:"
echo -e "  Frontend:  ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  Login:     ${BLUE}http://localhost:$FRONTEND_PORT/admin/login${NC}"
echo -e "  API Docs:  ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
echo ""
echo -e "📝 Logs:"
echo -e "  Backend:  ${BLUE}tail -f /tmp/simple-invites-backend.log${NC}"
echo -e "  Frontend: ${BLUE}tail -f /tmp/simple-invites-frontend.log${NC}"
echo ""
echo -e "🛑 To stop services:"
echo -e "  Backend:  ${BLUE}kill \$(cat /tmp/simple-invites-backend.pid)${NC}"
echo -e "  Frontend: ${BLUE}kill \$(cat /tmp/simple-invites-frontend.pid)${NC}"
echo ""

