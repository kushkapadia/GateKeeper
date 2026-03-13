"""Policy evaluator — the core enforcement engine.

Handles all four RAG pipeline stages:
    pre_query       → block queries (with multi-layer evasion detection)
    pre_retrieval   → inject metadata filters (RBAC/ABAC)
    post_retrieval  → redact PII from chunks, drop chunks by metadata
    post_generation → redact PII from answer, enforce citations/confidence, block banned content
"""

from typing import Any, Dict, List, Optional, Tuple
import json

from .actions import (
    action_block,
    action_add_filters,
    action_redact_chunks,
    action_filter_chunks,
    action_redact_text,
)
from .repository import fetch_policies_for_stage
from ..core.config import settings
from .path_resolver import eval_expr, get_by_path
from .query_guard import check_query


def evaluate(
    stage: str,
    user: Dict[str, Any],
    request: Dict[str, Any],
    artifacts: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Dict[str, Any], List[Dict[str, Any]]]:
    """Evaluate all matching policies for *stage* and return enforcement result.

    Returns (decision, data_changes, trace)
    """
    trace: List[Dict[str, Any]] = []
    decision: str = "allowed"
    changes: Dict[str, Any] = {}

    policies = fetch_policies_for_stage(stage, settings.policy_version)
    ctx = {
        "user": user or {},
        "request": request or {},
        "artifacts": artifacts or (request or {}).get("artifacts", {}),
    }

    for content, _distilled, _prio in policies:
        try:
            pol = content if isinstance(content, dict) else json.loads(content)
        except Exception:
            continue

        if not _when_matches(pol, ctx):
            continue

        act = pol.get("action", {})
        a_type = act.get("type")

        if stage == "pre_query":
            result = _eval_pre_query(pol, act, a_type, ctx, request)
        elif stage == "pre_retrieval":
            result = _eval_pre_retrieval(pol, act, a_type, ctx, request)
        elif stage == "post_retrieval":
            result = _eval_post_retrieval(pol, act, a_type, ctx, request, artifacts, changes)
        elif stage == "post_generation":
            result = _eval_post_generation(pol, act, a_type, ctx, request, artifacts, changes)
        else:
            continue

        if result is None:
            continue

        step_decision, step_changes, step_trace = result
        trace.append(step_trace)

        if step_decision == "blocked":
            return step_decision, step_changes, trace

        if step_decision == "modified":
            decision = "modified"
            changes.update(step_changes)

    return decision, changes, trace


# ── When-condition evaluation ──────────────────────────────────────────────

def _when_matches(pol: Dict[str, Any], ctx: Dict[str, Any]) -> bool:
    when = pol.get("when", {})
    if not when:
        return True
    if "any" in when:
        if not any(eval_expr(ctx, c.get("expr", "")) for c in when.get("any", [])):
            return False
    if "all" in when:
        if not all(eval_expr(ctx, c.get("expr", "")) for c in when.get("all", [])):
            return False
    return True


# ── Stage: pre_query ───────────────────────────────────────────────────────

def _eval_pre_query(pol, act, a_type, ctx, request):
    if a_type != "block":
        return None
    q_text = str(get_by_path(ctx, "request.query") or "")
    match_cfg = pol.get("match", {})
    terms = match_cfg.get("query.text", [])
    fuzzy_threshold = match_cfg.get("fuzzy_threshold", 80)

    blocked, matched_term, detection_layer = check_query(
        q_text, terms, fuzzy_threshold=fuzzy_threshold,
    )
    if not blocked:
        return None

    decision, data = action_block(act.get("message", "Blocked."))
    return decision, data, {
        "policy": pol.get("name", "block"),
        "action": "block",
        "details": {
            "matched_term": matched_term,
            "detection": detection_layer,
            "query": q_text,
        },
    }


# ── Stage: pre_retrieval ──────────────────────────────────────────────────

