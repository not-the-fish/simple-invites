# Simple Invites

A secure, minimal event RSVP and survey platform featuring one-question-per-screen UI, shareable invitation links, and multi-admin support.

## Features

- **Event RSVPs**: Create events with shareable invitation links
- **Survey System**: Flexible survey questions with multiple types (text, multiple choice, etc.)
- **Privacy-First**: Guests can RSVP without providing contact information
- **Passwordless Editing**: Guests can edit their RSVPs via secure edit tokens
- **Multi-Admin**: Support for multiple administrators
- **Configurable Branding**: Customize the app name for your use case

## Architecture

- **Backend**: FastAPI (Python) with PostgreSQL
- **Frontend**: React SPA with Vite and Tailwind CSS
- **Database**: PostgreSQL
- **Deployment**: Docker-ready, deploy anywhere

## Quick Start

The easiest way to run locally:

```bash
./scripts/start-local.sh
```

This will:
- Start PostgreSQL in Docker
- Run database migrations
- Start the backend (http://localhost:8000)
- Start the frontend (http://localhost:5173)
- Create a default admin account (admin@example.com / admin123)

To stop:
```bash
./scripts/stop-local.sh
```

## Project Structure

```
simple-invites/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/     # API route handlers
│   │   ├── core/    # Core utilities (config, security, auth)
│   │   ├── models/  # SQLAlchemy models
│   │   └── schemas/ # Pydantic schemas
│   ├── alembic/     # Database migrations
│   └── tests/       # Backend tests
├── frontend/        # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/
├── scripts/         # Development utilities
└── docker-compose.yml
```

## Configuration

### Environment Variables

#### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Secret key for JWT tokens (min 32 chars)
- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins
- `ENVIRONMENT`: `development`, `production`, or `testing`
- `APP_NAME`: Application name displayed in UI and API docs (default: "Simple Invites")

**Optional - Email Notifications:**
- `SMTP_EMAIL`: Gmail address for sending RSVP confirmations
- `SMTP_APP_PASSWORD`: Gmail app password
- `SMTP_FROM_NAME`: Email sender name (defaults to APP_NAME)

#### Frontend
- `VITE_API_BASE_URL`: Backend API URL (default: `http://localhost:8000`)
- `VITE_APP_NAME`: Application name displayed in UI (default: "Simple Invites")

### Custom Branding

To use custom branding (e.g., "My Event Platform"):

```bash
# Backend
export APP_NAME="My Event Platform"

# Frontend (build-time)
export VITE_APP_NAME="My Event Platform"
```

Or set in your `.env` files.

## Development

### Prerequisites

- Python 3.11+ with `uv` installed
- Node.js 20+ and npm
- Docker and Docker Compose (for local database)

### Backend Setup

```bash
cd backend
uv pip install -e .
cp .env.example .env  # Update with your settings
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Using Docker Compose

```bash
docker-compose up
```

This starts:
- PostgreSQL database on port 5432
- Backend API on port 8000
- Frontend on port 3000

## API Documentation

Once the backend is running:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

```bash
cd backend
uv run pytest
```

## Deployment

This repository contains the core application. For deployment:

1. **Self-hosted**: Use the included Dockerfiles with your preferred orchestration
2. **Cloud deployment**: Create a separate deployment repository with your infrastructure config

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## License

MIT
