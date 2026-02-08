import enum
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class RSVPResponse(str, enum.Enum):
    """RSVP response enum - moved from RSVP model"""

    YES = "yes"
    NO = "no"
    MAYBE = "maybe"


class SurveySubmission(Base):
    """Represents a single person's complete survey submission.

    For events, this includes RSVP fields (identity, rsvp_response, email, phone).
    For standalone surveys, these fields are null.
    """

    __tablename__ = "survey_submissions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), nullable=False)
    submitted_at = Column(DateTime, default=lambda: datetime.now(UTC))

    # RSVP fields (for event submissions)
    identity = Column(Text, nullable=True)  # Name/alias/guest list
    rsvp_response = Column(Enum(RSVPResponse), nullable=True)  # Yes/No/Maybe
    num_attendees = Column(Integer, nullable=True)  # Number of people attending (for YES responses)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    comment = Column(Text, nullable=True)  # Optional comment from the attendee
    edit_token_hash = Column(String, nullable=True, index=True)  # bcrypt hash of edit token for passwordless editing

    # Relationships
    survey = relationship("Survey", back_populates="submissions")
    question_responses = relationship(
        "QuestionResponse", back_populates="submission", cascade="all, delete-orphan"
    )
