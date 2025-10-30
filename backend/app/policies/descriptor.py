from typing import Dict, Set
import psycopg

from ..core.config import settings


def fetch_descriptor_paths(tenant_id: str, version: str) -> Dict[str, Set[str]]:
    """Return allowed path sets based on descriptor JSONB.

    Shapes:
      {"user": {"role","department",...}, "doc.metadata": {"tags","sensitivity"}}
    """
    with psycopg.connect(settings.database_url) as conn:
        cur = conn.execute(
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


