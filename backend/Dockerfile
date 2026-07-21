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

# Entrypoint execs the container command, so an overriding `command:`
# (e.g. docker-compose's dev command with --reload) is honored instead of
# being silently ignored.
RUN printf '#!/bin/sh\nexec "$@"\n' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# Default command. Shell form so ${PORT:-8080} expands at runtime
# (Cloud Run injects PORT; falls back to 8080 to match EXPOSE above).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}


