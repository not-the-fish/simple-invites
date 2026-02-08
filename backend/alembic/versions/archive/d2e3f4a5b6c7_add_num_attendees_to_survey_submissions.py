"""add_num_attendees_to_survey_submissions

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2025-12-29 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add num_attendees column to survey_submissions table
    op.add_column('survey_submissions', sa.Column('num_attendees', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove num_attendees column from survey_submissions table
    op.drop_column('survey_submissions', 'num_attendees')

