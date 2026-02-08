"""add_edit_token_hash_to_submissions

Revision ID: a1b2c3d4e5f6
Revises: 523231addad9
Create Date: 2026-02-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '523231addad9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add edit_token_hash column for passwordless RSVP editing
    op.add_column(
        'survey_submissions',
        sa.Column('edit_token_hash', sa.String(), nullable=True)
    )
    # Add index for faster lookups by edit token
    op.create_index(
        'ix_survey_submissions_edit_token_hash',
        'survey_submissions',
        ['edit_token_hash'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_survey_submissions_edit_token_hash', table_name='survey_submissions')
    op.drop_column('survey_submissions', 'edit_token_hash')
