"""add_survey_id_to_events

Revision ID: 5e8f9a26d6f4
Revises: 6e6b6628bd3f
Create Date: 2025-12-28 23:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e8f9a26d6f4'
down_revision: Union[str, None] = '6e6b6628bd3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add survey_id column to events table
    op.add_column('events', sa.Column('survey_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f('fk_events_survey_id_surveys'),
        'events', 'surveys',
        ['survey_id'], ['id']
    )


def downgrade() -> None:
    # Remove survey_id column
    op.drop_constraint(op.f('fk_events_survey_id_surveys'), 'events', type_='foreignkey')
    op.drop_column('events', 'survey_id')
