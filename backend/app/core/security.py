import base64
import secrets
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings
from app.core.constants import (
    BCRYPT_MAX_PASSWORD_BYTES,
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Bcrypt hashes are stored as base64-encoded strings for safe storage
        # Decode from base64 to get the original bytes
        hashed_bytes = base64.b64decode(hashed_password.encode("utf-8"))
        result = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_bytes)
        if not result:
            logger.debug(
                "Password verification failed: base64 decode succeeded but checkpw returned False"
            )
        return result
    except Exception as e:
        # If base64 decode fails, try UTF-8 encoding (for backward compatibility with existing hashes)
        logger.debug(f"Base64 decode failed, trying UTF-8: {type(e).__name__}: {e}")
        try:
            result = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
            if not result:
                logger.debug(
                    "Password verification failed: UTF-8 decode succeeded but checkpw returned False"
                )
            return result
        except Exception as e2:
            logger.warning(
                f"Password verification failed with both methods: base64={type(e).__name__}, utf8={type(e2).__name__}"
            )
            return False


def get_password_hash(password: str) -> str:
    """Hash a password"""
    # Ensure password is bytes and truncate if necessary (bcrypt limit is 72 bytes)
    password_bytes = password.encode("utf-8")[:BCRYPT_MAX_PASSWORD_BYTES]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Encode the binary hash as base64 for safe string storage
    return base64.b64encode(hashed).decode("utf-8")


def get_access_code_hash(access_code: str) -> str:
    """Hash an access code using bcrypt (same approach as passwords)"""
    # Access codes are typically shorter, but still respect bcrypt limit
    access_code_bytes = access_code.encode("utf-8")[:BCRYPT_MAX_PASSWORD_BYTES]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(access_code_bytes, salt)
    # Encode the binary hash as base64 for safe string storage
    return base64.b64encode(hashed).decode("utf-8")


def verify_access_code(plain_access_code: str, stored_hash: str) -> bool:
    """Verify an access code against a stored hash.

    Supports both hashed (new) and plain text (legacy) access codes for backward compatibility.
    """
    if not plain_access_code or not stored_hash:
        return False

    # Try to verify as bcrypt hash (base64 encoded)
    try:
        hashed_bytes = base64.b64decode(stored_hash.encode("utf-8"))
        result = bcrypt.checkpw(plain_access_code.encode("utf-8"), hashed_bytes)
        if result:
            return True
    except Exception:
        # Not a valid base64 bcrypt hash, might be legacy plain text
        pass

    # Backward compatibility: check if stored value is plain text
    # Use constant-time comparison to prevent timing attacks
    return secrets.compare_digest(plain_access_code, stored_hash)


def generate_edit_token() -> str:
    """Generate a cryptographically secure edit token for RSVP editing.

    Returns a 32-byte URL-safe token (256 bits of entropy).
    """
    return secrets.token_urlsafe(32)


def get_edit_token_hash(edit_token: str) -> str:
    """Hash an edit token using bcrypt for secure storage."""
    token_bytes = edit_token.encode("utf-8")[:BCRYPT_MAX_PASSWORD_BYTES]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(token_bytes, salt)
    return base64.b64encode(hashed).decode("utf-8")


def verify_edit_token(plain_token: str, stored_hash: str) -> bool:
    """Verify an edit token against a stored hash."""
    if not plain_token or not stored_hash:
        return False

    try:
        hashed_bytes = base64.b64decode(stored_hash.encode("utf-8"))
        return bcrypt.checkpw(plain_token.encode("utf-8"), hashed_bytes)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    # Convert sub to string if it exists (JWT spec requires string)
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    # jwt.encode returns str, but type stubs may say Any - cast to ensure type safety
    return str(encoded_jwt)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and verify a JWT access token"""
    try:
        payload: dict[str, Any] = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


# Rate limiting implementation
class RateLimiter:
    """Simple in-memory rate limiter for API endpoints"""

    def __init__(self):
        self.requests = defaultdict(list)  # client_ip -> list of timestamps
        self.max_requests = RATE_LIMIT_MAX_REQUESTS
        self.window_seconds = RATE_LIMIT_WINDOW_SECONDS

    def is_allowed(self, client_ip: str) -> bool:
        """Check if request from client_ip is allowed"""
        now = time.time()
        client_requests = self.requests[client_ip]

        # Remove old requests outside the window
        client_requests[:] = [
            req_time for req_time in client_requests if now - req_time < self.window_seconds
        ]

        # Check if under limit
        if len(client_requests) >= self.max_requests:
            return False

        # Add current request
        client_requests.append(now)
        return True

    def get_remaining_requests(self, client_ip: str) -> int:
        """Get remaining requests for client_ip"""
        client_requests = self.requests[client_ip]
        return max(0, self.max_requests - len(client_requests))

    def get_reset_time(self, client_ip: str) -> int:
        """Get time until rate limit resets (seconds)"""
        client_requests = self.requests[client_ip]
        if not client_requests:
            return 0
        return max(0, int(self.window_seconds - (time.time() - min(client_requests))))


# CSRF protection
def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token"""
    return secrets.token_urlsafe(32)


def verify_csrf_token(session_token: str, submitted_token: str) -> bool:
    """Verify CSRF token matches"""
    if not session_token or not submitted_token:
        return False
    return secrets.compare_digest(session_token, submitted_token)


# Global rate limiter instance
rate_limiter = RateLimiter()


class LoginRateLimiter:
    """Stricter rate limiter for login endpoints to prevent brute force attacks"""

    def __init__(self):
        self.requests = defaultdict(list)  # client_ip -> list of timestamps
        self.max_requests = LOGIN_RATE_LIMIT_MAX_ATTEMPTS
        self.window_seconds = LOGIN_RATE_LIMIT_WINDOW_SECONDS

    def is_allowed(self, client_ip: str) -> bool:
        """Check if login attempt from client_ip is allowed"""
        now = time.time()
        client_requests = self.requests[client_ip]

        # Remove old requests outside the window
        client_requests[:] = [
            req_time for req_time in client_requests if now - req_time < self.window_seconds
        ]

        # Check if under limit
        if len(client_requests) >= self.max_requests:
            return False

        # Add current request
        client_requests.append(now)
        return True

    def get_remaining_attempts(self, client_ip: str) -> int:
        """Get remaining login attempts for client_ip"""
        client_requests = self.requests[client_ip]
        return max(0, self.max_requests - len(client_requests))

    def get_reset_time(self, client_ip: str) -> int:
        """Get time until rate limit resets (seconds)"""
        client_requests = self.requests[client_ip]
        if not client_requests:
            return 0
        return max(0, int(self.window_seconds - (time.time() - min(client_requests))))


# Global login rate limiter instance
login_rate_limiter = LoginRateLimiter()
