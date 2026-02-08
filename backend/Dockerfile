FROM python:3.11-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies directly
RUN uv pip install --system \
    fastapi \
    uvicorn[standard] \
    sqlalchemy \
    alembic \
    pydantic \
    pydantic-settings \
    passlib[bcrypt] \
    python-jose[cryptography] \
    psycopg2-binary \
    python-dotenv \
    email-validator \
    aiosmtplib

# Copy application code
COPY . .

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Create entrypoint script
RUN echo '#!/bin/sh\nuvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Run the application
ENTRYPOINT ["/entrypoint.sh"]


