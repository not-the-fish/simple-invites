# Architecture Documentation

## Overview

Simple Invites is a full-stack web application for managing events and collecting RSVPs. It consists of a FastAPI backend and a React frontend.

## System Architecture

```
┌─────────────────┐
│   React SPA     │  (Frontend - Port 5173/3000)
│   (Vite)        │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│   FastAPI       │  (Backend - Port 8000)
│   (Python)      │
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │  (Database)
└─────────────────┘
```

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM**: SQLAlchemy 2.0
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Migrations**: Alembic
- **Validation**: Pydantic

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charts**: Recharts

## Application Layers

### Backend Architecture

```
app/
├── api/              # API route handlers
│   ├── admin.py      # Admin authentication endpoints
│   ├── admin_events.py  # Admin event management
│   ├── admin_surveys.py # Admin survey management
│   ├── events.py     # Public event endpoints
│   └── surveys.py    # Public survey endpoints
├── core/             # Core functionality
│   ├── auth.py       # Authentication dependencies
│   ├── config.py     # Configuration management
│   ├── constants.py  # Application constants
│   ├── security.py   # Security utilities (hashing, JWT, rate limiting)
│   ├── tokens.py     # Token generation utilities
│   └── sanitization.py # Input sanitization
├── models/           # SQLAlchemy database models
├── schemas/          # Pydantic request/response schemas
├── services/         # Business logic layer
│   ├── event_service.py  # Event creation logic
│   └── email_service.py  # RSVP confirmation emails
└── main.py          # FastAPI application setup
```

### Frontend Architecture

```
src/
├── components/       # Reusable React components
│   ├── Admin/       # Admin-specific components
│   ├── RSVP/        # RSVP flow components
│   ├── Survey/      # Survey components
│   └── Shared/      # Shared components
├── pages/           # Page components (routes)
│   ├── Admin/       # Admin pages
│   ├── RSVPPage.tsx # Public RSVP page
│   └── SurveyPage.tsx # Public survey page
├── services/        # API client services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── config.ts        # Application configuration
└── App.tsx          # Main application component
```

## Data Flow

### Event Creation Flow

```
Admin → POST /api/admin/events
  ↓
EventService.create_event_with_survey()
  ↓
1. Generate unique invitation token
2. Create or link survey
3. Create questions (if new survey)
4. Create event
5. Link survey to event
  ↓
Database (PostgreSQL)
```

### RSVP Submission Flow

```
User → GET /api/events/{token}
  ↓
Load event and survey
  ↓
User fills RSVP form
  ↓
POST /api/events/{token}/rsvp
  ↓
1. Validate access code (if required)
2. Generate edit token (for passwordless editing)
3. Create SurveySubmission with hashed edit token
4. Create QuestionResponse records
5. Send confirmation email (if email provided)
6. Return confirmation + edit token
  ↓
Database (PostgreSQL) + Email Service
```

### RSVP Edit Flow (Passwordless)

```
User → GET /api/events/{token}/my-rsvp?edit_token=xxx
  ↓
1. Find submission by verifying edit token hash
2. Return existing RSVP data
  ↓
User modifies RSVP
  ↓
PUT /api/events/{token}/rsvp?edit_token=xxx
  ↓
1. Verify edit token
2. Update SurveySubmission
3. Update QuestionResponse records
  ↓
Database (PostgreSQL)
```

**Edit Token Storage:**
- Token stored in browser localStorage (device recognition)
- Token included in confirmation email URL (cross-device access)
- Token hashed with bcrypt in database (security)

## Security Model

### Authentication

1. **Admin Authentication**:
   - JWT tokens stored in localStorage (frontend)
   - Tokens expire after 4 hours
   - Rate limited: 5 attempts per 15 minutes per IP

2. **Access Control**:
   - Public endpoints: Events, Surveys, RSVP submission
   - Protected endpoints: All `/api/admin/*` routes
   - Access codes: Optional per-event protection

### Security Measures

1. **Password Security**:
   - Bcrypt hashing (72-byte limit)
   - Minimum 8 characters
   - Secure comparison (constant-time)

2. **Access Code Security**:
   - Bcrypt hashed storage
   - Constant-time comparison
   - Backward compatible with plain text (legacy)

3. **Rate Limiting**:
   - Public endpoints: 100 requests/15 min per IP
   - Login endpoint: 5 attempts/15 min per IP
   - In-memory implementation (single instance)

4. **Input Validation**:
   - Pydantic schemas for all inputs
   - Length limits on all text fields
   - Type validation for all data

5. **XSS Protection**:
   - React automatically escapes JSX
   - Input sanitization utilities (defense-in-depth)
   - Content-Security-Policy headers

