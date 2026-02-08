"""add_allow_other_to_questions

Revision ID: 6e6b6628bd3f
Revises: a53c9558ba9a
Create Date: 2025-12-28 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e6b6628bd3f'
down_revision: Union[str, None] = 'a53c9558ba9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add allow_other column to questions table
    op.add_column('questions', sa.Column('allow_other', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove allow_other column
    op.drop_column('questions', 'allow_other')
