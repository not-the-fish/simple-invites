import json
import logging
import re
import time
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.api import admin, admin_events, admin_surveys, events, surveys
from app.core.config import settings
from app.core.constants import MAX_REQUEST_SIZE_BYTES
from app.core.security import rate_limiter
from app.database import get_db


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add request ID if available
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id

        # Add extra fields from record
        if hasattr(record, "extra_fields"):
            log_data.update(record.extra_fields)

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def setup_logging() -> None:
    """Configure structured logging"""
    log_level = logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG

    # Create formatter
    if settings.ENVIRONMENT == "production":
        formatter = StructuredFormatter()
    else:
        # Use standard format for development
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    # Configure root logger
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(handler)

    # Prevent duplicate logs
    root_logger.propagate = False


# Setup logging on module import
setup_logging()

logger = logging.getLogger(__name__)

app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description=f"""
    API for {settings.APP_NAME} - an event RSVP and survey platform.

    ## Features

    - **Event Management**: Create and manage events with RSVP functionality
    - **Survey System**: Flexible survey system with multiple question types
    - **Admin Authentication**: JWT-based admin authentication
    - **Access Control**: Optional access codes for protected events

    ## Authentication

    Most endpoints require authentication via JWT token. Include the token in the Authorization header:

    ```
    Authorization: Bearer <your-token>
    ```

    Get a token by logging in at `/api/admin/login`.

    ## Error Responses

    All errors follow a consistent format:

    ```json
    {{
      "detail": "Error message describing what went wrong"
    }}
    ```

    Common HTTP status codes:
    - `200`: Success
    - `201`: Created
    - `400`: Bad Request (validation error)
    - `401`: Unauthorized (missing or invalid token)
    - `403`: Forbidden (insufficient permissions or invalid access code)
    - `404`: Not Found
    - `422`: Unprocessable Entity (validation error)
    - `429`: Too Many Requests (rate limited)
    - `500`: Internal Server Error

    ## Rate Limiting

    Public endpoints are rate-limited to 100 requests per 15 minutes per IP.
    Admin login is limited to 5 attempts per 15 minutes per IP.

    ## Request Size Limits

    Request bodies are limited to 1MB to prevent DoS attacks.
    """,
    version="0.1.0",
    contact={
        "name": settings.APP_NAME,
    },
    license_info={
        "name": "MIT",
    },
)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request ID for request tracking"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Add request ID to logger context
        old_factory = logging.getLogRecordFactory()

        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.request_id = request_id
            return record

        logging.setLogRecordFactory(record_factory)

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            # Restore original factory
            logging.setLogRecordFactory(old_factory)


class DateTimeFixMiddleware(BaseHTTPMiddleware):
    """Middleware to ensure datetime strings in JSON responses have 'Z' suffix (UTC indicator)"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
        except Exception:
            # If the request itself fails, re-raise the exception
            raise

        # Only process JSON responses with actual content
        try:
            content_type = response.headers.get("content-type", "")
            status_code = response.status_code

            # Skip 204 No Content and other responses without body
            if status_code == 204 or status_code == 304:
                return response

            if "application/json" in content_type:
                # Read response body
                body = b""
                try:
                    async for chunk in response.body_iterator:
                        body += chunk
                except Exception:
                    # If reading body fails, return original response
                    return response

                # Skip empty bodies
                if not body:
                    return response

                # Parse JSON and fix datetime strings
                try:
                    data = json.loads(body.decode("utf-8"))
                    # Recursively fix datetime strings
                    fixed_data = self._fix_datetime_strings(data)
                    # Re-encode JSON
                    fixed_body = json.dumps(fixed_data, default=str).encode("utf-8")

                    # Create new response with fixed body
                    return Response(
                        content=fixed_body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type="application/json",
                    )
                except (json.JSONDecodeError, UnicodeDecodeError, ValueError, TypeError):
                    # If JSON parsing fails, return original response
                    return Response(
                        content=body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=content_type,
                    )
        except Exception:
            # If anything goes wrong in the middleware, return the original response
            # This prevents the middleware from breaking the application
            return response

        return response

    def _fix_datetime_strings(self, obj):
        """Recursively fix datetime strings to include 'Z' suffix if missing"""
        if isinstance(obj, dict):
            return {k: self._fix_datetime_strings(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._fix_datetime_strings(item) for item in obj]
        elif isinstance(obj, str):
            # Match ISO datetime format without timezone (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM:SS.mmm)
            # and add 'Z' if it doesn't already have a timezone indicator
            if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$", obj):
                return obj + "Z"
        return obj


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for public endpoints"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for admin endpoints and health checks
        if request.url.path.startswith("/api/admin") or request.url.path == "/health":
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"

        # Check rate limit
        if not rate_limiter.is_allowed(client_ip):
            remaining = rate_limiter.get_remaining_requests(client_ip)
            reset_time = rate_limiter.get_reset_time(client_ip)

            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests",
                    "retry_after": reset_time,
                    "remaining_requests": remaining,
                },
                headers={
                    "Retry-After": str(reset_time),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(int(time.time()) + reset_time),
                },
            )

        # Add rate limit headers to successful responses
        response = await call_next(request)
        remaining = rate_limiter.get_remaining_requests(client_ip)
        reset_time = rate_limiter.get_reset_time(client_ip)

        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + reset_time)

        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Limit request body size to prevent DoS attacks"""

    MAX_REQUEST_SIZE = MAX_REQUEST_SIZE_BYTES

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check Content-Length header if present
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > self.MAX_REQUEST_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large. Maximum size is 1MB."},
                    )
            except ValueError:
                # Invalid content-length, let it through (will fail later if actually too large)
                pass

        # For streaming requests, we rely on the server's default limits
        # FastAPI/Starlette will handle this at the ASGI level
        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS for HTTPS (only in production)
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# Add middleware (order matters)
# DateTimeFixMiddleware: Fixes datetime strings to include 'Z' (UTC indicator)
# Temporarily disabled - re-enable after confirming backend stability
# To re-enable: uncomment the line below
# app.add_middleware(DateTimeFixMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)


