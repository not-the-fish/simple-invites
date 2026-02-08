#!/bin/bash
# Wrapper script to delete and recreate admin user
# Usage: ./scripts/delete_admin.sh <email> <password>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <email> <password>"
    exit 1
fi

EMAIL=$1
PASSWORD=$2

# Set environment variables from docker-compose.yml
export DATABASE_URL="postgresql://user:password@localhost:5432/queer_kitchen_db"
export SECRET_KEY="dev-secret-key-change-in-production"
export CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
export ENVIRONMENT="development"

# Change to backend directory
cd "$(dirname "$0")/.."

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    uv venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed (using uv)
echo "Installing dependencies with uv..."
uv pip install \
    sqlalchemy \
    pydantic \
    pydantic-settings \
    'passlib[bcrypt]' \
    'python-jose[cryptography]' \
    psycopg2-binary \
    python-dotenv \
    email-validator > /dev/null 2>&1

# Run the Python script
python scripts/delete_and_recreate_admin.py "$EMAIL" "$PASSWORD"

