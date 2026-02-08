#!/usr/bin/env python3
"""
Script to delete an existing admin user and recreate it.
Usage: python scripts/delete_and_recreate_admin.py <email> <password>
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.admin import Admin
from app.core.security import get_password_hash


def delete_and_recreate_admin(email: str, password: str):
    """Delete admin by email and recreate with new password"""
    db: Session = SessionLocal()
    
    try:
        # Find and delete existing admin
        admin = db.query(Admin).filter(Admin.email == email).first()
        
        if admin:
            print(f"Found admin with email: {email}")
            print(f"  ID: {admin.id}")
            print(f"  Created: {admin.created_at}")
            
            # Check if admin has created events
            event_count = len(admin.events) if admin.events else 0
            if event_count > 0:
                print(f"  ⚠️  Warning: This admin has created {event_count} event(s)")
                response = input("  Delete anyway? (yes/no): ")
                if response.lower() != 'yes':
                    print("Cancelled.")
                    return
            
            db.delete(admin)
            db.commit()
            print(f"✓ Deleted admin: {email}")
        else:
            print(f"ℹ️  No admin found with email: {email}")
        
        # Create new admin
        print(f"\nCreating new admin with email: {email}")
        hashed_password = get_password_hash(password)
        new_admin = Admin(
            email=email,
            hashed_password=hashed_password,
            is_active=True
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        
        print(f"✓ Created new admin:")
        print(f"  ID: {new_admin.id}")
        print(f"  Email: {new_admin.email}")
        print(f"  Active: {new_admin.is_active}")
        print(f"\nYou can now login with:")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python scripts/delete_and_recreate_admin.py <email> <password>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    delete_and_recreate_admin(email, password)