# Global exception handlers for error sanitization
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with sanitized error messages in production"""
    # Log detailed error for debugging with structured logging
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        f"HTTP {exc.status_code} error on {request.url.path}: {exc.detail}",
        extra={
            "extra_fields": {
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
            },
            "request_id": request_id,
        },
    )

    # In production, sanitize error messages to avoid exposing internals
    if settings.ENVIRONMENT == "production":
        # Generic messages for common error codes
        if exc.status_code == 400:
            detail = "Invalid request"
        elif exc.status_code == 401:
            detail = "Authentication required"
        elif exc.status_code == 403:
            detail = "Access denied"
        elif exc.status_code == 404:
            detail = "Resource not found"
        elif exc.status_code == 422:
            detail = "Validation error"
        elif exc.status_code >= 500:
            detail = "Internal server error"
        else:
            # For other status codes, use generic message
            detail = "An error occurred"
    else:
        # In development, show full error details
        detail = exc.detail

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=exc.headers if hasattr(exc, "headers") else None,
    )


@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle Starlette HTTP exceptions"""
    return await http_exception_handler(
        request, HTTPException(status_code=exc.status_code, detail=exc.detail)
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with sanitized messages in production"""
    # Log detailed validation errors
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")

    if settings.ENVIRONMENT == "production":
        # Generic validation error message
        return JSONResponse(
            status_code=422, content={"detail": "Validation error: Invalid input provided"}
        )
    else:
        # In development, show full validation errors
        return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    # Always log full exception details
    logger.exception(f"Unhandled exception on {request.url.path}: {exc}")

    # In production, return generic error
    if settings.ENVIRONMENT == "production":
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    else:
        # In development, show exception details
        return JSONResponse(status_code=500, content={"detail": str(exc)})


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins_list),  # Convert to list for type checking
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include routers
app.include_router(admin.router)
app.include_router(events.router)
app.include_router(admin_events.router)
app.include_router(surveys.router)
app.include_router(admin_surveys.router)


@app.get("/")
async def root():
    return {"message": f"{settings.APP_NAME} API"}


@app.get("/api/config")
async def get_config():
    """Get public application configuration for frontend"""
    return {
        "app_name": settings.APP_NAME,
    }


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    """Health check endpoint with database connectivity check"""
    health_status: dict[str, Any] = {
        "status": "healthy",
        "checks": {"api": "ok", "database": "unknown"},
    }

    # Check database connectivity
    try:
        # Simple query to verify database connection
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "ok"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status["status"] = "degraded"
        health_status["checks"]["database"] = "error"
        health_status["database_error"] = (
            str(e) if settings.ENVIRONMENT != "production" else "Database connection failed"
        )

    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(content=health_status, status_code=status_code)
