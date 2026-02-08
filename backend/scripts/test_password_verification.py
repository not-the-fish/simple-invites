#!/usr/bin/env python3
"""Test password hashing and verification"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import get_password_hash, verify_password

# Test password
test_password = sys.argv[1] if len(sys.argv) > 1 else "test123"

print(f"Testing password: {test_password}")
print()

# Hash the password
hashed = get_password_hash(test_password)
print(f"Hash (first 60 chars): {hashed[:60]}...")
print(f"Hash length: {len(hashed)}")
print()

# Verify with correct password
result_correct = verify_password(test_password, hashed)
print(f"Verification with correct password: {result_correct}")
print()

# Verify with wrong password
result_wrong = verify_password("wrongpassword", hashed)
print(f"Verification with wrong password: {result_wrong}")
print()

if result_correct and not result_wrong:
    print("✅ Password hashing/verification works correctly!")
else:
    print("❌ Password hashing/verification has issues!")

