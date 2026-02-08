from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import (
    MAX_DATETIME_ANSWER_LENGTH,
    MAX_MATRIX_ITEM_LENGTH,
    MAX_MATRIX_ROWS,
    MAX_MATRIX_SELECTIONS,
    MAX_TEXT_ANSWER_LENGTH,
)
from app.database import get_db
from app.models.question import Question, QuestionType
from app.models.response import QuestionResponse
from app.models.submission import SurveySubmission
from app.models.survey import Survey
from app.schemas.submission import (
    SurveySubmissionCreate,
    SurveySubmissionResponse,
)
from app.schemas.survey import SurveyPublicResponse

router = APIRouter(prefix="/api/surveys", tags=["surveys"])


@router.get("/{survey_token}", response_model=SurveyPublicResponse)
async def get_survey_by_token(survey_token: str, db: Session = Depends(get_db)):
    """Get survey details by survey token (public endpoint)"""
    survey = db.query(Survey).filter(Survey.survey_token == survey_token).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Questions are loaded via relationship, ordered by order field
    return survey


@router.post(
    "/{survey_token}/responses",
    response_model=SurveySubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_survey_responses(
    survey_token: str, submission_data: SurveySubmissionCreate, db: Session = Depends(get_db)
):
    """Submit responses for all questions in a survey (public endpoint)"""
    survey = db.query(Survey).filter(Survey.survey_token == survey_token).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Get all questions for this survey
    questions = (
        db.query(Question).filter(Question.survey_id == survey.id).order_by(Question.order).all()
    )

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Survey has no questions"
        )

    # Validate that all required questions have answers
    question_dict = {q.id: q for q in questions}
    for question in questions:
        if question.required and question.id not in submission_data.answers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Required question {question.id} ({question.question_text}) is missing an answer",
            )

    # Create the survey submission first
    submission = SurveySubmission(survey_id=survey.id)
    db.add(submission)
    db.flush()  # Flush to get submission.id

    # Validate and create question responses
    created_responses = []
    for question_id, answer in submission_data.answers.items():
        if question_id not in question_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question {question_id} does not belong to this survey",
            )

        question = question_dict[question_id]

        # Normalize None to empty string for text questions
        answer_to_validate = answer
        question_type = question.question_type
        if question_type == QuestionType.TEXT and answer_to_validate is None:
            answer_to_validate = ""

        # For optional text questions, normalize whitespace-only answers to empty string
        if question_type == QuestionType.TEXT and not question.required:
            if isinstance(answer_to_validate, str) and answer_to_validate.strip() == "":
                answer_to_validate = ""

        # Validate answer based on question type
        # Extract actual values from SQLAlchemy Column types
        question_options = question.options if isinstance(question.options, list) else None
        question_required = bool(question.required)
        question_allow_other = bool(question.allow_other)
        is_valid = _validate_answer(
            question_type,
            answer_to_validate,
            question_options,
            question_required,
            question_allow_other,
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid answer for question {question.id} ({question.question_text}). Question required: {question.required}, Answer: {repr(answer_to_validate)}, Answer type: {type(answer_to_validate).__name__}, Question type: {question.question_type}",
            )

        # Create question response linked to the submission
        question_response = QuestionResponse(
            submission_id=submission.id, question_id=question.id, answer=answer_to_validate
        )

        db.add(question_response)
        created_responses.append(question_response)

    db.commit()

    # Refresh submission and responses
    db.refresh(submission)
    for response in created_responses:
        db.refresh(response)

    return submission


