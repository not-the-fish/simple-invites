from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Integer, Text

from app.database import Base


class CodeOfConduct(Base):
    __tablename__ = "code_of_conduct"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    updated_by = Column(Integer, nullable=True)  # Admin ID who last updated
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
