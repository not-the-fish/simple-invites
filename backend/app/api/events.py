from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.services.email_service import send_rsvp_confirmation

from app.api.surveys import _validate_answer
from app.core.security import (
    generate_edit_token,
    get_edit_token_hash,
    verify_access_code,
    verify_edit_token,
)
from app.database import get_db
from app.models.event import Event
from app.models.question import Question
from app.models.response import QuestionResponse as QuestionResponseModel
from app.models.submission import RSVPResponse as RSVPResponseEnum
from app.models.submission import SurveySubmission
from app.models.survey import Survey
from app.schemas.event import EventPublicResponse
from app.schemas.rsvp import RSVPCreate, RSVPUpdate
from app.schemas.rsvp import RSVPResponse as RSVPResponseSchema
from app.schemas.rsvp import RSVPWithEditToken
from app.schemas.survey import SurveyPublicResponse

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/{invitation_token}", response_model=EventPublicResponse)
async def get_event_by_token(
    invitation_token: str,
    access_code: str | None = Query(None, description="Optional access code for protected events"),
    db: Session = Depends(get_db),
):
    """
    Get event details by invitation token (public endpoint).

    **Rate Limited**: 100 requests per 15 minutes per IP.

    **Path Parameters**:
    - `invitation_token` (string, required): Unique invitation token for the event

    **Query Parameters**:
    - `access_code` (string, optional): Access code required for protected events

    **Response**: Event details including title, description, date, location, and survey information.

    **Example Request**:
    ```
    GET /api/events/abc123def456?access_code=secret123
    ```

    **Example Response**:
    ```json
    {
      "id": 1,
      "title": "Holiday Potluck",
      "description": "Join us for a festive gathering!",
      "date": "2024-12-25T18:00:00Z",
      "location": "Community Center",
      "survey": {
        "id": 1,
        "title": "RSVP Survey",
        "questions": [...]
      }
    }
    ```

    **Error Responses**:
    - `403 Forbidden`: Invalid or missing access code for protected events
    - `404 Not Found`: Event not found
    """
    event = db.query(Event).filter(Event.invitation_token == invitation_token).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # If event has an access code, validate it using secure comparison
    if event.access_code:
        if not access_code or not verify_access_code(access_code, event.access_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access code required"
            )

    # Load survey (events always have a survey)
    survey_obj = db.query(Survey).filter(Survey.id == event.survey_id).first()
    survey = None
    if survey_obj:
        # Load questions for the survey
        questions = (
            db.query(Question)
            .filter(Question.survey_id == survey_obj.id)
            .order_by(Question.order)
            .all()
        )
        from app.schemas.question import QuestionPublic

        survey = SurveyPublicResponse(
            id=int(survey_obj.id),
            title=str(survey_obj.title),
            description=str(survey_obj.description) if survey_obj.description else None,
            questions=[QuestionPublic.model_validate(q) for q in questions],
        )

    # Return public event info (without exposing the actual access code)
    return EventPublicResponse(
        id=int(event.id),
        title=str(event.title),
        description=str(event.description) if event.description else None,
        date=event.date,
        location=str(event.location) if event.location else None,
        has_access_code=event.access_code is not None,
        show_rsvp_list=bool(event.show_rsvp_list),
        survey=survey,
    )


@router.get("/{invitation_token}/stats")
async def get_event_rsvp_stats(
    invitation_token: str,
    access_code: str | None = Query(None, description="Optional access code for protected events"),
    db: Session = Depends(get_db),
):
    """Get RSVP statistics for an event (public endpoint)"""
    event = db.query(Event).filter(Event.invitation_token == invitation_token).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # If event has an access code, validate it using secure comparison
    if event.access_code:
        if not access_code or not verify_access_code(access_code, event.access_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access code required"
            )

    # Get RSVP statistics for this event's survey
    # Count submissions with RSVP responses
    yes_submissions = (
        db.query(SurveySubmission)
        .filter(
            SurveySubmission.survey_id == event.survey_id,
            SurveySubmission.rsvp_response == RSVPResponseEnum.YES,
        )
        .all()
    )

    # Sum up num_attendees for YES responses (default to 1 if not set for backward compatibility)
    yes_attendees = sum(sub.num_attendees or 1 for sub in yes_submissions)
    yes_count = len(yes_submissions)

    no_count = (
        db.query(func.count(SurveySubmission.id))
        .filter(
            SurveySubmission.survey_id == event.survey_id,
            SurveySubmission.rsvp_response == RSVPResponseEnum.NO,
        )
        .scalar()
    )

    # Get maybe submissions to calculate attendee count
    maybe_submissions = (
        db.query(SurveySubmission)
        .filter(
            SurveySubmission.survey_id == event.survey_id,
            SurveySubmission.rsvp_response == RSVPResponseEnum.MAYBE,
        )
        .all()
    )

    # Sum up num_attendees for MAYBE responses (default to 1 if not set for backward compatibility)
    maybe_attendees = sum(sub.num_attendees or 1 for sub in maybe_submissions)
    maybe_count = len(maybe_submissions)

    total_rsvps = yes_count + no_count + maybe_count

    # Format date as ISO string with UTC indicator to ensure proper timezone handling
    event_date_str = event.date.isoformat()
    if not event_date_str.endswith("Z") and event.date.tzinfo is None:
        # If naive datetime (no timezone info), treat as UTC and add 'Z' suffix
        event_date_str = event_date_str + "Z"

    response = {
        "event_title": event.title,
        "event_description": event.description,
        "event_date": event_date_str,
        "event_location": event.location,
        "total_rsvps": total_rsvps,
        "yes_count": yes_count,
        "yes_attendees": yes_attendees,  # Total number of people attending (YES)
        "no_count": no_count,
        "maybe_count": maybe_count,
        "maybe_attendees": maybe_attendees,  # Total number of people who might attend (MAYBE)
        "has_survey": True,  # Events always have surveys now
        "show_rsvp_list": event.show_rsvp_list,
    }

    # Include attendee names if show_rsvp_list is enabled
    if event.show_rsvp_list:
        response["attendees"] = {
            "yes": [
                {"name": sub.identity, "num_attendees": sub.num_attendees or 1}
                for sub in yes_submissions
            ],
            "maybe": [
                {"name": sub.identity, "num_attendees": sub.num_attendees or 1}
                for sub in maybe_submissions
            ],
        }

    return response


