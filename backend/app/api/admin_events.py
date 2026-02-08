from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.security import get_access_code_hash
from app.database import get_db
from app.models.admin import Admin
from app.models.event import Event
from app.models.response import QuestionResponse
from app.models.submission import SurveySubmission
from app.models.survey import Survey
from app.schemas.event import EventCreate, EventResponse, EventUpdate
from app.schemas.rsvp import RSVPResponse as RSVPResponseSchema
from app.services.event_service import create_event_with_survey

router = APIRouter(prefix="/api/admin/events", tags=["admin-events"])


@router.get("", response_model=list[EventResponse])
async def list_events(
    current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """List all events (admin only)"""
    events = db.query(Event).order_by(Event.created_at.desc()).all()
    return events


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new event (admin only).

    Events require a survey. Can either:
    - Link to existing survey via survey_id
    - Create new survey atomically via survey_title and survey_questions
    - If neither provided, creates a default empty survey
    """
    event = create_event_with_survey(db, event_data, int(current_admin.id))
    return event


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get event details (admin only)"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update an event (admin only)"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Update fields if provided
    if event_data.title is not None:
        event.title = event_data.title  # type: ignore[assignment]
    if event_data.description is not None:
        event.description = event_data.description  # type: ignore[assignment]
    if event_data.date is not None:
        event.date = event_data.date  # type: ignore[assignment]
    if event_data.location is not None:
        event.location = event_data.location  # type: ignore[assignment]
    if event_data.access_code is not None:
        # Hash access code if provided, or set to None if empty string
        if event_data.access_code:
            event.access_code = get_access_code_hash(event_data.access_code)  # type: ignore[assignment]
        else:
            event.access_code = None  # type: ignore[assignment]
    if event_data.survey_id is not None:
        event.survey_id = event_data.survey_id  # type: ignore[assignment]
    if event_data.show_rsvp_list is not None:
        event.show_rsvp_list = event_data.show_rsvp_list  # type: ignore[assignment]

    db.commit()
    db.refresh(event)

    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Delete an event (admin only)"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    try:
        # Break the circular foreign key relationship
        # First, set the survey's event_id to None (if it exists)
        if event.survey_id:
            survey = db.query(Survey).filter(Survey.id == event.survey_id).first()
            if survey:
                survey.event_id = None

        # Now delete the event
        db.delete(event)
        db.commit()
    except Exception:
        db.rollback()
        # Let global exception handler sanitize the error message
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete event"
        ) from None

    return None


@router.get("/{event_id}/rsvps", response_model=list[RSVPResponseSchema])
async def get_event_rsvps(
    event_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get all RSVPs for an event (admin only) - returns SurveySubmissions with RSVP fields"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Get all submissions for the event's survey that have RSVP fields
    submissions = (
        db.query(SurveySubmission)
        .filter(
            SurveySubmission.survey_id == event.survey_id,
            SurveySubmission.rsvp_response.isnot(None),  # Only submissions with RSVP responses
        )
        .order_by(SurveySubmission.submitted_at.desc())
        .all()
    )

    # Convert to RSVPResponse format
    return [
        RSVPResponseSchema(
            id=sub.id,
            survey_id=sub.survey_id,
            identity=sub.identity or "",
            response=sub.rsvp_response,
            num_attendees=sub.num_attendees,
            email=sub.email,
            phone=sub.phone,
            comment=sub.comment,
            submitted_at=sub.submitted_at,
        )
        for sub in submissions
        if sub.rsvp_response is not None
    ]


@router.delete("/{event_id}/rsvps/{rsvp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rsvp(
    event_id: int,
    rsvp_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete an RSVP (admin only)"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Find the submission
    submission = (
        db.query(SurveySubmission)
        .filter(
            SurveySubmission.id == rsvp_id,
            SurveySubmission.survey_id == event.survey_id,
        )
        .first()
    )

    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RSVP not found")

    # Delete associated question responses first
    db.query(QuestionResponse).filter(QuestionResponse.submission_id == rsvp_id).delete()

    # Delete the submission
    db.delete(submission)
    db.commit()

    return None
