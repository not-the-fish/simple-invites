from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdminBase(BaseModel):
    email: EmailStr


class AdminCreate(AdminBase):
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="Password (8-72 characters, bcrypt limit is 72 bytes)",
    )


class AdminRegister(AdminCreate):
    """Schema for admin registration with optional registration token"""

    registration_token: str | None = Field(
        None, description="Registration token (required if admins already exist)"
    )


class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72, description="Password")


class AdminResponse(AdminBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    admin_id: int | None = None
