"""Policy CRUD operations backed by PostgreSQL.

Tables used:
    policies        — metadata (tenant_id, name, labels, created_by)
    policy_versions — versioned content (stage, priority, content JSONB, distilled_prompt)
"""

import hashlib
import json
from typing import Any, Dict, List, Optional

import psycopg

from ..core.config import settings


def _hash_content(content: dict) -> str:
    raw = json.dumps(content, sort_keys=True)
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()[:16]


def count_all_policies(version: str = "v0") -> int:
    """Total number of enabled policy versions across all tenants."""
    try:
        with psycopg.connect(settings.database_url) as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM policy_versions WHERE version = %s AND enabled = TRUE",
                (version,),
            ).fetchone()
            return row[0] if row else 0
    except Exception:
        return 0


def list_policies(tenant_id: str, version: str = "v0") -> List[Dict[str, Any]]:
    with psycopg.connect(settings.database_url) as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.name, p.labels, p.created_by, p.created_at,
                   pv.stage, pv.priority, pv.enabled, pv.content,
                   pv.distilled_prompt, pv.version, pv.created_at AS version_created_at
            FROM policies p
            JOIN policy_versions pv ON pv.policy_id = p.id
            WHERE p.tenant_id = %s AND pv.version = %s
            ORDER BY pv.priority DESC, p.created_at DESC
            """,
            (tenant_id, version),
        ).fetchall()

    result = []
    for row in rows:
        content = row[8] if isinstance(row[8], dict) else json.loads(row[8])
        result.append({
            "id": str(row[0]),
            "name": row[1],
            "labels": row[2] or {},
            "created_by": row[3],
            "created_at": row[4].isoformat() if row[4] else None,
            "stage": row[5],
            "priority": row[6],
            "enabled": row[7],
            "content": content,
            "distilled_prompt": row[9] or "",
            "version": row[10],
        })
    return result


def get_policy(tenant_id: str, policy_id: str, version: str = "v0") -> Optional[Dict[str, Any]]:
    with psycopg.connect(settings.database_url) as conn:
        row = conn.execute(
            """
            SELECT p.id, p.name, p.labels, p.created_by, p.created_at,
                   pv.stage, pv.priority, pv.enabled, pv.content,
                   pv.distilled_prompt, pv.version
            FROM policies p
            JOIN policy_versions pv ON pv.policy_id = p.id
            WHERE p.tenant_id = %s AND p.id = %s::uuid AND pv.version = %s
            """,
            (tenant_id, policy_id, version),
        ).fetchone()

    if not row:
        return None

    content = row[8] if isinstance(row[8], dict) else json.loads(row[8])
    return {
        "id": str(row[0]),
        "name": row[1],
        "labels": row[2] or {},
        "created_by": row[3],
        "created_at": row[4].isoformat() if row[4] else None,
        "stage": row[5],
        "priority": row[6],
        "enabled": row[7],
        "content": content,
        "distilled_prompt": row[9] or "",
        "version": row[10],
    }


def create_policy(
    tenant_id: str,
    name: str,
    stage: str,
    content: Dict[str, Any],
    priority: int = 100,
    enabled: bool = True,
    distilled_prompt: str = "",
    labels: Optional[Dict[str, Any]] = None,
    version: str = "v0",
    created_by: str = "studio",
) -> Dict[str, Any]:
    content_hash = _hash_content(content)

    with psycopg.connect(settings.database_url) as conn:
        with conn.transaction():
            row = conn.execute(
                """
                INSERT INTO policies (tenant_id, name, labels, created_by)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (tenant_id, name, json.dumps(labels or {}), created_by),
            ).fetchone()
            policy_id = row[0]

            conn.execute(
                """
                INSERT INTO policy_versions (policy_id, version, hash, stage, priority, content, enabled, distilled_prompt)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (policy_id, version, content_hash, stage, priority,
                 json.dumps(content), enabled, distilled_prompt),
            )

    return get_policy(tenant_id, str(policy_id), version)  # type: ignore[return-value]


def update_policy(
    tenant_id: str,
    policy_id: str,
    name: Optional[str] = None,
    stage: Optional[str] = None,
    content: Optional[Dict[str, Any]] = None,
    priority: Optional[int] = None,
    enabled: Optional[bool] = None,
    distilled_prompt: Optional[str] = None,
    labels: Optional[Dict[str, Any]] = None,
    version: str = "v0",
) -> Optional[Dict[str, Any]]:
    with psycopg.connect(settings.database_url) as conn:
        with conn.transaction():
            if name is not None or labels is not None:
                parts, params = [], []
                if name is not None:
                    parts.append("name = %s")
                    params.append(name)
                if labels is not None:
                    parts.append("labels = %s")
                    params.append(json.dumps(labels))
                params.extend([tenant_id, policy_id])
                conn.execute(
                    f"UPDATE policies SET {', '.join(parts)} WHERE tenant_id = %s AND id = %s::uuid",
                    params,
                )

            pv_parts, pv_params = [], []
            if stage is not None:
                pv_parts.append("stage = %s")
                pv_params.append(stage)
            if content is not None:
                pv_parts.append("content = %s")
                pv_params.append(json.dumps(content))
                pv_parts.append("hash = %s")
                pv_params.append(_hash_content(content))
            if priority is not None:
                pv_parts.append("priority = %s")
                pv_params.append(priority)
            if enabled is not None:
                pv_parts.append("enabled = %s")
                pv_params.append(enabled)
            if distilled_prompt is not None:
                pv_parts.append("distilled_prompt = %s")
                pv_params.append(distilled_prompt)

            if pv_parts:
                pv_params.extend([policy_id, version])
                conn.execute(
                    f"UPDATE policy_versions SET {', '.join(pv_parts)} WHERE policy_id = %s::uuid AND version = %s",
                    pv_params,
                )

    return get_policy(tenant_id, policy_id, version)


def delete_policy(tenant_id: str, policy_id: str) -> bool:
    with psycopg.connect(settings.database_url) as conn:
        result = conn.execute(
            "DELETE FROM policies WHERE tenant_id = %s AND id = %s::uuid RETURNING id",
            (tenant_id, policy_id),
        ).fetchone()
        conn.commit()
    return result is not None


def toggle_policy(tenant_id: str, policy_id: str, enabled: bool, version: str = "v0") -> Optional[Dict[str, Any]]:
    return update_policy(tenant_id, policy_id, enabled=enabled, version=version)
