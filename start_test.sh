#!/bin/bash

echo "🚀 Starting RSVP Platform Test Environment"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start database
echo "📦 Starting PostgreSQL database..."
docker-compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check if database is healthy
if docker-compose ps db | grep -q "healthy"; then
    echo "✅ Database is ready"
else
    echo "⚠️  Database might not be ready yet. Continuing anyway..."
fi

echo ""
echo "📋 Next steps:"
echo "1. In backend directory, run migrations:"
echo "   cd backend"
echo "   source .venv/bin/activate"
echo "   alembic upgrade head"
echo ""
echo "2. Start backend server (in backend directory):"
echo "   uvicorn app.main:app --reload"
echo ""
echo "3. In a new terminal, start frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "4. Create test data:"
echo "   cd backend"
echo "   source .venv/bin/activate"
echo "   python scripts/create_test_data.py"
