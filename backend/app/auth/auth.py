import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
import psycopg

from ..core.config import settings

JWT_SECRET = settings.app_name + "_secret_key_change_in_prod"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_jwt_token(tenant_id: str, tenant_name: str) -> str:
    """Create a JWT token for a tenant."""
    payload = {
        "tenant_id": str(tenant_id),
        "tenant_name": tenant_name,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def authenticate_tenant(name: str, password: str) -> Optional[dict]:
    """Authenticate a tenant and return tenant info if successful."""
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, password_hash FROM tenants WHERE name = %s",
                (name,),
            )
            row = cur.fetchone()
            if not row:
                return None
            tenant_id, tenant_name, password_hash = row
            if verify_password(password, password_hash):
                return {"id": str(tenant_id), "name": tenant_name}
    return None

