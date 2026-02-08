"""Input sanitization utilities for user-generated content

Note: React automatically escapes JSX content, providing XSS protection.
This module provides additional sanitization utilities for defense-in-depth
and for any future use cases where content might be displayed outside React.
"""

import html
from typing import Any


def sanitize_text(text: str) -> str:
    """
    Sanitize text input by escaping HTML entities.

    This prevents XSS attacks if the text is later displayed as HTML.
    React automatically escapes JSX content, but this provides an extra
    layer of protection and is a security best practice.

    Args:
        text: Input text to sanitize

    Returns:
        Sanitized text with HTML entities escaped
    """
    if not isinstance(text, str):
        return str(text)

    # Escape HTML entities
    sanitized = html.escape(text)

    # Remove any null bytes (potential security issue)
    sanitized = sanitized.replace("\x00", "")

    return sanitized


def sanitize_user_input(value: Any) -> Any:
    """
    Recursively sanitize user input (handles strings, lists, dicts).

    This is used for survey answers and comments that might be displayed.
    Note: React automatically escapes JSX, so this is defense-in-depth.

    Args:
        value: Input value (string, list, dict, etc.)

    Returns:
        Sanitized value with all strings escaped
    """
    if isinstance(value, str):
        return sanitize_text(value)
    elif isinstance(value, list):
        return [sanitize_user_input(item) for item in value]
    elif isinstance(value, dict):
        return {k: sanitize_user_input(v) for k, v in value.items()}
    else:
        # For other types (int, bool, None), return as-is
        return value