def _validate_answer(
    question_type: QuestionType,
    answer: Any,
    options: list[str] | None,
    required: bool = True,
    allow_other: bool = False,
) -> bool:
    """Validate answer based on question type"""
    # Check if answer is empty (None, empty string, empty list, or empty dict)
    is_empty = (
        answer is None
        or (isinstance(answer, str) and len(answer.strip()) == 0)
        or (isinstance(answer, list) and len(answer) == 0)
        or (isinstance(answer, dict) and len(answer) == 0)
    )

    # If empty, allow only if question is not required
    if is_empty:
        return not required

    # Validate format based on question type (answer is not empty at this point)
    if question_type == QuestionType.TEXT:
        # Text answers should be strings with reasonable length limit
        return isinstance(answer, str) and len(answer) <= MAX_TEXT_ANSWER_LENGTH
    elif question_type == QuestionType.MULTIPLE_CHOICE:
        # Allow "other" option if allow_other is True
        if isinstance(answer, dict) and "value" in answer:
            # Format: {"value": "other", "other_text": "custom text"}
            if answer.get("value") == "other":
                if not allow_other:
                    return False
                other_text = answer.get("other_text", "")
                return (
                    isinstance(other_text, str)
                    and len(other_text.strip()) > 0
                    and len(other_text) <= MAX_TEXT_ANSWER_LENGTH
                )
            return isinstance(answer["value"], str) and (
                options is None or answer["value"] in options
            )
        # Check if answer is "other" string (shouldn't happen, but handle it)
        if answer == "other":
            return allow_other
        return isinstance(answer, str) and (options is None or answer in options)
    elif question_type == QuestionType.CHECKBOX:
        # Allow "other" option if allow_other is True
        if isinstance(answer, dict) and "values" in answer:
            # Format: {"values": ["option1", "other"], "other_text": "custom text"}
            values = answer.get("values", [])
            if not isinstance(values, list) or len(values) == 0:
                return False
            # Check if "other" is in values and validate other_text
            if "other" in values:
                if not allow_other:
                    return False
                other_text = answer.get("other_text", "")
                if (
                    not isinstance(other_text, str)
                    or len(other_text.strip()) == 0
                    or len(other_text) > MAX_TEXT_ANSWER_LENGTH
                ):
                    return False
            return all(isinstance(item, str) for item in values) and (
                options is None
                or all(item in options or (item == "other" and allow_other) for item in values)
            )
        # Regular array format
        if not isinstance(answer, list) or len(answer) == 0:
            return False
        # Check if "other" is in the answer
        if "other" in answer and not allow_other:
            return False
        return all(isinstance(item, str) for item in answer) and (
            options is None
            or all(item in options or (item == "other" and allow_other) for item in answer)
        )
    elif question_type == QuestionType.YES_NO:
        return isinstance(answer, bool) or answer in ["yes", "no", True, False]
    elif question_type == QuestionType.DATE_TIME:
        # Date/time answers should be strings with reasonable length (ISO format is ~30 chars)
        return (
            isinstance(answer, str)
            and len(answer.strip()) > 0
            and len(answer) <= MAX_DATETIME_ANSWER_LENGTH
        )
    elif question_type == QuestionType.MATRIX:
        # Matrix answers are arrays of strings in format "Row Column" (e.g., "First Wednesday")
        if not isinstance(answer, list):
            return False
        if len(answer) == 0:
            return not required
        # Limit number of selections to prevent DoS
        if len(answer) > MAX_MATRIX_SELECTIONS:
            return False
        # Validate that all items are strings and match the matrix format
        # For matrix questions, options contains the matrix configuration
        # We'll validate that the answer combinations are valid
        return all(
            isinstance(item, str) and len(item.strip()) > 0 and len(item) <= MAX_MATRIX_ITEM_LENGTH
            for item in answer
        )
    elif question_type == QuestionType.MATRIX_SINGLE:
        # Matrix single answers are dictionaries mapping row to column (e.g., {"Peanuts": "can't have in home"})
        if not isinstance(answer, dict):
            return False
        if len(answer) == 0:
            return not required
        # Limit number of rows to prevent DoS
        if len(answer) > MAX_MATRIX_ROWS:
            return False
        # Validate that all keys and values are strings with reasonable length
        return all(
            isinstance(key, str)
            and isinstance(value, str)
            and len(key.strip()) > 0
            and len(key) <= MAX_MATRIX_ITEM_LENGTH
            and len(value.strip()) > 0
            and len(value) <= MAX_MATRIX_ITEM_LENGTH
            for key, value in answer.items()
        )
    return False
