"""Inject Open Graph / title meta tags into the SPA index.html shell."""

from __future__ import annotations

import html
import logging
import re
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings

logger = logging.getLogger(__name__)

_spa_shell_cache: str | None = None

_MINIMAL_SHELL = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Simple Invites</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
"""


def clear_spa_shell_cache() -> None:
    """Clear cached SPA shell (for tests)."""
    global _spa_shell_cache
    _spa_shell_cache = None


def get_spa_shell() -> str:
    """Load the Vite-built index.html from disk or URL, with in-memory cache.

    Successful loads are cached. Failures are not cached so a temporary
    startup race (frontend not ready yet) can recover on the next request.
    """
    global _spa_shell_cache
    if _spa_shell_cache is not None:
        return _spa_shell_cache

    if settings.SPA_INDEX_HTML:
        path = Path(settings.SPA_INDEX_HTML)
        if path.is_file():
            _spa_shell_cache = path.read_text(encoding="utf-8")
            return _spa_shell_cache
        logger.warning("SPA_INDEX_HTML not found at %s", path)

    if settings.SPA_INDEX_URL:
        try:
            with urllib.request.urlopen(settings.SPA_INDEX_URL, timeout=5) as resp:
                _spa_shell_cache = resp.read().decode("utf-8")
                return _spa_shell_cache
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            logger.warning("Failed to fetch SPA_INDEX_URL %s: %s", settings.SPA_INDEX_URL, exc)

    logger.warning("Using minimal SPA shell; set SPA_INDEX_HTML or SPA_INDEX_URL for full asset tags")
    return _MINIMAL_SHELL


def format_event_datetime(dt: datetime, tz_name: str | None = None) -> str:
    """Format an event datetime for link-preview descriptions."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)

    zone_name = tz_name or settings.APP_TIMEZONE
    try:
        tz = ZoneInfo(zone_name)
    except ZoneInfoNotFoundError:
        logger.warning("Invalid APP_TIMEZONE %s; falling back to UTC", zone_name)
        tz = ZoneInfo("UTC")

    local = dt.astimezone(tz)
    hour12 = local.hour % 12 or 12
    ampm = "AM" if local.hour < 12 else "PM"
    tz_abbr = local.tzname() or zone_name
    return (
        f"{local.strftime('%A, %B')} {local.day}, {local.year} "
        f"at {hour12}:{local.minute:02d} {ampm} {tz_abbr}"
    )


def build_og_description(event_date: datetime, location: str | None) -> str:
    """Build og:description from date/time and optional location."""
    parts = [format_event_datetime(event_date)]
    if location:
        parts.append(location)
    return " · ".join(parts)


def inject_meta(shell: str, *, title: str, description: str, url: str) -> str:
    """Replace title and insert Open Graph tags into an HTML shell."""
    esc_title = html.escape(title, quote=False)
    esc_title_attr = html.escape(title, quote=True)
    esc_desc = html.escape(description, quote=True)
    esc_url = html.escape(url, quote=True)

    meta_block = (
        f"<title>{esc_title}</title>\n"
        f'    <meta property="og:title" content="{esc_title_attr}" />\n'
        f'    <meta property="og:description" content="{esc_desc}" />\n'
        f'    <meta property="og:url" content="{esc_url}" />\n'
        f'    <meta property="og:type" content="website" />\n'
        f'    <meta name="twitter:card" content="summary" />\n'
        f'    <meta name="description" content="{esc_desc}" />\n'
    )

    result = re.sub(r"<title>[^<]*</title>\s*", "", shell, count=1, flags=re.IGNORECASE)
    if re.search(r"</head>", result, flags=re.IGNORECASE):
        result = re.sub(
            r"</head>",
            f"    {meta_block}  </head>",
            result,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        result = meta_block + result
    return result


def public_rsvp_url(invitation_token: str) -> str:
    """Canonical public RSVP URL for og:url."""
    base = settings.PUBLIC_APP_URL.rstrip("/")
    return f"{base}/rsvp/{invitation_token}"
