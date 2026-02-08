# Data Model Documentation

## Event-Survey Circular Foreign Key Relationship

### Overview

The `Event` and `Survey` models have a circular foreign key relationship:

- `Event.survey_id` → `Survey.id` (Event references Survey)
- `Survey.event_id` → `Event.id` (Survey references Event)

### Why This Design?

This circular relationship exists to support the following use cases:

1. **Event Creation with New Survey**: When creating an event with a new survey, we need to:
   - Create the survey first (without an event_id)
   - Create the event with the survey_id
   - Update the survey with the event_id after event creation

2. **Event Creation with Existing Survey**: When linking an event to an existing survey:
   - The survey already exists
   - The event is created with the survey_id
   - The survey's event_id may already be set or can be updated

3. **Survey Reusability**: Surveys can be created independently and later linked to events, or created as part of event creation.

### Implementation Details

Both foreign keys are **nullable** (`nullable=True`), which allows:

- Creating a survey before its event exists (`survey.event_id = None`)
- Creating an event that will have a survey created later (though this is not the current implementation)
- Breaking the relationship if needed (e.g., when deleting an event, we set `survey.event_id = None`)

### Database Constraints

- `Event.survey_id` is nullable and references `Survey.id`
- `Survey.event_id` is nullable and references `Event.id`
- Both use `ondelete="SET NULL"` to handle cascading deletes gracefully

### Code Patterns

When creating an event with a new survey:

```python
# 1. Create survey (event_id = None initially)
survey = Survey(event_id=None, ...)
db.add(survey)
db.flush()  # Get survey.id

# 2. Create event with survey_id
event = Event(survey_id=survey.id, ...)
db.add(event)
db.flush()  # Get event.id

# 3. Update survey with event_id
survey.event_id = event.id
db.commit()
```

When deleting an event:

```python
# Break the circular relationship
if event.survey_id:
    survey = db.query(Survey).filter(Survey.id == event.survey_id).first()
    if survey:
        survey.event_id = None  # Break the back-reference

# Now safe to delete the event
db.delete(event)
db.commit()
```

### Alternative Approaches Considered

1. **Single Direction (Event → Survey only)**: Would require always creating surveys before events, limiting flexibility.

2. **Junction Table**: Would add complexity and an extra join for a 1:1 relationship.

3. **No Back-Reference**: Would make it harder to navigate from survey to event, requiring a query.

The current design balances flexibility with simplicity for this use case.


## Event Model

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `title` | String | Event title |
| `description` | Text | Event description (nullable) |
| `date` | DateTime | Event date and time |
| `location` | String | Event location (nullable) |
| `invitation_token` | String | Unique token for public access |
| `access_code` | String | Bcrypt hash of access code (nullable) |
| `show_rsvp_list` | Boolean | Whether to show guest names publicly (default: false) |
| `survey_id` | Integer | Foreign key to Survey |
| `created_by` | Integer | Foreign key to Admin |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |


## SurveySubmission Model (RSVPs)

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `survey_id` | Integer | Foreign key to Survey |
| `identity` | String | Guest name/alias |
| `rsvp_response` | Enum | YES, NO, or MAYBE |
| `num_attendees` | Integer | Number of guests (nullable) |
| `email` | String | Guest email (nullable) |
| `phone` | String | Guest phone (nullable) |
| `comment` | String | Guest comment (nullable) |
| `edit_token_hash` | String | Bcrypt hash of edit token for passwordless editing (nullable) |
| `submitted_at` | DateTime | Submission timestamp |

### Edit Token System

The `edit_token_hash` column enables passwordless RSVP editing:

1. **Token Generation**: When an RSVP is submitted, a cryptographically secure token is generated using `secrets.token_urlsafe(32)`.

2. **Storage**: The token is hashed with bcrypt and stored in `edit_token_hash`. The plain token is returned to the user only once.

3. **Client Storage**: The frontend stores the token in `localStorage` for device-based recognition.

4. **Email Backup**: If the user provides an email, the token is included in the confirmation email URL fragment (not sent to server).

5. **Verification**: When editing, the provided token is verified against the stored hash using bcrypt comparison.


