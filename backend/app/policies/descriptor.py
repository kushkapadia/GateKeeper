from typing import Dict, Set
import json
import yaml
import psycopg

from ..core.config import settings


def save_descriptor(tenant_id: str, version: str, yaml_content: str) -> bool:
    """Save descriptor YAML to database as JSONB. tenant_id can be UUID string."""
    try:
        desc_dict = yaml.safe_load(yaml_content)
        if not desc_dict:
            return False
        with psycopg.connect(settings.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO schema_descriptors (tenant_id, version, descriptor)
                    VALUES (%s, %s, %s::jsonb)
                    ON CONFLICT (tenant_id, version) DO UPDATE
                    SET descriptor = EXCLUDED.descriptor
                    """,
                    (tenant_id, version, json.dumps(desc_dict)),
                )
            conn.commit()
        return True
    except Exception as e:
        print(f"Error saving descriptor: {e}")
        return False


def fetch_descriptor(tenant_id: str, version: str) -> Dict:
    """Fetch descriptor from database."""
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT descriptor FROM schema_descriptors WHERE tenant_id=%s AND version=%s",
                (tenant_id, version),
            )
            row = cur.fetchone()
            if not row:
                return {}
            return row[0] if isinstance(row[0], dict) else {}


def fetch_descriptor_paths(tenant_id: str, version: str) -> Dict[str, Set[str]]:
    """Return allowed path sets based on descriptor JSONB.

    Shapes:
      {"user": {"role","department",...}, "doc.metadata": {"tags","sensitivity"}}
    """
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT descriptor FROM schema_descriptors WHERE tenant_id=%s AND version=%s",
                (tenant_id, version),
            )
            row = cur.fetchone()
            if not row:
                return {"user": set(), "doc.metadata": set()}
            desc = row[0]
            user_paths = {item.get("name") for item in desc.get("user_attributes", [])}
            doc_paths = {item.get("name") for item in desc.get("doc_metadata", [])}
            return {"user": set(filter(None, user_paths)), "doc.metadata": set(filter(None, doc_paths))}