def _eval_pre_retrieval(pol, act, a_type, ctx, request):
    if a_type != "rewrite":
        return None
    add = (act.get("filters") or {}).get("add", {})
    rendered = {k: _render(v, ctx) for k, v in add.items()}
    decision, data = action_add_filters(
        (request or {}).get("filters", {}), rendered,
    )
    return decision, data, {
        "policy": pol.get("name", "rewrite"),
        "action": "rewrite_filters",
        "details": {"filters_added": rendered},
    }


# ── Stage: post_retrieval ─────────────────────────────────────────────────

def _eval_post_retrieval(pol, act, a_type, ctx, request, artifacts, running_changes):
    # Chunks may have already been modified by a prior policy in this evaluation
    chunks = running_changes.get("chunks") or _extract_chunks(request, artifacts)
    if not chunks:
        return None

    if a_type == "redact":
        return _post_retrieval_redact(pol, act, chunks)
    if a_type == "filter":
        return _post_retrieval_filter(pol, act, chunks, ctx)
    return None


def _post_retrieval_redact(pol, act, chunks):
    patterns = act.get("patterns", [])
    fields = act.get("fields", None)
    replace_with = act.get("replace_with", "[REDACTED]")
    if not patterns:
        return None

    match_cfg = pol.get("match", {})
    target_tags = match_cfg.get("chunk.tags_any", [])

    if target_tags:
        targeted: List[Dict[str, Any]] = []
        passthrough: List[Tuple[int, Dict[str, Any]]] = []
        for i, chunk in enumerate(chunks):
            chunk_tags = chunk.get("metadata", {}).get("tags", [])
            if isinstance(chunk_tags, str):
                chunk_tags = [chunk_tags]
            if any(t in chunk_tags for t in target_tags):
                targeted.append(chunk)
            else:
                passthrough.append((i, chunk))
        if not targeted:
            return None
        decision, redacted = action_redact_chunks(targeted, patterns, fields, replace_with)
        result_chunks = list(chunks)
        ti = 0
        for i in range(len(result_chunks)):
            meta_tags = result_chunks[i].get("metadata", {}).get("tags", [])
            if isinstance(meta_tags, str):
                meta_tags = [meta_tags]
            if any(t in meta_tags for t in target_tags):
                if ti < len(redacted):
                    result_chunks[i] = redacted[ti]
                    ti += 1
    else:
        decision, result_chunks = action_redact_chunks(chunks, patterns, fields, replace_with)

    if decision != "modified":
        return None

    return "modified", {"chunks": result_chunks}, {
        "policy": pol.get("name", "redact"),
        "action": "redact",
        "details": {"patterns": patterns, "fields": fields},
    }


def _post_retrieval_filter(pol, act, chunks, ctx):
    match_cfg = pol.get("match", {})
    drop_if = act.get("drop_if", {})

    drop_tags = match_cfg.get("chunk.tags_any") or match_cfg.get("chunk.metadata.tags", [])
    drop_sensitivity_raw = (
        match_cfg.get("chunk.metadata.sensitivity", [])
        or drop_if.get("sensitivity", "")
    )
    drop_sensitivity = _parse_in_list(drop_sensitivity_raw) if isinstance(drop_sensitivity_raw, str) else drop_sensitivity_raw

    if not drop_tags and not drop_sensitivity:
        return None

    decision, surviving, dropped_count = action_filter_chunks(
        chunks,
        drop_tags=drop_tags or None,
        drop_sensitivity=drop_sensitivity or None,
    )
    if decision != "modified":
        return None

    return "modified", {"chunks": surviving}, {
        "policy": pol.get("name", "filter"),
        "action": "filter",
        "details": {"dropped": dropped_count},
    }


# ── Stage: post_generation ─────────────────────────────────────────────────

