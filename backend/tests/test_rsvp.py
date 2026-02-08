"""Tests for RSVP functionality including edit tokens and admin deletion"""

from datetime import UTC, datetime

from fastapi import status


def test_rsvp_returns_edit_token(client, admin_token, db):
    """Test that submitting an RSVP returns an edit token"""
    from app.core.tokens import generate_survey_token
    from app.models.survey import Survey
    from app.models.event import Event
    from app.core.tokens import generate_invitation_token

    # Create survey and event
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
        "email": "guest@example.com",
    }

    response = client.post(f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "edit_token" in data
    assert len(data["edit_token"]) > 20  # Should be a long secure token
    assert data["identity"] == "Test Guest"
    assert data["response"] == "yes"


def test_get_rsvp_with_edit_token(client, admin_token, db):
    """Test retrieving an RSVP using the edit token"""
    from app.core.tokens import generate_survey_token, generate_invitation_token
    from app.models.survey import Survey
    from app.models.event import Event

    # Create survey and event
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
    }

    submit_response = client.post(
        f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data
    )
    assert submit_response.status_code == status.HTTP_201_CREATED
    edit_token = submit_response.json()["edit_token"]

    # Retrieve RSVP using edit token
    get_response = client.get(
        f"/api/events/{event.invitation_token}/my-rsvp",
        params={"edit_token": edit_token},
    )

    assert get_response.status_code == status.HTTP_200_OK
    data = get_response.json()
    assert data["identity"] == "Test Guest"
    assert data["response"] == "yes"
    assert data["num_attendees"] == 2


def test_update_rsvp_with_edit_token(client, admin_token, db):
    """Test updating an RSVP using the edit token"""
    from app.core.tokens import generate_survey_token, generate_invitation_token
    from app.models.survey import Survey
    from app.models.event import Event

    # Create survey and event
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
    }

    submit_response = client.post(
        f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data
    )
    assert submit_response.status_code == status.HTTP_201_CREATED
    edit_token = submit_response.json()["edit_token"]

    # Update RSVP
    update_data = {
        "identity": "Updated Guest",
        "response": "maybe",
        "num_attendees": 3,
    }

    update_response = client.put(
        f"/api/events/{event.invitation_token}/rsvp",
        json=update_data,
        params={"edit_token": edit_token},
    )

    assert update_response.status_code == status.HTTP_200_OK
    data = update_response.json()
    assert data["identity"] == "Updated Guest"
    assert data["response"] == "maybe"
    assert data["num_attendees"] == 3


def test_invalid_edit_token_rejected(client, admin_token, db):
    """Test that invalid edit tokens are rejected"""
    from app.core.tokens import generate_survey_token, generate_invitation_token
    from app.models.survey import Survey
    from app.models.event import Event

    # Create survey and event
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
    }

    submit_response = client.post(
        f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data
    )
    assert submit_response.status_code == status.HTTP_201_CREATED

    # Try to get RSVP with invalid token
    get_response = client.get(
        f"/api/events/{event.invitation_token}/my-rsvp",
        params={"edit_token": "invalid-token-here"},
    )

    assert get_response.status_code == status.HTTP_404_NOT_FOUND


def test_admin_delete_rsvp(client, admin_token, db):
    """Test that admins can delete RSVPs"""
    from app.core.tokens import generate_survey_token, generate_invitation_token
    from app.models.survey import Survey
    from app.models.event import Event

    # Create survey and event
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
    }

    submit_response = client.post(
        f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data
    )
    assert submit_response.status_code == status.HTTP_201_CREATED
    rsvp_id = submit_response.json()["id"]

    # Verify RSVP exists
    list_response = client.get(
        f"/api/admin/events/{event.id}/rsvps",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_response.status_code == status.HTTP_200_OK
    assert len(list_response.json()) == 1

    # Delete RSVP as admin
    delete_response = client.delete(
        f"/api/admin/events/{event.id}/rsvps/{rsvp_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    # Verify RSVP is gone
    list_response2 = client.get(
        f"/api/admin/events/{event.id}/rsvps",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_response2.status_code == status.HTTP_200_OK
    assert len(list_response2.json()) == 0


def test_admin_delete_rsvp_requires_auth(client, db):
    """Test that deleting RSVPs requires admin authentication"""
    response = client.delete("/api/admin/events/1/rsvps/1")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_show_rsvp_list_in_stats(client, admin_token, db):
    """Test that show_rsvp_list flag includes attendee names in stats"""
    from app.core.tokens import generate_survey_token, generate_invitation_token
    from app.models.survey import Survey
    from app.models.event import Event

    # Create survey and event with show_rsvp_list enabled
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
        show_rsvp_list=True,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
    }

    submit_response = client.post(
        f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data
    )
    assert submit_response.status_code == status.HTTP_201_CREATED

    # Get stats
    stats_response = client.get(f"/api/events/{event.invitation_token}/stats")
    assert stats_response.status_code == status.HTTP_200_OK
    data = stats_response.json()

    assert data["show_rsvp_list"] is True
    assert "attendees" in data
    assert len(data["attendees"]["yes"]) == 1
    assert data["attendees"]["yes"][0]["name"] == "Test Guest"
    assert data["attendees"]["yes"][0]["num_attendees"] == 2


def test_show_rsvp_list_disabled_hides_names(client, admin_token, db):
    """Test that show_rsvp_list=False hides attendee names from stats"""
    from app.core.tokens import generate_survey_token, generate_invitation_token
    from app.models.survey import Survey
    from app.models.event import Event

    # Create survey and event with show_rsvp_list disabled
    survey = Survey(
        title="Test Survey",
        description="Test description",
        survey_token=generate_survey_token(),
    )
    db.add(survey)
    db.flush()

    event = Event(
        title="Test Event",
        description="Test description",
        date=datetime.now(UTC),
        location="Test Location",
        invitation_token=generate_invitation_token(),
        survey_id=survey.id,
        created_by=1,
        show_rsvp_list=False,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Submit RSVP
    rsvp_data = {
        "identity": "Test Guest",
        "response": "yes",
        "num_attendees": 2,
    }

    submit_response = client.post(
        f"/api/events/{event.invitation_token}/rsvp", json=rsvp_data
    )
    assert submit_response.status_code == status.HTTP_201_CREATED

    # Get stats
    stats_response = client.get(f"/api/events/{event.invitation_token}/stats")
    assert stats_response.status_code == status.HTTP_200_OK
    data = stats_response.json()

    assert data["show_rsvp_list"] is False
    assert "attendees" not in data
