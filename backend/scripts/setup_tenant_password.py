#!/usr/bin/env python3
"""Script to set password for a tenant (for initial setup).
Usage: python backend/scripts/setup_tenant_password.py acme admin
"""
import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from backend.app.auth.auth import hash_password
from backend.app.core.config import settings
import psycopg

if len(sys.argv) < 3:
    print("Usage: python setup_tenant_password.py <tenant_name> <password>")
    sys.exit(1)

tenant_name = sys.argv[1]
password = sys.argv[2]

hashed = hash_password(password)

with psycopg.connect(settings.database_url) as conn:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE tenants SET password_hash = %s WHERE name = %s",
            (hashed, tenant_name),
        )
        if cur.rowcount == 0:
            print(f"Tenant '{tenant_name}' not found!")
            sys.exit(1)
    conn.commit()

print(f"Password updated for tenant '{tenant_name}'")

