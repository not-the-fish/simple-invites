from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.submission import RSVPResponse as RSVPResponseEnum


class QuestionResponseResponse(BaseModel):
    """Response schema for a single question response"""

    id: int
    submission_id: int
    question_id: int
    answer: Any

    model_config = ConfigDict(from_attributes=True)


class SurveySubmissionResponse(BaseModel):
    """Response schema for a survey submission"""

    id: int
    survey_id: int
    submitted_at: datetime
    # RSVP fields (for event submissions)
    identity: str | None = None
    rsvp_response: RSVPResponseEnum | None = None
    num_attendees: int | None = None
    email: str | None = None
    phone: str | None = None
    comment: str | None = None
    question_responses: list[QuestionResponseResponse] = []

    @field_serializer("submitted_at")
    def serialize_datetime(self, value: datetime, _info):
        """Serialize datetime to ISO format with 'Z' suffix (UTC indicator)"""
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat()

    model_config = ConfigDict(from_attributes=True)


class QuestionResponseGroup(BaseModel):
    """Response schema for responses grouped by question"""

    question_id: int
    question_text: str
    question_type: str
    responses: list[QuestionResponseResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SurveySubmissionCreate(BaseModel):
    """For submitting answers to all questions in a survey"""

    answers: dict[int, Any]  # question_id -> answer
