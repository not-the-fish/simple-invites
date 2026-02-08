"""refactor_rsvp_to_survey_submission

Revision ID: b9b78e2473b3
Revises: 5e8f9a26d6f4
Create Date: 2025-12-28 19:28:42.943847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9b78e2473b3'
down_revision: Union[str, None] = '5e8f9a26d6f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add RSVP fields to survey_submissions table
    op.add_column('survey_submissions', sa.Column('identity', sa.Text(), nullable=True))
    op.add_column('survey_submissions', sa.Column('rsvp_response', sa.Enum('yes', 'no', 'maybe', name='rsvpresponse'), nullable=True))
    op.add_column('survey_submissions', sa.Column('email', sa.String(), nullable=True))
    op.add_column('survey_submissions', sa.Column('phone', sa.String(), nullable=True))
    
    # Step 2: Migrate data from rsvps to survey_submissions (if any exists)
    # This assumes rsvps are linked via rsvp_id in survey_submissions
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        SELECT ss.id, ss.rsvp_id, r.identity, r.response, r.email, r.phone
        FROM survey_submissions ss
        JOIN rsvps r ON ss.rsvp_id = r.id
        WHERE ss.rsvp_id IS NOT NULL
    """))
    
    for row in result:
        connection.execute(sa.text("""
            UPDATE survey_submissions
            SET identity = :identity,
                rsvp_response = :response,
                email = :email,
                phone = :phone
            WHERE id = :submission_id
        """), {
            'submission_id': row[0],
            'identity': row[2],
            'response': row[3],
            'email': row[4],
            'phone': row[5]
        })
    
    connection.commit()
    
    # Step 3: Drop foreign key constraint on survey_submissions.rsvp_id
    op.drop_constraint('survey_submissions_rsvp_id_fkey', 'survey_submissions', type_='foreignkey')
    
    # Step 4: Drop rsvp_id column from survey_submissions
    op.drop_column('survey_submissions', 'rsvp_id')
    
    # Step 5: Drop rsvps table (cascade will handle foreign keys)
    op.drop_table('rsvps')
    
    # Step 6: Make events.survey_id NOT NULL
    # First, ensure all events have a survey_id (create default surveys if needed)
    connection = op.get_bind()
    events_without_survey = connection.execute(sa.text("""
        SELECT id, title FROM events WHERE survey_id IS NULL
    """))
    
    import uuid
    for event_row in events_without_survey:
        # Create a default survey for events without one
        survey_token = f"event_{event_row[0]}_{uuid.uuid4().hex[:8]}"
        result = connection.execute(sa.text("""
            INSERT INTO surveys (event_id, title, survey_token, created_at, updated_at)
            VALUES (:event_id, :title, :token, NOW(), NOW())
            RETURNING id
        """), {
            'event_id': event_row[0],
            'title': f"{event_row[1]} - RSVP Survey",
            'token': survey_token
        })
        survey_id = result.fetchone()[0]
        
        # Update event with survey_id
        connection.execute(sa.text("""
            UPDATE events SET survey_id = :survey_id WHERE id = :event_id
        """), {
            'survey_id': survey_id,
            'event_id': event_row[0]
        })
    
    connection.commit()
    
    # Now make survey_id NOT NULL
    op.alter_column('events', 'survey_id', nullable=False)
    
    # Step 7: Drop the old relationship from events to rsvps (if it exists)
    # This is handled by dropping the rsvps table above


def downgrade() -> None:
    # Recreate rsvps table
    op.create_table(
        'rsvps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('identity', sa.Text(), nullable=False),
        sa.Column('response', sa.Enum('yes', 'no', 'maybe', name='rsvpresponse'), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add rsvp_id back to survey_submissions
    op.add_column('survey_submissions', sa.Column('rsvp_id', sa.Integer(), nullable=True))
    
    # Migrate data back (this is lossy - we can't perfectly reconstruct the rsvps)
    # For now, we'll create rsvps from survey_submissions that have RSVP fields
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        SELECT ss.id, ss.survey_id, ss.identity, ss.rsvp_response, ss.email, ss.phone, ss.submitted_at, s.event_id
        FROM survey_submissions ss
        JOIN surveys s ON ss.survey_id = s.id
        WHERE ss.rsvp_response IS NOT NULL AND s.event_id IS NOT NULL
    """))
    
    for row in result:
        # Create RSVP record
        rsvp_result = connection.execute(sa.text("""
            INSERT INTO rsvps (event_id, identity, response, email, phone, submitted_at)
            VALUES (:event_id, :identity, :response, :email, :phone, :submitted_at)
            RETURNING id
        """), {
            'event_id': row[7],
            'identity': row[2],
            'response': row[3],
            'email': row[4],
            'phone': row[5],
            'submitted_at': row[6]
        })
        rsvp_id = rsvp_result.fetchone()[0]
        
        # Link survey_submission to rsvp
        connection.execute(sa.text("""
            UPDATE survey_submissions SET rsvp_id = :rsvp_id WHERE id = :submission_id
        """), {
            'rsvp_id': rsvp_id,
            'submission_id': row[0]
        })
    
    # Add foreign key constraint back
    op.create_foreign_key('survey_submissions_rsvp_id_fkey', 'survey_submissions', 'rsvps', ['rsvp_id'], ['id'])
    
    # Make events.survey_id nullable again
    op.alter_column('events', 'survey_id', nullable=True)
    
    # Remove RSVP fields from survey_submissions
    op.drop_column('survey_submissions', 'phone')
    op.drop_column('survey_submissions', 'email')
    op.drop_column('survey_submissions', 'rsvp_response')
    op.drop_column('survey_submissions', 'identity')

