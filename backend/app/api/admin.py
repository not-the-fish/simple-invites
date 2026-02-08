from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_csrf_token,
    get_password_hash,
    login_rate_limiter,
    verify_password,
)
from app.database import get_db
from app.models.admin import Admin
from app.schemas.admin import (
    AdminCreate,
    AdminLogin,
    AdminRegister,
    AdminResponse,
    Token,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
async def login(credentials: AdminLogin, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate admin and return JWT token.

    **Rate Limited**: 5 attempts per 15 minutes per IP address.

    **Request Body**:
    - `email` (string, required): Admin email address
    - `password` (string, required): Admin password (8-72 characters)

    **Response**:
    - `access_token` (string): JWT token for authentication
    - `token_type` (string): Always "bearer"

    **Example Request**:
    ```json
    {
      "email": "admin@example.com",
      "password": "securepassword123"
    }
    ```

    **Example Response**:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer"
    }
    ```

    **Error Responses**:
    - `401 Unauthorized`: Incorrect email or password
    - `403 Forbidden`: Inactive admin account
    - `429 Too Many Requests`: Rate limit exceeded (see Retry-After header)
    """
    # Rate limiting for login endpoint to prevent brute force attacks
    client_ip = request.client.host if request.client else "unknown"

    if not login_rate_limiter.is_allowed(client_ip):
        remaining = login_rate_limiter.get_remaining_attempts(client_ip)
        reset_time = login_rate_limiter.get_reset_time(client_ip)

        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": "Too many login attempts. Please try again later.",
                "retry_after": reset_time,
                "remaining_attempts": remaining,
            },
            headers={
                "Retry-After": str(reset_time),
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(int(__import__("time").time()) + reset_time),
            },
        )

    admin = db.query(Admin).filter(Admin.email == credentials.email).first()

    if not admin or not verify_password(credentials.password, str(admin.hashed_password)):
        # Still count failed attempts for rate limiting
        remaining = login_rate_limiter.get_remaining_attempts(client_ip)
        reset_time = login_rate_limiter.get_reset_time(client_ip)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={
                "WWW-Authenticate": "Bearer",
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(int(__import__("time").time()) + reset_time),
            },
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive admin account",
        )

    access_token = create_access_token(data={"sub": admin.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def register(registration_data: AdminRegister, db: Session = Depends(get_db)):
    """
    Create a new admin account.

    **Security Rules**:
    - If no admins exist: Registration is allowed (for initial setup)
    - If admins exist and ADMIN_REGISTRATION_TOKEN is set: `registration_token` in request body must match
    - If admins exist and ADMIN_REGISTRATION_TOKEN is not set: Registration is disabled (use `/api/admin/admins` endpoint with auth)

    **Request Body**:
    - `email` (string, required): Admin email address (must be unique)
    - `password` (string, required): Admin password (8-72 characters)
    - `registration_token` (string, optional): Required if admins already exist

    **Response**: Created admin object (without password hash)

    **Example Request** (initial setup):
    ```json
    {
      "email": "admin@example.com",
      "password": "securepassword123"
    }
    ```

    **Example Request** (with existing admins):
    ```json
    {
      "email": "newadmin@example.com",
      "password": "securepassword123",
      "registration_token": "your-registration-token"
    }
    ```

    **Error Responses**:
    - `400 Bad Request`: Email already registered
    - `403 Forbidden`: Registration disabled or invalid registration token
    """
    # Check if admin with this email already exists
    existing_admin = db.query(Admin).filter(Admin.email == registration_data.email).first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Security check: Only allow registration if:
    # 1. No admins exist yet (initial setup), OR
    # 2. ADMIN_REGISTRATION_TOKEN is set and provided correctly
    admin_count = db.query(Admin).count()

    if admin_count > 0:
        # Admins exist - require registration token
        if not settings.ADMIN_REGISTRATION_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Registration is disabled. Use the authenticated /api/admin/admins endpoint to create additional admins.",
            )

        if (
            not registration_data.registration_token
            or registration_data.registration_token != settings.ADMIN_REGISTRATION_TOKEN
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing registration token",
            )

    # Create new admin
    hashed_password = get_password_hash(registration_data.password)
    admin = Admin(email=registration_data.email, hashed_password=hashed_password, is_active=True)
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return admin


@router.get("/me", response_model=AdminResponse)
async def get_current_admin_info(current_admin: Admin = Depends(get_current_admin)):
    """Get current authenticated admin information"""
    return current_admin


@router.get("/csrf-token")
async def get_csrf_token(current_admin: Admin = Depends(get_current_admin)):
    """Get CSRF token for admin forms"""
    csrf_token = generate_csrf_token()
    return {"csrf_token": csrf_token}


@router.get("/admins", response_model=list[AdminResponse])
async def list_admins(
    current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)
):
    """List all admins (admin only)"""
    admins = db.query(Admin).all()
    return admins


@router.post("/admins", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    admin_data: AdminCreate,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new admin (admin only)"""
    # Check if admin with this email already exists
    existing_admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new admin
    hashed_password = get_password_hash(admin_data.password)
    admin = Admin(email=admin_data.email, hashed_password=hashed_password, is_active=True)
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return admin
