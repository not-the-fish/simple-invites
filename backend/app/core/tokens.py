import secrets
from collections.abc import Callable
from typing import TypeVar

from sqlalchemy.orm import Session

T = TypeVar("T")


def generate_invitation_token() -> str:
    """Generate a secure, random invitation token"""
    return secrets.token_urlsafe(32)


def generate_survey_token() -> str:
    """Generate a secure, random survey token"""
    return secrets.token_urlsafe(32)


def generate_unique_token(
    db: Session,
    token_generator: Callable[[], str],
    token_checker: Callable[[Session, str], bool],
    max_attempts: int = 100,
) -> str:
    """
    Generate a unique token by checking against the database.

    Args:
        db: Database session
        token_generator: Function that generates a new token
        token_checker: Function that checks if token exists (db, token) -> bool
        max_attempts: Maximum number of attempts to generate unique token

    Returns:
        A unique token that doesn't exist in the database

    Raises:
        RuntimeError: If unable to generate unique token after max_attempts
    """
    for _ in range(max_attempts):
        token = token_generator()
        if not token_checker(db, token):
            return token

    raise RuntimeError(f"Failed to generate unique token after {max_attempts} attempts")
