from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.question import QuestionCreate

if TYPE_CHECKING:
    from app.schemas.survey import SurveyPublicResponse


class EventBase(BaseModel):
    title: str = Field(..., max_length=500, description="Event title")
    description: str | None = Field(None, max_length=5000, description="Event description")
    date: datetime
    location: str | None = Field(None, max_length=500, description="Event location")


class EventCreate(EventBase):
    access_code: str | None = Field(
        None, max_length=100, description="Access code for protected events"
    )
    show_rsvp_list: bool = Field(
        False, description="Show list of attendee names publicly"
    )
    survey_id: int | None = None  # Optional: link to existing survey
    # Optional: create new survey atomically with event
    survey_description: str | None = Field(None, max_length=5000, description="Survey description")
    survey_questions: list[QuestionCreate] = []


class EventUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    description: str | None = Field(None, max_length=5000)
    date: datetime | None = None
    location: str | None = Field(None, max_length=500)
    access_code: str | None = Field(None, max_length=100)
    show_rsvp_list: bool | None = None
    survey_id: int | None = None


class EventResponse(EventBase):
    id: int
    invitation_token: str
    access_code: str | None = None
    show_rsvp_list: bool = False
    survey_id: int  # Required - events always have a survey
    created_at: datetime
    updated_at: datetime

    @field_serializer("date", "created_at", "updated_at")
    def serialize_datetime(self, value: datetime, _info):
        """Serialize datetime to ISO format with 'Z' suffix (UTC indicator)"""
        if value.tzinfo is None:
            # Treat naive datetime as UTC
            return value.isoformat() + "Z"
        return value.isoformat()

    model_config = ConfigDict(from_attributes=True)


class EventPublicResponse(BaseModel):
    """Public event response (without sensitive info)"""

    id: int
    title: str
    description: str | None = None
    date: datetime
    location: str | None = None
    has_access_code: bool  # Indicates if access code is required, but don't expose the code
    show_rsvp_list: bool = False  # Whether to show attendee names publicly
    survey: SurveyPublicResponse | None = None  # Survey for RSVP flow

    @field_serializer("date")
    def serialize_datetime(self, value: datetime, _info):
        """Serialize datetime to ISO format with 'Z' suffix (UTC indicator)"""
        if value.tzinfo is None:
            # Treat naive datetime as UTC
            return value.isoformat() + "Z"
        return value.isoformat()

    model_config = ConfigDict(from_attributes=True)
