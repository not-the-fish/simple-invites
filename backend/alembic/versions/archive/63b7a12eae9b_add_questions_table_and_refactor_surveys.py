"""add_questions_table_and_refactor_surveys

Revision ID: 63b7a12eae9b
Revises: 93e50cb7e6f6
Create Date: 2025-12-28 16:25:34.497658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '63b7a12eae9b'
down_revision: Union[str, None] = '93e50cb7e6f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Create questions table (enum already exists from initial migration)
    # Use the existing enum type without trying to create it
    connection = op.get_bind()
    
    # Create table using raw SQL to avoid SQLAlchemy trying to create the enum
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            survey_id INTEGER NOT NULL REFERENCES surveys(id),
            question_type questiontype NOT NULL,
            question_text TEXT NOT NULL,
            options JSON,
            required BOOLEAN,
            "order" INTEGER,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    """))
    
    # Create index
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
    
    # Step 2: Migrate existing survey data to questions
    # For each survey, create a question with the survey's question data
    connection = op.get_bind()
    connection.execute(text("""
        INSERT INTO questions (survey_id, question_type, question_text, options, required, "order", created_at, updated_at)
        SELECT id, question_type, question_text, options, required, "order", created_at, updated_at
        FROM surveys
    """))
    
    # Step 3: Add question_id column to survey_responses
    op.add_column('survey_responses', sa.Column('question_id', sa.Integer(), nullable=True))
    
    # Step 4: Migrate existing responses to link to questions
    # Each survey_response should link to the question created from its survey
    connection.execute(text("""
        UPDATE survey_responses sr
        SET question_id = (
            SELECT q.id
            FROM questions q
            WHERE q.survey_id = sr.survey_id
            LIMIT 1
        )
    """))
    
    # Step 5: Make question_id NOT NULL after migration
    op.alter_column('survey_responses', 'question_id', nullable=False)
    
    # Step 6: Add foreign key constraint
    op.create_foreign_key('fk_survey_responses_question_id', 'survey_responses', 'questions', ['question_id'], ['id'])
    
    # Step 7: Remove question fields from surveys table
    op.drop_column('surveys', 'question_type')
    op.drop_column('surveys', 'question_text')
    op.drop_column('surveys', 'options')
    op.drop_column('surveys', 'required')
    op.drop_column('surveys', 'order')


def downgrade() -> None:
    # Step 1: Add question fields back to surveys
    op.add_column('surveys', sa.Column('question_type', sa.Enum('TEXT', 'MULTIPLE_CHOICE', 'CHECKBOX', 'YES_NO', 'DATE_TIME', name='questiontype'), nullable=True))
    op.add_column('surveys', sa.Column('question_text', sa.Text(), nullable=True))
    op.add_column('surveys', sa.Column('options', sa.JSON(), nullable=True))
    op.add_column('surveys', sa.Column('required', sa.Boolean(), nullable=True))
    op.add_column('surveys', sa.Column('order', sa.Integer(), nullable=True))
    
    # Step 2: Migrate question data back to surveys (use first question for each survey)
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE surveys s
        SET question_type = q.question_type,
            question_text = q.question_text,
            options = q.options,
            required = q.required,
            "order" = q."order"
        FROM (
            SELECT DISTINCT ON (survey_id) survey_id, question_type, question_text, options, required, "order"
            FROM questions
            ORDER BY survey_id, "order"
        ) q
        WHERE s.id = q.survey_id
    """))
    
    # Step 3: Make question fields NOT NULL
    op.alter_column('surveys', 'question_type', nullable=False)
    op.alter_column('surveys', 'question_text', nullable=False)
    
    # Step 4: Remove foreign key and question_id from survey_responses
    op.drop_constraint('fk_survey_responses_question_id', 'survey_responses', type_='foreignkey')
    op.drop_column('survey_responses', 'question_id')
    
    # Step 5: Drop questions table
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
