# JSON Column Structure Documentation

## Overview

Several models use JSON columns to store flexible, structured data. This document describes the expected structure for each JSON column.

## Question.options

**Model**: `Question`  
**Type**: `JSON` (stored as PostgreSQL JSONB)  
**Purpose**: Stores question configuration based on question type

### Structure by Question Type

#### 1. Multiple Choice / Checkbox (`multiple_choice`, `checkbox`)

```json
["Option 1", "Option 2", "Option 3"]
```

Simple array of strings representing the available options.

**Example**:
```json
["Vegetarian", "Vegan", "Gluten-free", "Dairy-free"]
```

#### 2. Matrix (`matrix`)

```json
{
  "rows": ["Row 1", "Row 2", "Row 3"],
  "columns": ["Column 1", "Column 2"]
}
```

Object with `rows` and `columns` arrays. Answers are stored as strings in format `"Row Column"`.

**Example**:
```json
{
  "rows": ["Monday", "Wednesday", "Friday"],
  "columns": ["Morning", "Evening"]
}
```

Answer format: `"Monday Morning"`, `"Wednesday Evening"`, etc.

#### 3. Matrix Single (`matrix_single`)

```json
{
  "rows": ["Row 1", "Row 2", "Row 3"],
  "columns": ["Column 1", "Column 2"]
}
```

Same structure as `matrix`, but answers are stored as objects mapping row to column.

**Example**:
```json
{
  "rows": ["Peanuts", "Tree nuts", "Dairy"],
  "columns": ["Can have in home", "Can't have in home", "Severe allergy"]
}
```

Answer format: `{"Peanuts": "Can't have in home", "Dairy": "Severe allergy"}`

#### 4. Other Question Types

For `text`, `yes_no`, `date_time`, `number`, `email`, `phone`, `url`:
- `options` is typically `null` or an empty object `{}`
- No options are needed for these question types

## QuestionResponse.answer

**Model**: `QuestionResponse`  
**Type**: `JSON` (stored as PostgreSQL JSONB)  
**Purpose**: Stores the user's answer to a question

### Structure by Question Type

#### 1. Text (`text`)

```json
"User's text response here"
```

Simple string value.

**Example**:
```json
"I'm excited to attend and will bring a dessert!"
```

#### 2. Yes/No (`yes_no`)

```json
true
```
or
```json
false
```

Boolean value.

**Example**:
```json
true
```

#### 3. Multiple Choice (`multiple_choice`)

**Standard option selected**:
```json
"Option Name"
```

**"Other" option selected** (when `allow_other` is true):
```json
{
  "value": "other",
  "other_text": "Custom option text"
}
```

**Examples**:
```json
"Vegetarian"
```

```json
{
  "value": "other",
  "other_text": "Pescatarian"
}
```

#### 4. Checkbox (`checkbox`)

**Standard options selected**:
```json
["Option 1", "Option 2"]
```

**With "Other" option** (when `allow_other` is true):
```json
{
  "values": ["Option 1", "other"],
  "other_text": "Custom option text"
}
```

**Examples**:
```json
["Vegetarian", "Gluten-free"]
```

```json
{
  "values": ["Vegetarian", "other"],
  "other_text": "Pescatarian"
}
```

#### 5. Matrix (`matrix`)

```json
["Row1 Column1", "Row2 Column2"]
```

Array of strings in format `"Row Column"`.

**Example**:
```json
["Monday Morning", "Wednesday Evening"]
```

#### 6. Matrix Single (`matrix_single`)

```json
{
  "Row1": "Column1",
  "Row2": "Column2"
}
```

Object mapping row names to column names.

**Example**:
```json
{
  "Peanuts": "Can't have in home",
  "Dairy": "Severe allergy"
}
```

#### 7. Date/Time (`date_time`)

```json
"2024-12-25T18:00:00Z"
```

ISO 8601 datetime string (UTC).

**Example**:
```json
"2024-12-25T18:00:00Z"
```

#### 8. Number (`number`)

```json
42
```

Numeric value (integer or float).

**Example**:
```json
5
```

#### 9. Email (`email`)

```json
"user@example.com"
```

Email address string.

**Example**:
```json
"attendee@example.com"
```

#### 10. Phone (`phone`)

```json
"+1-555-123-4567"
```

Phone number string (format not strictly enforced).

**Example**:
```json
"+1-555-123-4567"
```

#### 11. URL (`url`)

```json
"https://example.com"
```

URL string.

**Example**:
```json
"https://mywebsite.com"
```

## Validation

All answers are validated in `app/api/surveys.py` in the `_validate_answer()` function. The validation ensures:

1. Type correctness (string, boolean, number, array, object)
2. Required fields are present
3. Values match expected options (for choice questions)
4. Length limits are respected
5. Format validation (for email, phone, URL, datetime)

## Database Considerations

- PostgreSQL JSONB columns are used for efficient querying and indexing
- JSONB supports indexing on specific paths (e.g., `answer->>'value'`)
- Consider adding indexes if querying specific answer patterns frequently

## Migration Notes

When modifying JSON structures:
1. Update this documentation
2. Update validation logic in `_validate_answer()`
3. Consider data migration for existing records
4. Update frontend TypeScript types if applicable