def _eval_post_generation(pol, act, a_type, ctx, request, artifacts, running_changes):
    answer = running_changes.get("answer") or _extract_answer(request, artifacts)

    if a_type == "redact":
        return _post_gen_redact(pol, act, answer)
    if a_type == "enforce":
        return _post_gen_enforce(pol, act, answer, request, artifacts)
    if a_type == "block":
        return _post_gen_block(pol, act, answer)
    return None


def _post_gen_redact(pol, act, answer):
    if not answer:
        return None
    patterns = act.get("patterns", [])
    replace_with = act.get("replace_with", "[REDACTED]")
    if not patterns:
        return None

    decision, new_answer = action_redact_text(answer, patterns, replace_with)
    if decision != "modified":
        return None
    return "modified", {"answer": new_answer}, {
        "policy": pol.get("name", "redact"),
        "action": "redact",
        "details": {"patterns": patterns},
    }


def _post_gen_enforce(pol, act, answer, request, artifacts):
    arts = artifacts or {}
    gen_resp = arts.get("generated_response", {})
    citations = (
        gen_resp.get("citations")
        or (request or {}).get("sources", [])
    )
    confidence = gen_resp.get("confidence")

    cit_cfg = act.get("citations", {})
    min_citations = cit_cfg.get("min") or cit_cfg.get("min_count", 0)
    min_confidence = act.get("min_confidence")
    fallback = act.get("fallback", "I'm not confident enough to provide a reliable answer.")

    if min_citations and len(citations or []) < min_citations:
        return "blocked", {"answer": fallback, "message": "Citations required but missing."}, {
            "policy": pol.get("name", "enforce"),
            "action": "block",
            "details": {"reason": "insufficient_citations", "found": len(citations or []), "required": min_citations},
        }

    if min_confidence is not None and confidence is not None:
        if confidence < min_confidence:
            return "blocked", {"answer": fallback, "message": f"Confidence {confidence} below threshold {min_confidence}."}, {
                "policy": pol.get("name", "enforce"),
                "action": "block",
                "details": {"reason": "low_confidence", "confidence": confidence, "threshold": min_confidence},
            }

    return None


def _post_gen_block(pol, act, answer):
    if not answer:
        return None
    match_cfg = pol.get("match", {})
    banned = match_cfg.get("answer.text", [])
    if not banned:
        return None

    answer_lower = answer.lower()
    for term in banned:
        if term.lower() in answer_lower:
            decision, data = action_block(act.get("message", "Answer blocked by policy."))
            return decision, data, {
                "policy": pol.get("name", "block"),
                "action": "block",
                "details": {"matched_term": term},
            }
    return None


# ── Helpers ─────────────────────────────────────────────────────────────────

def _extract_chunks(
    request: Optional[Dict[str, Any]],
    artifacts: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Get chunks from wherever the client put them (request or artifacts)."""
    if request and "chunks" in request:
        return request["chunks"]
    if artifacts and "chunks" in artifacts:
        return artifacts["chunks"]
    return []


def _extract_answer(
    request: Optional[Dict[str, Any]],
    artifacts: Optional[Dict[str, Any]],
) -> str:
    """Get the generated answer from wherever the client put it."""
    if request:
        if "answer" in request:
            return request["answer"]
    if artifacts:
        gr = artifacts.get("generated_response", {})
        if isinstance(gr, dict) and "text" in gr:
            return gr["text"]
    return ""


def _render(template: Any, ctx: Dict[str, Any]) -> Any:
    if isinstance(template, str) and "${" in template:
        out = template
        for token in ["user.department", "user.role", "request.query"]:
            out = out.replace("${" + token + "}", str(get_by_path(ctx, token) or ""))
        return out
    return template


def _parse_in_list(value: str) -> List[str]:
    """Parse 'in [a, b, c]' syntax into a list of strings."""
    value = value.strip()
    if value.startswith("in "):
        inner = value[3:].strip().strip("[]")
        return [v.strip().strip('"').strip("'") for v in inner.split(",")]
    return [value] if value else []
