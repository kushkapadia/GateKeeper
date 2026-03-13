"""Structured audit logging with DB persistence.

Two responsibilities:
  1. Structured console logging via structlog (JSON lines to stdout).
  2. Writing audit records to the ``audit_index`` table in PostgreSQL so the
     Studio dashboard can query enforcement history.
"""

import hashlib
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg
import structlog

from ..core.config import settings


# ── Structured console logging ─────────────────────────────────────────────

def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )


def get_logger():
    return structlog.get_logger()


# ── Audit-record persistence ──────────────────────────────────────────────

def _user_id_hash(user: Dict[str, Any]) -> str:
    """Deterministic pseudonymised hash of the user identity."""
    raw = f"{user.get('role', '')}:{user.get('department', '')}:{user.get('id', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def record_audit(
    *,
    stage: str,
    user: Dict[str, Any],
    request: Dict[str, Any],
    decision: str,
    trace: List[Dict[str, Any]],
    latency_ms: float,
    correlation_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> str:
    """Persist an audit row and return the generated audit_id."""
    audit_id = f"aud-{uuid.uuid4().hex[:12]}"
    log = get_logger()

    log.info(
        "enforcement_audit",
        audit_id=audit_id,
        stage=stage,
        decision=decision,
        policies_fired=len(trace),
        latency_ms=latency_ms,
        user_hash=_user_id_hash(user),
    )

    try:
        with psycopg.connect(settings.database_url) as conn:
            conn.execute(
                """
                INSERT INTO audit_index
                    (audit_id, tenant_id, correlation_id, ts, stage,
                     policy_version, user_id_hash, decision, policies, metrics)
                VALUES
                    (%s, %s, %s, %s, %s,
                     %s, %s, %s, %s::jsonb, %s::jsonb)
                """,
                (
                    audit_id,
                    tenant_id or "00000000-0000-0000-0000-000000000000",
                    correlation_id,
                    datetime.now(timezone.utc),
                    stage,
                    settings.policy_version,
                    _user_id_hash(user),
                    decision,
                    psycopg.types.json.Json(trace),
                    psycopg.types.json.Json({
                        "latency_ms": latency_ms,
                        "user_role": user.get("role", ""),
                        "user_department": user.get("department", ""),
                    }),
                ),
            )
    except Exception:
        log.exception("audit_write_failed", audit_id=audit_id)

    return audit_id


# ── Querying audit logs ───────────────────────────────────────────────────

def fetch_audit_logs(
    *,
    limit: int = 50,
    offset: int = 0,
    stage: Optional[str] = None,
    decision: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return recent audit records, newest-first."""
    clauses: List[str] = []
    params: List[Any] = []

    if stage:
        clauses.append("stage = %s")
        params.append(stage)
    if decision:
        clauses.append("decision = %s")
        params.append(decision)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params.extend([limit, offset])

    try:
        with psycopg.connect(settings.database_url) as conn:
            cur = conn.execute(
                f"""
                SELECT audit_id, tenant_id, correlation_id, ts, stage,
                       policy_version, user_id_hash, decision, policies, metrics
                FROM audit_index
                {where}
                ORDER BY ts DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params),
            )
            rows = cur.fetchall()
            cols = [
                "audit_id", "tenant_id", "correlation_id", "ts", "stage",
                "policy_version", "user_id_hash", "decision", "policies", "metrics",
            ]
            results = []
            for row in rows:
                entry = dict(zip(cols, row))
                if entry.get("ts"):
                    entry["ts"] = entry["ts"].isoformat()
                results.append(entry)
            return results
    except Exception:
        get_logger().exception("audit_fetch_failed")
        return []


def fetch_dashboard_stats(window_hours: int = 24) -> Dict[str, Any]:
    """Aggregate stats from audit_index for the dashboard cards."""
    try:
        with psycopg.connect(settings.database_url) as conn:
            row = conn.execute(
                """
                SELECT
                    COUNT(*)                                              AS total,
                    COUNT(*) FILTER (WHERE decision = 'blocked')          AS blocks,
                    COUNT(*) FILTER (WHERE decision = 'modified')         AS modifications,
                    COUNT(*) FILTER (WHERE decision = 'allowed')          AS allowed,
                    COALESCE(AVG((metrics->>'latency_ms')::float), 0)     AS avg_latency_ms
                FROM audit_index
                WHERE ts >= now() - make_interval(hours := %s)
                """,
                (window_hours,),
            ).fetchone()
            return {
                "total_enforcements": row[0],
                "blocks": row[1],
                "modifications": row[2],
                "allowed": row[3],
                "avg_latency_ms": round(row[4], 2),
            }
    except Exception:
        get_logger().exception("dashboard_stats_failed")
        return {
            "total_enforcements": 0, "blocks": 0, "modifications": 0,
            "allowed": 0, "avg_latency_ms": 0,
        }


def fetch_risky_users(window_hours: int = 24, limit: int = 10) -> List[Dict[str, Any]]:
    """Users with the most blocked requests in the given window."""
    try:
        with psycopg.connect(settings.database_url) as conn:
            rows = conn.execute(
                """
                SELECT agg.user_id_hash,
                       agg.block_count,
                       agg.last_blocked,
                       latest.metrics->>'user_role'       AS user_role,
                       latest.metrics->>'user_department'  AS user_department
                FROM (
                    SELECT user_id_hash,
                           COUNT(*) AS block_count,
                           MAX(ts)  AS last_blocked
                    FROM audit_index
                    WHERE decision = 'blocked'
                      AND ts >= now() - make_interval(hours := %s)
                    GROUP BY user_id_hash
                    ORDER BY block_count DESC
                    LIMIT %s
                ) agg
                LEFT JOIN LATERAL (
                    SELECT metrics FROM audit_index
                    WHERE user_id_hash = agg.user_id_hash
                    ORDER BY ts DESC LIMIT 1
                ) latest ON true
                """,
                (window_hours, limit),
            ).fetchall()
            return [
                {
                    "user_hash": r[0],
                    "block_count": r[1],
                    "last_blocked": r[2].isoformat() if r[2] else None,
                    "user_role": r[3] or "",
                    "user_department": r[4] or "",
                }
                for r in rows
            ]
    except Exception:
        get_logger().exception("risky_users_failed")
        return []


def fetch_recent_activity(limit: int = 10) -> List[Dict[str, Any]]:
    """Most recent enforcement events for the activity feed."""
    try:
        with psycopg.connect(settings.database_url) as conn:
            rows = conn.execute(
                """
                SELECT audit_id, ts, stage, decision, user_id_hash, policies, correlation_id
                FROM audit_index
                ORDER BY ts DESC
                LIMIT %s
                """,
                (limit,),
            ).fetchall()
            return [
                {
                    "audit_id": r[0],
                    "ts": r[1].isoformat() if r[1] else None,
                    "stage": r[2],
                    "decision": r[3],
                    "user_hash": r[4],
                    "policies_fired": len(r[5]) if isinstance(r[5], list) else 0,
                    "source": "simulate" if r[6] == "simulate" else "live",
                }
                for r in rows
            ]
    except Exception:
        get_logger().exception("recent_activity_failed")
        return []