@router.post(
    "/{invitation_token}/rsvp",
    response_model=RSVPWithEditToken,
    status_code=status.HTTP_201_CREATED,
)
async def submit_rsvp(
    invitation_token: str,
    rsvp_data: RSVPCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Submit an RSVP for an event (public endpoint) - creates a SurveySubmission with RSVP fields.

    Returns an edit_token that can be used to modify this RSVP later without authentication.
    Store this token securely - it's the only way to edit the RSVP.
    """
    event = db.query(Event).filter(Event.invitation_token == invitation_token).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Validate access code if event requires it using secure comparison
    if event.access_code:
        # event.access_code is a Column[str] at type level, but str at runtime
        access_code_hash: str = str(event.access_code) if event.access_code else ""
        if not rsvp_data.access_code or not verify_access_code(
            rsvp_data.access_code, access_code_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing access code"
            )

    # Validate num_attendees for YES responses (required) and MAYBE responses (optional but must be >= 1 if provided)
    if rsvp_data.response == RSVPResponseEnum.YES:
        if not rsvp_data.num_attendees or rsvp_data.num_attendees < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of attendees is required and must be at least 1 for YES responses",
            )
    elif rsvp_data.response == RSVPResponseEnum.MAYBE and rsvp_data.num_attendees is not None:
        if rsvp_data.num_attendees < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of attendees must be at least 1 if provided",
            )

    # Generate edit token for passwordless editing
    edit_token = generate_edit_token()
    edit_token_hash = get_edit_token_hash(edit_token)

    # Create survey submission with RSVP fields
    submission = SurveySubmission(
        survey_id=event.survey_id,
        identity=rsvp_data.identity,
        rsvp_response=rsvp_data.response,
        num_attendees=(
            rsvp_data.num_attendees
            if rsvp_data.response in (RSVPResponseEnum.YES, RSVPResponseEnum.MAYBE)
            else None
        ),
        email=rsvp_data.email,
        phone=rsvp_data.phone,
        comment=rsvp_data.comment,
        edit_token_hash=edit_token_hash,
    )
    db.add(submission)
    db.flush()  # Flush to get submission.id

    # Handle survey responses if provided
    if rsvp_data.survey_responses:
        # Get all questions for the survey
        questions = db.query(Question).filter(Question.survey_id == event.survey_id).all()
        # Create dict with int keys (not Column[int]) for lookup
        question_dict: dict[int, Question] = {int(q.id): q for q in questions}

        # Create question responses
        for question_id, answer in rsvp_data.survey_responses.items():
            question = question_dict.get(question_id)
            if not question:
                continue

            # Validate answer
            options = question.options if isinstance(question.options, list) else None
            if not _validate_answer(
                question.question_type, answer, options, question.required, question.allow_other
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid answer for question {question_id}",
                )

            # Create question response
            question_response = QuestionResponseModel(
                submission_id=submission.id, question_id=question_id, answer=answer
            )
            db.add(question_response)

    db.commit()
    db.refresh(submission)

    # Send confirmation email if email was provided
    if rsvp_data.email:
        # Build edit URL with token in fragment (not sent to server for privacy)
        edit_url = f"https://app.erikasalomon.events/rsvp/{invitation_token}#edit={edit_token}"
        
        background_tasks.add_task(
            send_rsvp_confirmation,
            to_email=rsvp_data.email,
            guest_name=rsvp_data.identity,
            event_title=str(event.title),
            response=rsvp_data.response.value if hasattr(rsvp_data.response, 'value') else str(rsvp_data.response),
            num_attendees=rsvp_data.num_attendees,
            edit_url=edit_url,
        )

    # Return RSVP response with edit token
    return RSVPWithEditToken(
        id=submission.id,
        survey_id=submission.survey_id,
        identity=submission.identity or "",
        response=submission.rsvp_response or RSVPResponseEnum.NO,
        num_attendees=submission.num_attendees,
        email=submission.email,
        phone=submission.phone,
        comment=submission.comment,
        submitted_at=submission.submitted_at,
        edit_token=edit_token,  # Return plain token to client (only time it's exposed)
    )


@router.get("/{invitation_token}/my-rsvp", response_model=RSVPResponseSchema)
async def get_my_rsvp(
    invitation_token: str,
    edit_token: str = Query(..., description="Edit token received when RSVP was submitted"),
    db: Session = Depends(get_db),
):
    """Retrieve an existing RSVP using the edit token (public endpoint).

    Use this to fetch RSVP data for editing without authentication.
    """
    event = db.query(Event).filter(Event.invitation_token == invitation_token).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Find submission by checking edit token hash
    submissions = (
        db.query(SurveySubmission)
        .filter(
            SurveySubmission.survey_id == event.survey_id,
            SurveySubmission.edit_token_hash.isnot(None),
        )
        .all()
    )

    # Verify edit token against each submission (bcrypt comparison)
    matching_submission = None
    for submission in submissions:
        if submission.edit_token_hash and verify_edit_token(edit_token, submission.edit_token_hash):
            matching_submission = submission
            break

    if not matching_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RSVP not found or invalid edit token",
        )

    return RSVPResponseSchema(
        id=matching_submission.id,
        survey_id=matching_submission.survey_id,
        identity=matching_submission.identity or "",
        response=matching_submission.rsvp_response or RSVPResponseEnum.NO,
        num_attendees=matching_submission.num_attendees,
        email=matching_submission.email,
        phone=matching_submission.phone,
        comment=matching_submission.comment,
        submitted_at=matching_submission.submitted_at,
    )


@router.put("/{invitation_token}/rsvp", response_model=RSVPResponseSchema)
async def update_rsvp(
    invitation_token: str,
    rsvp_data: RSVPUpdate,
    edit_token: str = Query(..., description="Edit token received when RSVP was submitted"),
    db: Session = Depends(get_db),
):
    """Update an existing RSVP using the edit token (public endpoint).

    Requires the edit token that was returned when the RSVP was originally submitted.
    """
    event = db.query(Event).filter(Event.invitation_token == invitation_token).first()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Find submission by checking edit token hash
    submissions = (
        db.query(SurveySubmission)
        .filter(
            SurveySubmission.survey_id == event.survey_id,
            SurveySubmission.edit_token_hash.isnot(None),
        )
        .all()
    )

    # Verify edit token against each submission
    matching_submission = None
    for submission in submissions:
        if submission.edit_token_hash and verify_edit_token(edit_token, submission.edit_token_hash):
            matching_submission = submission
            break

    if not matching_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RSVP not found or invalid edit token",
        )

    # Validate num_attendees for YES responses (required) and MAYBE responses (optional but must be >= 1 if provided)
    if rsvp_data.response == RSVPResponseEnum.YES:
        if not rsvp_data.num_attendees or rsvp_data.num_attendees < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of attendees is required and must be at least 1 for YES responses",
            )
    elif rsvp_data.response == RSVPResponseEnum.MAYBE and rsvp_data.num_attendees is not None:
        if rsvp_data.num_attendees < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of attendees must be at least 1 if provided",
            )

    # Update RSVP fields
    matching_submission.identity = rsvp_data.identity
    matching_submission.rsvp_response = rsvp_data.response
    matching_submission.num_attendees = (
        rsvp_data.num_attendees
        if rsvp_data.response in (RSVPResponseEnum.YES, RSVPResponseEnum.MAYBE)
        else None
    )
    matching_submission.email = rsvp_data.email
    matching_submission.phone = rsvp_data.phone
    matching_submission.comment = rsvp_data.comment

    # Handle survey responses if provided
    if rsvp_data.survey_responses is not None:
        # Delete existing question responses
        db.query(QuestionResponseModel).filter(
            QuestionResponseModel.submission_id == matching_submission.id
        ).delete()

        # Get all questions for the survey
        questions = db.query(Question).filter(Question.survey_id == event.survey_id).all()
        question_dict: dict[int, Question] = {int(q.id): q for q in questions}

        # Create new question responses
        for question_id, answer in rsvp_data.survey_responses.items():
            question = question_dict.get(question_id)
            if not question:
                continue

            # Validate answer
            options = question.options if isinstance(question.options, list) else None
            if not _validate_answer(
                question.question_type, answer, options, question.required, question.allow_other
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid answer for question {question_id}",
                )

            # Create question response
            question_response = QuestionResponseModel(
                submission_id=matching_submission.id, question_id=question_id, answer=answer
            )
            db.add(question_response)

    db.commit()
    db.refresh(matching_submission)

    return RSVPResponseSchema(
        id=matching_submission.id,
        survey_id=matching_submission.survey_id,
        identity=matching_submission.identity or "",
        response=matching_submission.rsvp_response or RSVPResponseEnum.NO,
        num_attendees=matching_submission.num_attendees,
        email=matching_submission.email,
        phone=matching_submission.phone,
        comment=matching_submission.comment,
        submitted_at=matching_submission.submitted_at,
    )