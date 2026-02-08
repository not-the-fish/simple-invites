# Testing the RSVP Flow

## Prerequisites

1. **Docker** must be installed and running
2. **Node.js** and **npm** installed
3. **uv** installed (for Python)

## Step 1: Start the Database

```bash
# Start PostgreSQL database
docker compose up -d db

# Wait a few seconds for database to be ready
sleep 5

# Verify database is running
docker compose ps db
```

## Step 2: Set Up Backend

```bash
cd backend

# Create virtual environment (if not already created)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies (if not already installed)
uv pip install -e .

# Create and run migrations
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## Step 3: Start Backend Server

```bash
# Make sure you're in the backend directory with venv activated
cd backend
source .venv/bin/activate

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

## Step 4: Set Up Frontend

In a new terminal:

```bash
cd frontend

# Install dependencies (if not already installed)
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Step 5: Create Test Data

### Option A: Using the API directly

1. **Create an admin account:**
```bash
curl -X POST "http://localhost:8000/api/admin/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "testpassword123"
  }'
```

2. **Login to get a token:**
```bash
curl -X POST "http://localhost:8000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "testpassword123"
  }'
```

Copy the `access_token` from the response.

3. **Create a test event:**
```bash
curl -X POST "http://localhost:8000/api/admin/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Queer Kitchen Test Event",
    "description": "A test event for the RSVP platform",
    "date": "2024-12-31T18:00:00",
    "location": "123 Test Street, Test City",
    "access_code": null
  }'
```

Copy the `invitation_token` from the response.

### Option B: Using the test script

Run the provided test script:
```bash
cd backend
source .venv/bin/activate
python scripts/create_test_data.py
```

## Step 6: Test the RSVP Flow

1. Open your browser and go to:
   ```
   http://localhost:5173/rsvp/YOUR_INVITATION_TOKEN
   ```

2. If the event has an access code, use:
   ```
   http://localhost:5173/rsvp/YOUR_INVITATION_TOKEN?code=ACCESS_CODE
   ```

3. Go through the RSVP flow:
   - Step 1: View event details
   - Step 2: Enter your identity/name
   - Step 3: Select Yes/Maybe/No
   - Step 4: Optionally add contact info
   - Step 5: See confirmation

## Troubleshooting

### Database Connection Issues
- Make sure Docker is running: `docker ps`
- Check database logs: `docker compose logs db`
- Verify DATABASE_URL in `backend/.env` matches docker-compose.yml

### Backend Won't Start
- Check if port 8000 is available: `lsof -i :8000`
- Verify all dependencies are installed: `uv pip list`
- Check for syntax errors: `python -m py_compile app/main.py`

### Frontend Won't Start
- Check if port 5173 is available: `lsof -i :5173`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run build`

### CORS Errors
- Verify CORS_ORIGINS in `backend/.env` includes `http://localhost:5173`
- Restart backend server after changing .env

## API Testing with curl

### Get event (public):
```bash
curl "http://localhost:8000/api/events/INVITATION_TOKEN"
```

### Submit RSVP (public):
```bash
curl -X POST "http://localhost:8000/api/events/INVITATION_TOKEN/rsvp" \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "Test User",
    "response": "yes",
    "email": "test@example.com",
    "phone": "555-1234"
  }'
```

### View RSVPs (admin):
```bash
curl "http://localhost:8000/api/admin/events/EVENT_ID/rsvps" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```


