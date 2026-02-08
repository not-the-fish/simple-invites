from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Survey(Base):
    """Survey model - can be standalone or linked to an Event"""

    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer, ForeignKey("events.id"), nullable=True
    )  # Nullable for standalone surveys
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    survey_token = Column(String, unique=True, index=True, nullable=False)  # For standalone surveys
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    event = relationship("Event", foreign_keys="[Survey.event_id]", uselist=False)
    questions = relationship(
        "Question", back_populates="survey", cascade="all, delete-orphan", order_by="Question.order"
    )
    submissions = relationship(
        "SurveySubmission", back_populates="survey", cascade="all, delete-orphan"
    )
