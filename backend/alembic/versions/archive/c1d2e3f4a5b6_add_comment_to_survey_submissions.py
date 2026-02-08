"""add_comment_to_survey_submissions

Revision ID: c1d2e3f4a5b6
Revises: b9b78e2473b3
Create Date: 2025-12-29 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b9b78e2473b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add comment column to survey_submissions table
    op.add_column('survey_submissions', sa.Column('comment', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove comment column from survey_submissions table
    op.drop_column('survey_submissions', 'comment')

