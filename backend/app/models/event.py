from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Event(Base):
    """Event model - Events always have an associated Survey for RSVP flow"""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    date = Column(DateTime, nullable=False)
    location = Column(String, nullable=True)
    invitation_token = Column(String, unique=True, index=True, nullable=False)
    access_code = Column(String, nullable=True)  # Optional, stored as bcrypt hash for security
    show_rsvp_list = Column(Boolean, default=False, nullable=False)  # Show attendee names publicly
    survey_id = Column(
        Integer, ForeignKey("surveys.id"), nullable=False
    )  # Required survey for RSVP flow
    created_by = Column(Integer, ForeignKey("admins.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    created_by_admin = relationship("Admin", back_populates="events")
    survey = relationship("Survey", foreign_keys="[Event.survey_id]", uselist=False)
