"""add_submission_model_and_refactor_responses

Revision ID: 18b95ba2e3e4
Revises: 63b7a12eae9b
Create Date: 2025-12-28 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '18b95ba2e3e4'
down_revision: Union[str, None] = '63b7a12eae9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Create survey_submissions table
    op.create_table('survey_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('rsvp_id', sa.Integer(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['rsvp_id'], ['rsvps.id'], ),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_submissions_id'), 'survey_submissions', ['id'], unique=False)
    
    # Step 2: Migrate existing survey_responses to create submissions
    # Group responses by survey_id and rsvp_id (and submitted_at for grouping)
    connection = op.get_bind()
    
    # Create submissions for each unique combination of survey_id, rsvp_id, and submitted_at
    # This groups responses that were submitted together
    connection.execute(text("""
        INSERT INTO survey_submissions (survey_id, rsvp_id, submitted_at)
        SELECT DISTINCT survey_id, rsvp_id, submitted_at
        FROM survey_responses
        ORDER BY submitted_at
    """))
    
    # Step 3: Add submission_id column to survey_responses
    op.add_column('survey_responses', sa.Column('submission_id', sa.Integer(), nullable=True))
    
    # Step 4: Link existing responses to submissions
    # Match by survey_id, rsvp_id, and submitted_at
    connection.execute(text("""
        UPDATE survey_responses sr
        SET submission_id = (
            SELECT ss.id
            FROM survey_submissions ss
            WHERE ss.survey_id = sr.survey_id
              AND (ss.rsvp_id = sr.rsvp_id OR (ss.rsvp_id IS NULL AND sr.rsvp_id IS NULL))
              AND ss.submitted_at = sr.submitted_at
            LIMIT 1
        )
    """))
    
    # Step 5: Make submission_id NOT NULL after migration
    op.alter_column('survey_responses', 'submission_id', nullable=False)
    
    # Step 6: Add foreign key constraint
    op.create_foreign_key('fk_survey_responses_submission_id', 'survey_responses', 'survey_submissions', ['submission_id'], ['id'])
    
    # Step 7: Rename survey_responses table to question_responses
    op.rename_table('survey_responses', 'question_responses')
    
    # Step 8: Drop old columns (survey_id, rsvp_id, submitted_at) from question_responses
    op.drop_constraint('fk_survey_responses_submission_id', 'question_responses', type_='foreignkey')
    op.drop_column('question_responses', 'survey_id')
    op.drop_column('question_responses', 'rsvp_id')
    op.drop_column('question_responses', 'submitted_at')
    
    # Step 9: Re-add foreign key constraint after column changes
    op.create_foreign_key('fk_question_responses_submission_id', 'question_responses', 'survey_submissions', ['submission_id'], ['id'])
    
    # Step 10: Update index name
    op.drop_index(op.f('ix_survey_responses_id'), table_name='question_responses')
    op.create_index(op.f('ix_question_responses_id'), 'question_responses', ['id'], unique=False)


def downgrade() -> None:
    # Step 1: Rename question_responses back to survey_responses
    op.rename_table('question_responses', 'survey_responses')
    
    # Step 2: Add back old columns
    op.add_column('survey_responses', sa.Column('survey_id', sa.Integer(), nullable=True))
    op.add_column('survey_responses', sa.Column('rsvp_id', sa.Integer(), nullable=True))
    op.add_column('survey_responses', sa.Column('submitted_at', sa.DateTime(), nullable=True))
    
    # Step 3: Migrate data back from submissions
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE survey_responses sr
        SET survey_id = ss.survey_id,
            rsvp_id = ss.rsvp_id,
            submitted_at = ss.submitted_at
        FROM survey_submissions ss
        WHERE sr.submission_id = ss.id
    """))
    
    # Step 4: Make columns NOT NULL
    op.alter_column('survey_responses', 'survey_id', nullable=False)
    op.alter_column('survey_responses', 'submitted_at', nullable=False)
    
    # Step 5: Add back foreign keys
    op.create_foreign_key('fk_survey_responses_survey_id', 'survey_responses', 'surveys', ['survey_id'], ['id'])
    op.create_foreign_key('fk_survey_responses_rsvp_id', 'survey_responses', 'rsvps', ['rsvp_id'], ['id'])
    
    # Step 6: Drop submission_id column
    op.drop_constraint('fk_question_responses_submission_id', 'survey_responses', type_='foreignkey')
    op.drop_column('survey_responses', 'submission_id')
    
    # Step 7: Update index name
    op.drop_index(op.f('ix_question_responses_id'), table_name='survey_responses')
    op.create_index(op.f('ix_survey_responses_id'), 'survey_responses', ['id'], unique=False)
    
    # Step 8: Drop survey_submissions table
    op.drop_index(op.f('ix_survey_submissions_id'), table_name='survey_submissions')
    op.drop_table('survey_submissions')
