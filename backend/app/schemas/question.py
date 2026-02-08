from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.question import QuestionType


class QuestionBase(BaseModel):
    question_type: QuestionType
    question_text: str = Field(..., max_length=2000, description="Question text")
    options: list[str] | dict[str, Any] | None = (
        None  # For multiple_choice/checkbox (list) or matrix (dict with rows/columns)
    )
    allow_other: bool = False  # Allow "other" option with text input
    required: bool = False
    order: int = 0


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    question_type: QuestionType | None = None
    question_text: str | None = Field(None, max_length=2000)
    options: list[str] | dict[str, Any] | None = None
    allow_other: bool | None = None
    required: bool | None = None
    order: int | None = None


class QuestionResponse(BaseModel):
    id: int
    survey_id: int
    question_type: QuestionType
    question_text: str
    options: list[str] | dict[str, Any] | None = None
    allow_other: bool
    required: bool
    order: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime, _info):
        """Serialize datetime to ISO format with 'Z' suffix (UTC indicator)"""
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat()

    model_config = ConfigDict(from_attributes=True)


class QuestionPublic(BaseModel):
    """Public question response (for viewing surveys)"""

    id: int
    question_type: QuestionType
    question_text: str
    options: list[str] | dict[str, Any] | None = None
    allow_other: bool
    required: bool
    order: int

    model_config = ConfigDict(from_attributes=True)
