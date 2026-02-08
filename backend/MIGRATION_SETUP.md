# Database Migration Setup

## Initial Setup

After installing dependencies with `uv pip install -e .`, create the initial migration:

```bash
cd backend
alembic revision --autogenerate -m "Initial migration: create all tables"
```

This will create a migration file in `alembic/versions/` that includes all the models:
- Admin
- Event
- RSVP
- Survey
- SurveyResponse
- CodeOfConduct

## Apply Migrations

To apply migrations to your database:

```bash
alembic upgrade head
```

## Create New Migrations

After making changes to models:

```bash
alembic revision --autogenerate -m "Description of changes"
alembic upgrade head
```

## Rollback

To rollback the last migration:

```bash
alembic downgrade -1
```


