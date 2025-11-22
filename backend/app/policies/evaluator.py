from typing import Any, Dict, List, Tuple
import json
import re

from .actions import action_block, action_rewrite_query, action_add_filters, action_redact, action_enforce
from .repository import fetch_policies_for_stage
from ..core.config import settings
from .path_resolver import eval_expr, get_by_path
from .query_normalizer import QueryMatcher, smart_match


def evaluate(stage: str, user: Dict[str, Any], request: Dict[str, Any], artifacts: Dict[str, Any] = None) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """Evaluate policies for all enforcement stages.

    Returns (decision, data_changes, trace)
    """
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}

    policies = fetch_policies_for_stage(stage, settings.policy_version)
    ctx = {
        "user": user or {},
        "request": request or {},
        "artifacts": artifacts or {}
    }

    # Route to stage-specific handler
    if stage == "pre_query":
        decision, changes, trace = _evaluate_pre_query(policies, ctx)
    elif stage == "pre_retrieval":
        decision, changes, trace = _evaluate_pre_retrieval(policies, ctx, request)
    elif stage == "post_retrieval":
        decision, changes, trace = _evaluate_post_retrieval(policies, ctx, artifacts)
    elif stage == "post_generation":
        decision, changes, trace = _evaluate_post_generation(policies, ctx, artifacts)

    return decision, changes, trace


def _evaluate_pre_query(policies: List[Tuple], ctx: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """
    Evaluate pre-query stage policies with intelligent matching.

    Supports:
    - Simple keyword matching (default: fuzzy)
    - Homoglyph detection (s@l@ry, sаlary with Cyrillic 'а')
    - Typo tolerance (salaary, saaalary)
    - Separator bypass (s.a.l.a.r.y, s-a-l-a-r-y)
    - Intent-based matching (semantic patterns)
    """
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}
    q_text = str(get_by_path(ctx, "request.query") or "")

    # Initialize query matcher with configuration
    matcher = QueryMatcher(
        fuzzy_threshold=0.85,
        max_typos=2,
        enable_normalization=True
    )

    for content, _distilled, _prio in policies:
        pol = _parse_policy(content)
        if not pol or not _matches_conditions(pol, ctx):
            continue

        act = pol.get("action", {})
        a_type = act.get("type")

        if a_type == "block":
            match_config = pol.get("match", {})
            terms = match_config.get("query.text", [])
            match_mode = match_config.get("mode", "fuzzy")  # fuzzy, exact, typo, semantic, any

            # Use smart matching
            is_matched, matched_terms = matcher.matches(q_text, terms, match_mode)

            if is_matched:
                decision, changes = action_block(act.get("message", "Blocked."))
                trace.append({
                    "policy": pol.get("name", "block"),
                    "action": "block",
                    "matched_terms": matched_terms,
                    "match_mode": match_mode,
                    "original_query": q_text,
                    "normalized_query": matcher.normalize(q_text)
                })
                break

    return decision, changes, trace


def _evaluate_pre_retrieval(policies: List[Tuple], ctx: Dict[str, Any], request: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """Evaluate pre-retrieval stage policies (add filters)."""
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}

    for content, _distilled, _prio in policies:
        pol = _parse_policy(content)
        if not pol or not _matches_conditions(pol, ctx):
            continue

        act = pol.get("action", {})
        a_type = act.get("type")

        if a_type == "rewrite":
            add = (act.get("filters") or {}).get("add", {})
            rendered = {k: _render(v, ctx) for k, v in add.items()}
            decision, changes = action_add_filters((request or {}).get("filters", {}), rendered)
            trace.append({"policy": pol.get("name", "rewrite"), "action": "rewrite_filters"})
            if decision != "modified":
                decision = "modified"

    return decision, changes, trace


def _evaluate_post_retrieval(policies: List[Tuple], ctx: Dict[str, Any], artifacts: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """Evaluate post-retrieval stage policies (redact PII from chunks)."""
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}
    chunks = (artifacts or {}).get("chunks", [])

    for content, _distilled, _prio in policies:
        pol = _parse_policy(content)
        if not pol or not _matches_conditions(pol, ctx):
            continue

        act = pol.get("action", {})
        a_type = act.get("type")

        if a_type == "redact":
            patterns = act.get("patterns", [])
            fields = act.get("fields", ["text"])
            tags = act.get("tags", [])
            drop_if = act.get("drop_if")

            decision, changes = action_redact(chunks, patterns, fields, tags, drop_if)
            trace.append({
                "policy": pol.get("name", "redact"),
                "action": "redact",
                "patterns": patterns,
                "fields": fields
            })

            # Update chunks for next policy
            chunks = changes.get("artifacts", {}).get("chunks", chunks)

    return decision, changes, trace


def _evaluate_post_generation(policies: List[Tuple], ctx: Dict[str, Any], artifacts: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """Evaluate post-generation stage policies (enforce citations, confidence, style)."""
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}
    generated_text = (artifacts or {}).get("response", {}).get("text", "")

    for content, _distilled, _prio in policies:
        pol = _parse_policy(content)
        if not pol or not _matches_conditions(pol, ctx):
            continue

        act = pol.get("action", {})
        a_type = act.get("type")

        if a_type == "enforce":
            citations = act.get("citations", False)
            min_confidence = act.get("min_confidence")
            style = act.get("style")

            decision, changes = action_enforce(generated_text, citations, min_confidence, style)
            trace.append({
                "policy": pol.get("name", "enforce"),
                "action": "enforce",
                "requirements": {
                    "citations": citations,
                    "min_confidence": min_confidence,
                    "style": style
                }
            })

            if decision == "blocked":
                break

    return decision, changes, trace


def _parse_policy(content: Any) -> Dict[str, Any]:
    """Parse policy content from JSON or dict."""
    try:
        return content if isinstance(content, dict) else json.loads(content)
    except Exception:
        return {}


def _matches_conditions(pol: Dict[str, Any], ctx: Dict[str, Any]) -> bool:
    """Check if policy conditions match the current context."""
    when = pol.get("when", {})

    if "any" in when:
        if not any(eval_expr(ctx, c.get("expr", "")) for c in when.get("any", [])):
            return False

    if "all" in when:
        if not all(eval_expr(ctx, c.get("expr", "")) for c in when.get("all", [])):
            return False

    return True


def _render(template: Any, ctx: Dict[str, Any]) -> Any:
    if isinstance(template, str) and "${" in template:
        # Replace ${user.department}, ${request.something}
        out = template
        for token in ["user.department", "user.role", "request.query"]:
            out = out.replace("${" + token + "}", str(get_by_path(ctx, token) or ""))
        return out
    return template


