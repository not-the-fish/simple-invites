"""Tests for authentication endpoints"""

from fastapi import status


def test_login_success(client, admin_user):
    """Test successful admin login"""
    response = client.post(
        "/api/admin/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_email(client):
    """Test login with invalid email"""
    response = client.post(
        "/api/admin/login", json={"email": "nonexistent@example.com", "password": "password123"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_invalid_password(client, admin_user):
    """Test login with invalid password"""
    response = client.post(
        "/api/admin/login", json={"email": "test@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_admin(client, admin_token):
    """Test getting current admin info with valid token"""
    response = client.get("/api/admin/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "is_active" in data


def test_get_current_admin_no_token(client):
    """Test getting current admin info without token"""
    response = client.get("/api/admin/me")
    # HTTPBearer returns 401 when no token is provided
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_admin_invalid_token(client):
    """Test getting current admin info with invalid token"""
    response = client.get("/api/admin/me", headers={"Authorization": "Bearer invalid_token"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
