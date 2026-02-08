#!/usr/bin/env python3
"""
Directly create an admin account in the database.
This ensures password hashing is done correctly.
"""
import sys
import os

# Add backend to path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

# Change to backend directory to load .env file
os.chdir(backend_dir)

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.admin import Admin
from app.core.security import get_password_hash, verify_password

def create_admin_direct(email: str, password: str) -> bool:
    """Create an admin account directly in the database"""
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing = db.query(Admin).filter(Admin.email == email).first()
        if existing:
            # Verify the password works
            if verify_password(password, existing.hashed_password):
                print(f"Admin {email} already exists with correct password")
                return True
            else:
                # Password doesn't match - update it
                print(f"Admin {email} exists but password doesn't match, updating...")
                existing.hashed_password = get_password_hash(password)
                db.commit()
                # Verify it works
                if verify_password(password, existing.hashed_password):
                    print(f"Password updated successfully for {email}")
                    return True
                else:
                    print(f"ERROR: Password update failed verification")
                    return False
        
        # Create new admin
        hashed_password = get_password_hash(password)
        admin = Admin(
            email=email,
            hashed_password=hashed_password,
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        # Verify the password works
        if verify_password(password, admin.hashed_password):
            print(f"Admin {email} created successfully")
            return True
        else:
            print(f"ERROR: Admin created but password verification failed")
            db.delete(admin)
            db.commit()
            return False
            
    except Exception as e:
        print(f"ERROR: Failed to create admin: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: create_admin_direct.py <email> <password>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    success = create_admin_direct(email, password)
    sys.exit(0 if success else 1)

