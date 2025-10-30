from typing import Any, Dict, List, Tuple
import json

import psycopg

from ..core.config import settings
from .path_resolver import eval_expr


def _eval_when_ctx(ctx: Dict[str, Any], expr: str) -> bool:
    return eval_expr(ctx, expr)


def fetch_policies_for_stage(stage: str, policy_version: str) -> List[Tuple[Dict, str, int]]:
    # Returns list of (content_json, distilled_prompt, priority)
    with psycopg.connect(settings.database_url) as conn:
        cur = conn.execute(
            """
            SELECT pv.content, COALESCE(pv.distilled_prompt,''), pv.priority
            FROM policy_versions pv
            WHERE pv.version = %s AND pv.stage = %s AND pv.enabled = TRUE
            ORDER BY pv.priority DESC, pv.created_at ASC
            """,
            (policy_version or "v0", stage),
        )
        rows = cur.fetchall()
        return [(row[0], row[1], row[2]) for row in rows]


def fetch_applicable_distilled_prompts(stage: str, user: Dict, request: Dict, policy_version: str = "v0") -> List[str]:
    prompts: List[str] = []
    ctx = {"user": user or {}, "request": request or {}}
    for content, distilled, _prio in fetch_policies_for_stage(stage, policy_version):
        try:
            policy = content if isinstance(content, dict) else json.loads(content)
        except Exception:
            continue
        when = policy.get("when", {})
        ok = True
        if "any" in when:
            ok = any(_eval_when_ctx(ctx, cond.get("expr", "")) for cond in when.get("any", []))
        elif "all" in when:
            ok = all(_eval_when_ctx(ctx, cond.get("expr", "")) for cond in when.get("all", []))
        if ok and distilled:
            prompts.append(distilled)
    return prompts



