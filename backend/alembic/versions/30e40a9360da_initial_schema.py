"""initial_schema

Revision ID: 30e40a9360da
Revises: None
Create Date: 2025-12-29 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '30e40a9360da'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create admins table
    op.create_table(
        'admins',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admins_email'), 'admins', ['email'], unique=True)
    op.create_index(op.f('ix_admins_id'), 'admins', ['id'], unique=False)

    # Create surveys table (without event_id FK initially to avoid circular dependency)
    op.create_table(
        'surveys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('survey_token', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_surveys_id'), 'surveys', ['id'], unique=False)
    op.create_index(op.f('ix_surveys_survey_token'), 'surveys', ['survey_token'], unique=True)

    # Create events table
    op.create_table(
        'events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('invitation_token', sa.String(), nullable=False),
        sa.Column('access_code', sa.String(), nullable=True),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['admins.id'], ),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_events_id'), 'events', ['id'], unique=False)
    op.create_index(op.f('ix_events_invitation_token'), 'events', ['invitation_token'], unique=True)

    # Add foreign key constraint for surveys.event_id (after events table exists)
    op.create_foreign_key('surveys_event_id_fkey', 'surveys', 'events', ['event_id'], ['id'])

    # Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('question_type', sa.Enum('TEXT', 'MULTIPLE_CHOICE', 'CHECKBOX', 'YES_NO', 'DATE_TIME', 'MATRIX', 'MATRIX_SINGLE', name='questiontype'), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('allow_other', sa.Boolean(), nullable=True),
        sa.Column('required', sa.Boolean(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)

    # Create survey_submissions table
    op.create_table(
        'survey_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('identity', sa.Text(), nullable=True),
        sa.Column('rsvp_response', sa.Enum('YES', 'NO', 'MAYBE', name='rsvpresponse'), nullable=True),
        sa.Column('num_attendees', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_submissions_id'), 'survey_submissions', ['id'], unique=False)

    # Create question_responses table
    op.create_table(
        'question_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('answer', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.ForeignKeyConstraint(['submission_id'], ['survey_submissions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_responses_id'), 'question_responses', ['id'], unique=False)

    # Create code_of_conduct table
    op.create_table(
        'code_of_conduct',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_code_of_conduct_id'), 'code_of_conduct', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_code_of_conduct_id'), table_name='code_of_conduct')
    op.drop_table('code_of_conduct')
    op.drop_index(op.f('ix_question_responses_id'), table_name='question_responses')
    op.drop_table('question_responses')
    op.drop_index(op.f('ix_survey_submissions_id'), table_name='survey_submissions')
    op.drop_table('survey_submissions')
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
    op.drop_index(op.f('ix_events_invitation_token'), table_name='events')
    op.drop_index(op.f('ix_events_id'), table_name='events')
    op.drop_table('events')
    op.drop_index(op.f('ix_surveys_survey_token'), table_name='surveys')
    op.drop_index(op.f('ix_surveys_id'), table_name='surveys')
    op.drop_table('surveys')
    op.drop_index(op.f('ix_admins_id'), table_name='admins')
    op.drop_index(op.f('ix_admins_email'), table_name='admins')
    op.drop_table('admins')
    op.execute('DROP TYPE IF EXISTS questiontype')
    op.execute('DROP TYPE IF EXISTS rsvpresponse')
