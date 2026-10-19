"""Tests for /rsvp/{token} Open Graph HTML injection."""

from datetime import UTC, datetime
from pathlib import Path

from app.core.security import get_access_code_hash
from app.core.tokens import generate_invitation_token, generate_survey_token
from app.models.event import Event
from app.models.survey import Survey
from app.services.spa_meta import clear_spa_shell_cache


SHELL = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Simple Invites</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc123.js"></script>
  </body>
</html>
"""


def _create_event(db, *, title="Craft Night", access_code=None, location="Studio"):
    survey = Survey(
        title="RSVP Survey",
        description="Test",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title=title,
        description="Bring yarn",
        date=datetime(2026, 1, 4, 23, 0, 0, tzinfo=UTC),
        location=location,
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        access_code=get_access_code_hash(access_code) if access_code else None,
        created_by=1,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def test_rsvp_page_injects_event_meta(client, db, tmp_path, monkeypatch):
    shell_path = tmp_path / "index.html"
    shell_path.write_text(SHELL, encoding="utf-8")
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_HTML", str(shell_path))
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_URL", None)
    monkeypatch.setattr("app.services.spa_meta.settings.APP_TIMEZONE", "UTC")
    monkeypatch.setattr(
        "app.services.spa_meta.settings.PUBLIC_APP_URL", "https://app.example.com"
    )
    clear_spa_shell_cache()

    event = _create_event(db)

    response = client.get(f"/rsvp/{event.invitation_token}")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    html = response.text
    assert "<title>Craft Night</title>" in html
    assert 'property="og:title" content="Craft Night"' in html
    assert "Sunday, January 4, 2026" in html
    assert "11:00 PM" in html
    assert "Studio" in html
    assert f'property="og:url" content="https://app.example.com/rsvp/{event.invitation_token}"' in html
    assert 'name="twitter:card" content="summary"' in html
    assert 'src="/assets/index-abc123.js"' in html
    assert "<title>Simple Invites</title>" not in html


def test_rsvp_page_hides_title_without_access_code(client, db, tmp_path, monkeypatch):
    shell_path = tmp_path / "index.html"
    shell_path.write_text(SHELL, encoding="utf-8")
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_HTML", str(shell_path))
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_URL", None)
    clear_spa_shell_cache()

    event = _create_event(db, title="Secret Party", access_code="hunter2")

    response = client.get(f"/rsvp/{event.invitation_token}")

    assert response.status_code == 200
    html = response.text
    assert "Secret Party" not in html
    assert "You're invited" in html
    assert 'src="/assets/index-abc123.js"' in html


def test_rsvp_page_shows_event_with_valid_code_query(client, db, tmp_path, monkeypatch):
    shell_path = Path(tmp_path) / "index.html"
    shell_path.write_text(SHELL, encoding="utf-8")
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_HTML", str(shell_path))
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_URL", None)
    clear_spa_shell_cache()

    event = _create_event(db, title="Secret Party", access_code="hunter2")

    response = client.get(f"/rsvp/{event.invitation_token}?code=hunter2")

    assert response.status_code == 200
    assert "<title>Secret Party</title>" in response.text


def test_rsvp_page_not_found_keeps_spa_shell(client, tmp_path, monkeypatch):
    shell_path = tmp_path / "index.html"
    shell_path.write_text(SHELL, encoding="utf-8")
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_HTML", str(shell_path))
    monkeypatch.setattr("app.services.spa_meta.settings.SPA_INDEX_URL", None)
    clear_spa_shell_cache()

    response = client.get("/rsvp/does-not-exist-token")

    assert response.status_code == 404
    assert 'src="/assets/index-abc123.js"' in response.text
    assert "invalid or has expired" in response.text
