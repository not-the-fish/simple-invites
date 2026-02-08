"""add_matrix_question_type

Revision ID: a9fbd69d552c
Revises: 18b95ba2e3e4
Create Date: 2025-12-28 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9fbd69d552c'
down_revision: Union[str, None] = '18b95ba2e3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add MATRIX to the existing questiontype enum
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'MATRIX'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type, which is complex
    # For now, we'll leave it as a no-op
    pass
