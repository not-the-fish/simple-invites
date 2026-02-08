from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class QuestionResponse(Base):
    """Represents a single answer to a question within a survey submission"""

    __tablename__ = "question_responses"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(
        Integer, ForeignKey("survey_submissions.id"), nullable=False
    )  # Link to the submission
    question_id = Column(
        Integer, ForeignKey("questions.id"), nullable=False
    )  # Link to specific question
    answer = Column(JSON, nullable=False)  # Flexible JSON for different question types

    # Relationships
    submission = relationship("SurveySubmission", back_populates="question_responses")
    question = relationship("Question", back_populates="responses")
