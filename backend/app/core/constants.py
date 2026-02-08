"""Application constants for magic numbers and configuration values"""

# Password and access code limits
BCRYPT_MAX_PASSWORD_BYTES = 72  # Bcrypt has a 72-byte limit for passwords
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72

# Rate limiting
RATE_LIMIT_MAX_REQUESTS = 100  # Requests per window for general endpoints
RATE_LIMIT_WINDOW_SECONDS = 60 * 15  # 15 minutes in seconds
LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5  # Login attempts per window
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60 * 15  # 15 minutes in seconds

# Request size limits
MAX_REQUEST_SIZE_BYTES = 1 * 1024 * 1024  # 1MB

# Token expiration
JWT_TOKEN_EXPIRE_MINUTES = 240  # 4 hours

# Input validation limits
MAX_TEXT_ANSWER_LENGTH = 10000  # 10KB for text answers
MAX_DATETIME_ANSWER_LENGTH = 100  # ISO datetime format is ~30 chars
MAX_MATRIX_SELECTIONS = 100  # Maximum selections for matrix questions
MAX_MATRIX_ITEM_LENGTH = 200  # Maximum length per matrix item
MAX_MATRIX_ROWS = 100  # Maximum rows for matrix_single questions

