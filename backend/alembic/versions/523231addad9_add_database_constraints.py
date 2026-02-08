"""add_database_constraints

Revision ID: 523231addad9
Revises: 30e40a9360da
Create Date: 2025-01-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '523231addad9'
down_revision: Union[str, None] = '30e40a9360da'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add CHECK constraint for num_attendees >= 1
    # Only applies when num_attendees is not NULL
    op.execute("""
        ALTER TABLE survey_submissions
        ADD CONSTRAINT check_num_attendees_positive
        CHECK (num_attendees IS NULL OR num_attendees >= 1)
    """)
    
    # Add CHECK constraint for question.order >= 0
    op.execute("""
        ALTER TABLE questions
        ADD CONSTRAINT check_order_non_negative
        CHECK ("order" >= 0)
    """)


def downgrade() -> None:
    # Remove CHECK constraints
    op.execute("""
        ALTER TABLE survey_submissions
        DROP CONSTRAINT IF EXISTS check_num_attendees_positive
    """)
    
    op.execute("""
        ALTER TABLE questions
        DROP CONSTRAINT IF EXISTS check_order_non_negative
    """)
