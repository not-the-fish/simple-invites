from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.tokens import generate_survey_token, generate_unique_token
from app.database import get_db
from app.models.admin import Admin
from app.models.question import Question
from app.models.response import QuestionResponse as QuestionResponseModel
from app.models.submission import SurveySubmission
from app.models.survey import Survey
from app.schemas.question import QuestionCreate, QuestionResponse, QuestionUpdate
from app.schemas.submission import (
    QuestionResponseGroup,
    QuestionResponseResponse,
    SurveySubmissionResponse,
)
from app.schemas.survey import SurveyCreate, SurveyUpdate
from app.schemas.survey import SurveyResponse as SurveyResponseSchema

router = APIRouter(prefix="/api/admin/surveys", tags=["admin-surveys"])


@router.get("", response_model=list[SurveyResponseSchema])
async def list_surveys(
    current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """List all surveys (admin only)"""
    surveys = db.query(Survey).order_by(Survey.created_at.desc()).all()
    return surveys


@router.post("", response_model=SurveyResponseSchema, status_code=status.HTTP_201_CREATED)
async def create_survey(
    survey_data: SurveyCreate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new survey with questions (admin only)"""
    # Generate unique survey token
    survey_token = generate_unique_token(
        db,
        generate_survey_token,
        lambda db_session, token: db_session.query(Survey)
        .filter(Survey.survey_token == token)
        .first()
        is not None,
    )

    # Create survey
    survey = Survey(
        event_id=survey_data.event_id,
        title=survey_data.title,
        description=survey_data.description,
        survey_token=survey_token,
    )

    db.add(survey)
    db.flush()  # Flush to get survey.id

    # Create questions
    for idx, question_data in enumerate(survey_data.questions):
        question = Question(
            survey_id=survey.id,
            question_type=question_data.question_type,
            question_text=question_data.question_text,
            options=question_data.options,
            allow_other=question_data.allow_other,
            required=question_data.required,
            order=question_data.order if question_data.order > 0 else idx,
        )
        db.add(question)

    db.commit()
    db.refresh(survey)

    return survey


@router.get("/{survey_id}", response_model=SurveyResponseSchema)
async def get_survey(
    survey_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get survey details (admin only)"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    return survey


@router.put("/{survey_id}", response_model=SurveyResponseSchema)
async def update_survey(
    survey_id: int,
    survey_data: SurveyUpdate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update a survey (admin only) - questions are managed separately"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Update survey fields if provided
    if survey_data.title is not None:
        survey.title = survey_data.title  # type: ignore[assignment]
    if survey_data.description is not None:
        survey.description = survey_data.description  # type: ignore[assignment]
    if survey_data.event_id is not None:
        survey.event_id = survey_data.event_id  # type: ignore[assignment]

    db.commit()
    db.refresh(survey)

    return survey


@router.delete("/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_survey(
    survey_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Delete a survey (admin only)"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    db.delete(survey)
    db.commit()

    return None


@router.get("/{survey_id}/questions", response_model=list[QuestionResponse])
async def get_survey_questions(
    survey_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get all questions for a survey (admin only)"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    questions = (
        db.query(Question).filter(Question.survey_id == survey_id).order_by(Question.order).all()
    )
    return questions


@router.post(
    "/{survey_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED
)
async def create_survey_question(
    survey_id: int,
    question_data: QuestionCreate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new question for a survey (admin only)"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # If order is 0, set it to the next available order
    if question_data.order == 0:
        max_order = (
            db.query(Question)
            .filter(Question.survey_id == survey_id)
            .order_by(Question.order.desc())
            .first()
        )
        question_data.order = int(max_order.order) + 1 if max_order else 1

    question = Question(
        survey_id=survey_id,
        question_type=question_data.question_type,
        question_text=question_data.question_text,
        options=question_data.options,
        allow_other=question_data.allow_other if hasattr(question_data, "allow_other") else False,
        required=question_data.required,
        order=question_data.order,
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return question


@router.put("/{survey_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_survey_question(
    survey_id: int,
    question_id: int,
    question_data: QuestionUpdate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update a question in a survey (admin only)"""
    question = (
        db.query(Question)
        .filter(Question.id == question_id, Question.survey_id == survey_id)
        .first()
    )

    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Update fields if provided
    if question_data.question_type is not None:
        question.question_type = question_data.question_type  # type: ignore[assignment]
    if question_data.question_text is not None:
        question.question_text = question_data.question_text  # type: ignore[assignment]
    if question_data.options is not None:
        question.options = question_data.options  # type: ignore[assignment]
    if question_data.allow_other is not None:
        question.allow_other = question_data.allow_other  # type: ignore[assignment]
    if question_data.required is not None:
        question.required = question_data.required  # type: ignore[assignment]
    if question_data.order is not None:
        question.order = question_data.order  # type: ignore[assignment]

    db.commit()
    db.refresh(question)

    return question


@router.delete("/{survey_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_survey_question(
    survey_id: int,
    question_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a question from a survey (admin only)"""
    question = (
        db.query(Question)
        .filter(Question.id == question_id, Question.survey_id == survey_id)
        .first()
    )

    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    db.delete(question)
    db.commit()

    return None


@router.get("/{survey_id}/submissions", response_model=list[SurveySubmissionResponse])
async def get_survey_submissions(
    survey_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get all submissions for a survey (admin only)"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    submissions = (
        db.query(SurveySubmission)
        .filter(SurveySubmission.survey_id == survey_id)
        .order_by(SurveySubmission.submitted_at.desc())
        .all()
    )

    return submissions


@router.get("/{survey_id}/responses", response_model=list[QuestionResponseResponse])
async def get_survey_responses(
    survey_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get all question responses for a survey (admin only) - returns individual question responses"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Get all question responses for this survey via submissions
    responses = (
        db.query(QuestionResponseModel)
        .join(SurveySubmission)
        .filter(SurveySubmission.survey_id == survey_id)
        .order_by(SurveySubmission.submitted_at.desc())
        .all()
    )

    return responses


@router.get("/{survey_id}/responses/by-question", response_model=list[QuestionResponseGroup])
async def get_survey_responses_by_question(
    survey_id: int, current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Get all question responses grouped by question (admin only)"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Get all questions for this survey
    questions = (
        db.query(Question).filter(Question.survey_id == survey_id).order_by(Question.order).all()
    )

    # Get all question responses for this survey via submissions
    responses = (
        db.query(QuestionResponseModel)
        .join(SurveySubmission)
        .filter(SurveySubmission.survey_id == survey_id)
        .order_by(SurveySubmission.submitted_at.desc())
        .all()
    )

    # Group responses by question_id
    grouped_responses = []
    for question in questions:
        question_responses = [r for r in responses if r.question_id == question.id]
        grouped_responses.append(
            QuestionResponseGroup(
                question_id=int(question.id),
                question_text=str(question.question_text),
                question_type=question.question_type.value,
                responses=question_responses,
            )
        )

    return grouped_responses
