"""Serve SPA index.html with per-event Open Graph meta for /rsvp/{token}."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_access_code
from app.database import get_db
from app.models.event import Event
from app.services.spa_meta import (
    build_og_description,
    get_spa_shell,
    inject_meta,
    public_rsvp_url,
)

router = APIRouter(tags=["rsvp-page"])


@router.get("/rsvp/{invitation_token}", response_class=HTMLResponse)
async def rsvp_page(
    invitation_token: str,
    code: str | None = Query(None, description="Access code from shareable invite URL"),
    access_code: str | None = Query(None, description="Access code (API-style query param)"),
    db: Session = Depends(get_db),
):
    """
    Return the SPA shell with event-specific title and Open Graph tags.

    Used by messaging link previews and by browsers (via nginx proxy).
    Access-code-protected events without a valid code get generic meta only.
    """
    shell = get_spa_shell()
    og_url = public_rsvp_url(invitation_token)
    effective_code = access_code or code

    event = db.query(Event).filter(Event.invitation_token == invitation_token).first()

    if not event:
        html = inject_meta(
            shell,
            title=settings.APP_NAME,
            description="This invitation link is invalid or has expired.",
            url=og_url,
        )
        return HTMLResponse(content=html, status_code=404)

    if event.access_code:
        if not effective_code or not verify_access_code(effective_code, str(event.access_code)):
            html = inject_meta(
                shell,
                title="You're invited",
                description=f"Open this link to view the invitation on {settings.APP_NAME}.",
                url=og_url,
            )
            return HTMLResponse(content=html, status_code=200)

    title = str(event.title)
    description = build_og_description(
        event.date,
        str(event.location) if event.location else None,
    )
    html = inject_meta(shell, title=title, description=description, url=og_url)
    return HTMLResponse(content=html, status_code=200)
