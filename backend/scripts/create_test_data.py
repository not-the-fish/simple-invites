#!/usr/bin/env python3
"""
Script to create test data for the RSVP platform.
Run this after setting up the database and starting the backend.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def create_admin():
    """Create a test admin account"""
    print("Creating admin account...")
    response = requests.post(
        f"{BASE_URL}/api/admin/register",
        json={
            "email": "admin@test.com",
            "password": "testpassword123"
        }
    )
    
    if response.status_code == 201:
        print("✓ Admin created successfully")
        # Admin created, now login to get token
        return login_admin()
    elif response.status_code == 400:
        print("Admin already exists, logging in...")
        # Try to login instead
        return login_admin()
    else:
        print(f"✗ Failed to create admin: {response.status_code} - {response.text}")
        return None

def login_admin():
    """Login and get access token"""
    print("Logging in...")
    response = requests.post(
        f"{BASE_URL}/api/admin/login",
        json={
            "email": "admin@test.com",
            "password": "testpassword123"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Login successful")
        token = data.get("access_token")
        if token:
            return {"access_token": token}
        else:
            print(f"✗ No access_token in response: {data}")
            return None
    else:
        print(f"✗ Login failed: {response.status_code} - {response.text}")
        return None

def create_event(token):
    """Create a test event"""
    print("Creating test event...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/api/admin/events",
        headers=headers,
        json={
            "title": "Queer Kitchen Test Event",
            "description": "A test event for the RSVP platform. Join us for a fun evening!",
            "date": "2024-12-31T18:00:00",
            "location": "123 Test Street, Test City, ST 12345",
            "access_code": None
        }
    )
    
    if response.status_code == 201:
        event = response.json()
        print("✓ Event created successfully")
        print(f"\n📅 Event Details:")
        print(f"   Title: {event['title']}")
        print(f"   Invitation Token: {event['invitation_token']}")
        print(f"\n🔗 RSVP Link:")
        print(f"   http://localhost:5173/rsvp/{event['invitation_token']}")
        return event
    else:
        print(f"✗ Failed to create event: {response.status_code} - {response.text}")
        return None

def main():
    print("=" * 60)
    print("Creating Test Data for RSVP Platform")
    print("=" * 60)
    print()
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=2)
        if response.status_code != 200:
            print("✗ Backend is not responding correctly")
            sys.exit(1)
    except requests.exceptions.RequestException:
        print("✗ Backend is not running. Please start it first:")
        print("  cd backend")
        print("  source .venv/bin/activate")
        print("  uvicorn app.main:app --reload")
        sys.exit(1)
    
    print("✓ Backend is running")
    print()
    
    # Create admin or login
    admin_data = create_admin()
    if not admin_data:
        sys.exit(1)
    
    # Get access token
    token = admin_data.get("access_token")
    if not token:
        print("✗ No access token received")
        sys.exit(1)
    
    print()
    
    # Create event
    event = create_event(token)
    if not event:
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("✓ Test data created successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()

