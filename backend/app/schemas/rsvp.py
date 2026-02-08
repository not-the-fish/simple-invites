from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer

from app.models.submission import RSVPResponse as RSVPResponseEnum


class RSVPBase(BaseModel):
    """Base RSVP fields - now part of SurveySubmission"""

    identity: str = Field(..., max_length=500, description="Name/alias/guest list")
    response: RSVPResponseEnum
    num_attendees: int | None = Field(None, ge=1, le=1000, description="Number of people attending")
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50, description="Phone number")
    comment: str | None = Field(None, max_length=2000, description="Optional comment")


class RSVPCreate(RSVPBase):
    """Schema for creating an RSVP (now creates a SurveySubmission with RSVP fields)"""

    access_code: str | None = Field(
        None, max_length=100, description="Access code for protected events"
    )
    survey_responses: dict[int, Any] | None = (
        None  # Optional survey responses: question_id -> answer
    )


class RSVPUpdate(RSVPBase):
    """Schema for updating an existing RSVP (requires edit_token in query param)"""

    survey_responses: dict[int, Any] | None = (
        None  # Optional survey responses: question_id -> answer
    )


class RSVPResponse(BaseModel):
    """Response schema for RSVP (now represents a SurveySubmission with RSVP fields)"""

    id: int
    survey_id: int  # Changed from event_id - can get event via survey.event_id
    identity: str
    response: RSVPResponseEnum
    num_attendees: int | None = None
    email: str | None = None
    phone: str | None = None
    comment: str | None = None
    submitted_at: datetime

    @field_serializer("submitted_at")
    def serialize_datetime(self, value: datetime, _info):
        """Serialize datetime to ISO format with 'Z' suffix (UTC indicator)"""
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat()

    model_config = ConfigDict(from_attributes=True)


class RSVPWithEditToken(RSVPResponse):
    """Response schema for RSVP creation that includes the edit token.

    The edit_token is only returned once during creation. Store it securely
    as it's the only way to edit the RSVP without authentication.
    """

    edit_token: str = Field(..., description="Token for editing this RSVP without authentication")
