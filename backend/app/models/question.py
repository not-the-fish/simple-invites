import enum
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.database import Base


class QuestionType(str, enum.Enum):
    TEXT = "text"
    MULTIPLE_CHOICE = "multiple_choice"
    CHECKBOX = "checkbox"
    YES_NO = "yes_no"
    DATE_TIME = "date_time"
    MATRIX = "matrix"
    MATRIX_SINGLE = "matrix_single"  # Matrix with single selection per row


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=True)  # For multiple_choice and checkbox types
    allow_other = Column(Boolean, default=False)  # Allow "other" option with text input
    required = Column(Boolean, default=False)
    order = Column(Integer, default=0)  # For sequencing questions within a survey
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    survey = relationship("Survey", back_populates="questions")
    responses = relationship(
        "QuestionResponse", back_populates="question", cascade="all, delete-orphan"
    )