6. **Error Handling**:
   - Generic error messages in production
   - Detailed errors in development
   - No sensitive data in error responses

## Database Schema

### Key Relationships

- **Event ↔ Survey**: Circular foreign key relationship
  - `Event.survey_id` → `Survey.id` (required)
  - `Survey.event_id` → `Event.id` (nullable)
  - Allows creating survey before event, or linking existing survey

- **Survey → Questions**: One-to-many
- **Survey → Submissions**: One-to-many
- **Submission → QuestionResponses**: One-to-many
- **Question → QuestionResponses**: One-to-many

### Data Types

- **JSON Columns**:
  - `Question.options`: Question configuration (varies by type)
  - `QuestionResponse.answer`: User's answer (varies by question type)

See `backend/docs/JSON_COLUMNS.md` for detailed JSON structures.

## API Design

### RESTful Conventions

**Public Endpoints:**
- `GET /api/events/{token}` - Retrieve event details
- `GET /api/events/{token}/stats` - Get RSVP statistics (+ guest list if enabled)
- `POST /api/events/{token}/rsvp` - Submit RSVP (returns edit token)
- `GET /api/events/{token}/my-rsvp?edit_token=xxx` - Retrieve own RSVP
- `PUT /api/events/{token}/rsvp?edit_token=xxx` - Update own RSVP
- `GET /api/config` - Get application configuration (app name, etc.)

**Admin Endpoints:**
- `GET /api/admin/events` - List events
- `POST /api/admin/events` - Create event
- `PUT /api/admin/events/{id}` - Update event
- `DELETE /api/admin/events/{id}` - Delete event
- `GET /api/admin/events/{id}/rsvps` - List RSVPs
- `DELETE /api/admin/events/{id}/rsvps/{rsvp_id}` - Delete RSVP

### Error Responses

All errors follow consistent format:
```json
{
  "detail": "Error message"
}
```

Status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Error
- `429`: Rate Limited
- `500`: Server Error

## Deployment

### Environment

- **Development**: Local with Docker Compose
- **Production**: Deploy anywhere that supports Docker containers

### Configuration

Environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key (min 32 chars)
- `CORS_ORIGINS`: Comma-separated allowed origins
- `ENVIRONMENT`: `development` | `production` | `testing`
- `APP_NAME`: Application name (default: "Simple Invites")
- `ADMIN_REGISTRATION_TOKEN`: Optional registration token
- `SMTP_EMAIL`: Gmail address for sending emails (optional)
- `SMTP_APP_PASSWORD`: Gmail app password for SMTP (optional)
- `SMTP_FROM_NAME`: Sender name for emails (defaults to APP_NAME)

## Design Decisions

### Why Circular Foreign Key?

The Event-Survey relationship is circular to support:
1. Creating events with new surveys (survey created first)
2. Linking events to existing surveys
3. Survey reusability

See `backend/docs/DATA_MODEL.md` for detailed explanation.

### Why localStorage for Tokens?

- Simplicity: No backend changes needed
- Works with current JWT implementation
- XSS protection via React escaping and CSP headers

Future consideration: httpOnly cookies (requires CSRF protection).

### Why In-Memory Rate Limiting?

- Simple implementation
- Sufficient for low-traffic applications

Future consideration: Redis for multi-instance deployments.

### Why JSON Columns?

- Flexibility: Different question types need different structures
- PostgreSQL JSONB: Efficient querying and indexing
- Type safety: Validated at application layer (Pydantic)

### Why Configurable Branding?

- Allows the same codebase to be deployed with different branding
- Supports both personal and community use cases
- Environment variable configuration for easy customization

## Testing Strategy

### Backend Tests
- Unit tests: `tests/test_auth.py`, `tests/test_events.py`
- Migration tests: `tests/test_migrations.py`
- Test database: In-memory SQLite

### Frontend Tests
- Component tests: (To be added)
- Integration tests: (To be added)

## Monitoring & Logging

### Logging
- Structured JSON logging in production
- Request ID tracking
- Security event logging

### Health Checks
- `/health` endpoint with database connectivity check
- Returns 503 if database unavailable

## Future Considerations

1. **Multi-instance Support**:
   - Redis for distributed rate limiting
   - Session storage for multi-instance deployments

2. **Enhanced Security**:
   - httpOnly cookies for token storage
   - CSRF protection
   - API versioning

3. **Performance**:
   - Database query optimization
   - Caching layer
   - CDN for static assets

4. **Features**:
   - ✅ Email notifications (implemented via Gmail SMTP)
   - ✅ Passwordless RSVP editing (implemented via edit tokens)
   - ✅ Public guest list display (implemented via show_rsvp_list flag)
   - ✅ Configurable branding (implemented via APP_NAME)
   - Calendar integration
   - Export functionality
