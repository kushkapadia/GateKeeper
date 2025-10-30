from typing import Any, Dict, List, Tuple
import json

from .actions import action_block, action_rewrite_query, action_add_filters
from .repository import fetch_policies_for_stage
from ..core.config import settings
from .path_resolver import eval_expr, get_by_path


def evaluate(stage: str, user: Dict[str, Any], request: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """Evaluate policies generically from DB for block/rewrite actions.

    Returns (decision, data_changes, trace)
    """
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}

    policies = fetch_policies_for_stage(stage, settings.policy_version)
    ctx = {"user": user or {}, "request": request or {}, "artifacts": (request or {}).get("artifacts", {})}
    q_text = str(get_by_path(ctx, "request.query") or "")
    for content, _distilled, _prio in policies:
        try:
            pol = content if isinstance(content, dict) else json.loads(content)
        except Exception:
            continue
        when = pol.get("when", {})
        if "any" in when:
            if not any(eval_expr(ctx, c.get("expr", "")) for c in when.get("any", [])):
                continue
        if "all" in when:
            if not all(eval_expr(ctx, c.get("expr", "")) for c in when.get("all", [])):
                continue

        act = pol.get("action", {})
        a_type = act.get("type")
        if stage == "pre_query" and a_type == "block":
            terms = pol.get("match", {}).get("query.text", [])
            if any(t.lower() in q_text.lower() for t in terms):
                decision, changes = action_block(act.get("message", "Blocked."))
                trace.append({"policy": pol.get("name", "block"), "action": "block"})
                break
        if stage == "pre_retrieval" and a_type == "rewrite":
            add = (act.get("filters") or {}).get("add", {})
            rendered = {k: _render(v, ctx) for k, v in add.items()}
            decision, changes = action_add_filters((request or {}).get("filters", {}), rendered)
            trace.append({"policy": pol.get("name", "rewrite"), "action": "rewrite_filters"})
            # continue to allow subsequent rewrites, but keep decision as modified
            if decision != "modified":
                decision = "modified"

    return decision, changes, trace


def _render(template: Any, ctx: Dict[str, Any]) -> Any:
    if isinstance(template, str) and "${" in template:
        # Replace ${user.department}, ${request.something}
        out = template
        for token in ["user.department", "user.role", "request.query"]:
            out = out.replace("${" + token + "}", str(get_by_path(ctx, token) or ""))
        return out
    return template


