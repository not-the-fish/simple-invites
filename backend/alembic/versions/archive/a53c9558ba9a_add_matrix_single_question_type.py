"""add_matrix_single_question_type

Revision ID: a53c9558ba9a
Revises: a9fbd69d552c
Create Date: 2025-12-28 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a53c9558ba9a'
down_revision: Union[str, None] = 'a9fbd69d552c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add MATRIX_SINGLE to the existing questiontype enum
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'MATRIX_SINGLE'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type, which is complex
    # For now, we'll leave it as a no-op
    pass
