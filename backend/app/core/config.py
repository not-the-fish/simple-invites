"""Application configuration management

Configuration is split by concern for better organization:
- Database settings
- Security settings
- CORS settings
- Environment settings
- Admin registration settings

All required settings are validated on startup.
"""

from pydantic import ConfigDict, Field, field_validator
from pydantic_settings import BaseSettings

from app.core.constants import JWT_TOKEN_EXPIRE_MINUTES


class DatabaseSettings(BaseSettings):
    """Database configuration"""

    DATABASE_URL: str = Field(
        ..., description="PostgreSQL database connection URL. Required for all environments."
    )

    model_config = ConfigDict(env_prefix="DB_", case_sensitive=True)


class SecuritySettings(BaseSettings):
    """Security configuration"""

    SECRET_KEY: str = Field(
        ...,
        min_length=32,
        description="Secret key for JWT token signing. Must be at least 32 characters. Required for all environments.",
    )

    ALGORITHM: str = Field(default="HS256", description="JWT algorithm. Default: HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=JWT_TOKEN_EXPIRE_MINUTES,
        description=f"JWT access token expiration in minutes. Default: {JWT_TOKEN_EXPIRE_MINUTES} (4 hours)",
    )

    ADMIN_REGISTRATION_TOKEN: str | None = Field(
        default=None,
        description="Registration token for creating additional admins. If set, registration requires this token. If not set and no admins exist, registration is allowed (for initial setup).",
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Validate secret key length"""
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    model_config = ConfigDict(env_prefix="SECURITY_", case_sensitive=True)


class CORSSettings(BaseSettings):
    """CORS configuration"""

    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="Comma-separated list of allowed CORS origins. Default: localhost ports for development",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = ConfigDict(env_prefix="CORS_", case_sensitive=True)


class EnvironmentSettings(BaseSettings):
    """Environment configuration"""

    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment: 'development', 'production', or 'testing'",
    )

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment value"""
        allowed = {"development", "production", "testing"}
        if v.lower() not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of: {', '.join(allowed)}")
        return v.lower()

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == "development"

    model_config = ConfigDict(env_prefix="ENV_", case_sensitive=True)


class Settings(BaseSettings):
    """Main application settings - combines all configuration groups"""

    # Database
    DATABASE_URL: str = Field(
        ..., description="PostgreSQL database connection URL. Required for all environments."
    )

    # Security
    SECRET_KEY: str = Field(
        ...,
        min_length=32,
        description="Secret key for JWT token signing. Must be at least 32 characters. Required for all environments.",
    )

    ALGORITHM: str = Field(default="HS256", description="JWT algorithm. Default: HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=JWT_TOKEN_EXPIRE_MINUTES,
        description=f"JWT access token expiration in minutes. Default: {JWT_TOKEN_EXPIRE_MINUTES} (4 hours)",
    )

    ADMIN_REGISTRATION_TOKEN: str | None = Field(
        default=None,
        description="Registration token for creating additional admins. If set, registration requires this token. If not set and no admins exist, registration is allowed (for initial setup).",
    )

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="Comma-separated list of allowed CORS origins. Default: localhost ports for development",
    )

    # Environment
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment: 'development', 'production', or 'testing'",
    )

    # Branding
    APP_NAME: str = Field(
        default="Simple Invites",
        description="Application name displayed in UI, API docs, and emails.",
    )

    # Email (optional - only required in production for RSVP confirmations)
    SMTP_EMAIL: str | None = Field(
        default=None,
        description="Gmail address for sending RSVP confirmations. Required in production.",
    )
    SMTP_APP_PASSWORD: str | None = Field(
        default=None,
        description="Gmail app password for SMTP. Required in production.",
    )
    SMTP_FROM_NAME: str | None = Field(
        default=None,
        description="Display name for outgoing emails. Defaults to APP_NAME if not set.",
    )

    @property
    def email_from_name(self) -> str:
        """Get the email sender name, defaulting to APP_NAME"""
        return self.SMTP_FROM_NAME or self.APP_NAME

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Validate secret key length"""
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment value"""
        allowed = {"development", "production", "testing"}
        if v.lower() not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of: {', '.join(allowed)}")
        return v.lower()

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == "development"

    model_config = ConfigDict(env_file=".env", case_sensitive=True)


def validate_settings() -> None:
    """Validate all required settings on startup"""
    try:
        # Settings loads from environment variables, so no args needed
        settings = Settings()  # type: ignore[call-arg]

        # Validate required settings
        if not settings.DATABASE_URL:
            raise ValueError("DATABASE_URL is required")

        if not settings.SECRET_KEY:
            raise ValueError("SECRET_KEY is required")

        # Log configuration status (without sensitive values)
        import logging

        logger = logging.getLogger(__name__)
        logger.info(
            "Configuration loaded successfully",
            extra={
                "extra_fields": {
                    "environment": settings.ENVIRONMENT,
                    "cors_origins_count": len(settings.cors_origins_list),
                    "has_admin_registration_token": settings.ADMIN_REGISTRATION_TOKEN is not None,
                }
            },
        )

    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Configuration validation failed: {e}")
        raise


# Create settings instance (loads from environment variables)
settings = Settings()  # type: ignore[call-arg]

# Validate on module import
validate_settings()
