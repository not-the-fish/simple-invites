"""Event service layer - business logic for event operations"""

import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_access_code_hash
from app.core.tokens import (
    generate_invitation_token,
    generate_survey_token,
    generate_unique_token,
)
from app.models.event import Event
from app.models.question import Question
from app.models.survey import Survey
from app.schemas.event import EventCreate

logger = logging.getLogger(__name__)


def create_event_with_survey(db: Session, event_data: EventCreate, admin_id: int) -> Event:
    """
    Create an event with its associated survey.

    Events require a survey. Can either:
    - Link to existing survey via survey_id
    - Create new survey atomically via survey_questions
    - If neither provided, creates a default empty survey

    Args:
        db: Database session
        event_data: Event creation data
        admin_id: ID of admin creating the event

    Returns:
        Created Event object

    Raises:
        HTTPException: If validation fails or creation fails
    """
    # Validate: can't use both survey_id and create new survey
    if event_data.survey_id is not None and (
        event_data.survey_description or len(event_data.survey_questions) > 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot specify both survey_id and survey creation fields. Use either survey_id to link existing survey, or survey_description/survey_questions to create new survey.",
        )

    # Generate unique invitation token
    invitation_token = generate_unique_token(
        db,
        generate_invitation_token,
        lambda db_session, token: db_session.query(Event)
        .filter(Event.invitation_token == token)
        .first()
        is not None,
    )

    # Determine survey_id - events always need a survey
    survey_id, survey = _create_or_link_survey(db, event_data)

    # Hash access code if provided
    hashed_access_code = None
    if event_data.access_code:
        hashed_access_code = get_access_code_hash(event_data.access_code)

    # Create event
    event = Event(
        title=event_data.title,
        description=event_data.description,
        date=event_data.date,
        location=event_data.location,
        invitation_token=invitation_token,
        access_code=hashed_access_code,
        show_rsvp_list=event_data.show_rsvp_list,
        survey_id=survey_id,
        created_by=admin_id,
    )
    db.add(event)
    db.flush()  # Flush to get event.id

    # Update survey's event_id now that we have event.id
    if survey and survey.event_id is None:
        survey.event_id = event.id

    # Commit everything atomically (event, survey, and all questions)
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Failed to commit event creation: {e}", exc_info=True)
        db.rollback()
        # Let global exception handler sanitize the error message
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create event"
        ) from e

    # Refresh to ensure all relationships are loaded
    db.refresh(event)
    if survey:
        db.refresh(survey)

    # Verify questions were saved (for debugging)
    if len(event_data.survey_questions) > 0 and survey:
        question_count = db.query(Question).filter(Question.survey_id == survey.id).count()
        if question_count == 0:
            logger.error(
                f"Created event {event.id} with survey {survey.id} but no questions were saved. Expected {len(event_data.survey_questions)} questions."
            )
        else:
            logger.info(
                f"Created event {event.id} with survey {survey.id} and {question_count} questions (expected {len(event_data.survey_questions)})"
            )

    return event


def _create_or_link_survey(db: Session, event_data: EventCreate) -> tuple[int, Survey | None]:
    """
    Create or link a survey for the event.

    Returns:
        Tuple of (survey_id, survey_object)
    """
    if event_data.survey_id:
        # Link to existing survey
        survey = db.query(Survey).filter(Survey.id == event_data.survey_id).first()
        if not survey:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Survey with id {event_data.survey_id} not found",
            )
        return int(survey.id), survey

    elif len(event_data.survey_questions) > 0:
        # Create new survey with questions
        survey_token = generate_unique_token(
            db,
            generate_survey_token,
            lambda db_session, token: db_session.query(Survey)
            .filter(Survey.survey_token == token)
            .first()
            is not None,
        )

        survey = Survey(
            event_id=None,  # Will be set after event creation
            title=f"{event_data.title} - RSVP Survey",
            description=event_data.survey_description,
            survey_token=survey_token,
        )
        db.add(survey)
        db.flush()  # Flush to get survey.id

        # Create questions
        for idx, question_data in enumerate(event_data.survey_questions):
            # If order is 0 or not set, use index-based ordering
            question_order = (
                question_data.order
                if question_data.order and question_data.order > 0
                else (idx + 1)
            )

            try:
                question = Question(
                    survey_id=survey.id,
                    question_type=question_data.question_type,
                    question_text=question_data.question_text,
                    options=question_data.options,
                    allow_other=question_data.allow_other,
                    required=question_data.required,
                    order=question_order,
                )
                db.add(question)
            except Exception as e:
                logger.error(f"Failed to create question {idx}: {e}, data: {question_data}")
                raise

        return int(survey.id), survey

    else:
        # Create default empty survey
        survey_token = generate_unique_token(
            db,
            generate_survey_token,
            lambda db_session, token: db_session.query(Survey)
            .filter(Survey.survey_token == token)
            .first()
            is not None,
        )

        survey = Survey(
            event_id=None,  # Will be set after event creation
            title=f"{event_data.title} - RSVP Survey",
            description=None,
            survey_token=survey_token,
        )
        db.add(survey)
        db.flush()
        return int(survey.id), survey
