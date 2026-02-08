# Quick Start Guide

## Prerequisites

1. **Start Docker Desktop** - Make sure Docker Desktop is running on your Mac
   - Open Docker Desktop application
   - Wait for it to fully start (whale icon in menu bar should be steady)

## Step-by-Step Testing

### 1. Start the Database

```bash
docker-compose up -d db
```

Wait a few seconds, then verify it's running:
```bash
docker-compose ps db
```

### 2. Set Up Backend Database

```bash
cd backend
source .venv/bin/activate

# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

### 3. Start Backend Server

Keep the terminal open and run:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 4. Start Frontend (New Terminal)

```bash
cd frontend
npm install  # if first time
npm run dev
```

Frontend will be at: http://localhost:5173

### 5. Create Admin Account

Create an admin via the API:
```bash
curl -X POST http://localhost:8000/api/admin/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### 6. Test the RSVP Flow

1. Login at http://localhost:5173/admin/login
2. Create an event
3. Copy the RSVP link
4. Open the RSVP link in a new browser window

## One-Command Start

For the fastest setup, use:
```bash
./scripts/start-local.sh
```

This automatically:
- Starts the database
- Runs migrations
- Starts backend and frontend
- Creates a default admin account

## Troubleshooting

### Docker not running
- Start Docker Desktop application
- Wait for it to fully initialize
- Check with: `docker ps`

### Port already in use
- Backend (8000): `lsof -ti:8000 | xargs kill -9`
- Frontend (5173): `lsof -ti:5173 | xargs kill -9`

### Database connection errors
- Make sure database is running: `docker-compose ps db`
- Check logs: `docker-compose logs db`
- Verify .env file exists in backend/

### Migration errors
- Make sure database is running first
- Try: `alembic upgrade head --sql` to see SQL without executing
