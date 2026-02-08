"""Pytest configuration and fixtures"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models.admin import Admin

# In-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    """Create a fresh database for each test"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create a test client with database override"""

    def override_get_db():
        try:
            yield db
        finally:
            pass

    # Clear rate limiter state before each test to avoid rate limit issues
    from app.core.security import login_rate_limiter, rate_limiter

    # Clear rate limiter dictionaries
    if hasattr(rate_limiter, "requests"):
        rate_limiter.requests.clear()
    if hasattr(login_rate_limiter, "requests"):
        login_rate_limiter.requests.clear()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    """Create a test admin user"""
    admin = Admin(
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def admin_token(client, admin_user):
    """Get an auth token for the test admin"""
    response = client.post(
        "/api/admin/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]
