from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.question import QuestionCreate, QuestionPublic, QuestionResponse


class SurveyBase(BaseModel):
    title: str = Field(..., max_length=500, description="Survey title")
    description: str | None = Field(None, max_length=5000, description="Survey description")


class SurveyCreate(SurveyBase):
    event_id: int | None = None  # Nullable for standalone surveys
    questions: list[QuestionCreate] = []  # List of questions for the survey


class SurveyUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    description: str | None = Field(None, max_length=5000)
    event_id: int | None = None


class SurveyResponse(BaseModel):
    id: int
    event_id: int | None = None
    title: str
    description: str | None = None
    survey_token: str
    questions: list[QuestionResponse] = []
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime, _info):
        """Serialize datetime to ISO format with 'Z' suffix (UTC indicator)"""
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat()

    model_config = ConfigDict(from_attributes=True)


class SurveyPublicResponse(BaseModel):
    """Public survey response (for viewing surveys)"""

    id: int
    title: str
    description: str | None = None
    questions: list[QuestionPublic] = []

    model_config = ConfigDict(from_attributes=True)


class SurveyResponseBase(BaseModel):
    answer: Any | None = None  # JSON-compatible answer (string, list, dict, etc.)


class SurveyResponseCreate(SurveyResponseBase):
    pass  # RSVP fields are now part of SurveySubmission
