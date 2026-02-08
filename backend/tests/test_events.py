"""Tests for event creation"""

from datetime import UTC, datetime

from fastapi import status


def test_create_event_with_existing_survey(client, admin_token, db):
    """Test creating an event linked to an existing survey"""
    from app.core.tokens import generate_survey_token
    from app.models.survey import Survey

    # Create a survey first
    survey = Survey(
        title="Test Survey", description="Test description", survey_token=generate_survey_token()
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)

    # Create event linked to survey
    event_data = {
        "title": "Test Event",
        "description": "Test event description",
        "date": datetime.now(UTC).isoformat(),
        "location": "Test Location",
        "survey_id": survey.id,
    }

    response = client.post(
        "/api/admin/events", json=event_data, headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Test Event"
    assert data["survey_id"] == survey.id
    assert "invitation_token" in data


def test_create_event_with_new_survey(client, admin_token):
    """Test creating an event with a new survey and questions"""
    event_data = {
        "title": "Test Event",
        "description": "Test event description",
        "date": datetime.now(UTC).isoformat(),
        "location": "Test Location",
        "survey_questions": [
            {
                "question_type": "text",
                "question_text": "What's your name?",
                "required": True,
                "order": 1,
            }
        ],
    }

    response = client.post(
        "/api/admin/events", json=event_data, headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Test Event"
    assert "survey_id" in data
    assert "invitation_token" in data


def test_create_event_with_default_survey(client, admin_token):
    """Test creating an event with default empty survey"""
    event_data = {
        "title": "Test Event",
        "description": "Test event description",
        "date": datetime.now(UTC).isoformat(),
        "location": "Test Location",
    }

    response = client.post(
        "/api/admin/events", json=event_data, headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Test Event"
    assert "survey_id" in data


def test_create_event_invalid_survey_id(client, admin_token):
    """Test creating an event with non-existent survey_id"""
    event_data = {
        "title": "Test Event",
        "description": "Test event description",
        "date": datetime.now(UTC).isoformat(),
        "location": "Test Location",
        "survey_id": 99999,  # Non-existent
    }

    response = client.post(
        "/api/admin/events", json=event_data, headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_create_event_unauthorized(client):
    """Test creating an event without authentication"""
    event_data = {
        "title": "Test Event",
        "description": "Test event description",
        "date": datetime.now(UTC).isoformat(),
        "location": "Test Location",
    }

    response = client.post("/api/admin/events", json=event_data)
    # HTTPBearer returns 401 when no token is provided
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
