"""Policy action handlers for all four enforcement stages.

Pre-query / Pre-retrieval actions:
    action_block, action_rewrite_query, action_add_filters

Post-retrieval actions:
    action_redact_chunks  — apply named PII patterns + blank metadata fields
    action_filter_chunks  — drop chunks whose metadata matches conditions

Post-generation actions:
    action_redact_text    — apply named PII patterns to generated answer text
"""

import re
from typing import Any, Dict, List, Optional, Tuple


# ── Named PII patterns ─────────────────────────────────────────────────────
# Policies reference these by name (e.g. "EMAIL", "PHONE") instead of raw regex.

PII_PATTERNS: Dict[str, str] = {
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "PHONE": r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b",
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "PAN": r"\b[A-Z]{5}\d{4}[A-Z]\b",
    "AADHAAR": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
    "CREDIT_CARD": r"\b(?:\d{4}[\s-]?){3}\d{4}\b",
    "IP_ADDRESS": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
}


def _resolve_patterns(names: List[str]) -> List[re.Pattern]:
    """Map named patterns to compiled regexes; pass raw regexes through."""
    out: List[re.Pattern] = []
    for name in names:
        raw = PII_PATTERNS.get(name.upper(), name)
        try:
            out.append(re.compile(raw))
        except re.error:
            continue
    return out


# ── Pre-query / Pre-retrieval actions ──────────────────────────────────────

def action_block(message: str) -> Tuple[str, Dict[str, Any]]:
    return "blocked", {"message": message}


def action_rewrite_query(query: str, replacement: str) -> Tuple[str, Dict[str, Any]]:
    return "modified", {"request": {"query": replacement}}


def action_add_filters(
    existing: Dict[str, Any], filters_to_add: Dict[str, Any]
) -> Tuple[str, Dict[str, Any]]:
    new_filters = dict(existing or {})
    new_filters.update(filters_to_add)
    return "modified", {"request": {"filters": new_filters}}


# ── Post-retrieval actions ─────────────────────────────────────────────────

def action_redact_chunks(
    chunks: List[Dict[str, Any]],
    pattern_names: List[str],
    fields: Optional[List[str]] = None,
    replace_with: str = "[REDACTED]",
) -> Tuple[str, List[Dict[str, Any]]]:
    """Apply PII regex patterns to chunk text and optionally blank metadata fields."""
    regexes = _resolve_patterns(pattern_names)
    modified = False
    result: List[Dict[str, Any]] = []
    for chunk in chunks:
        c = dict(chunk)
        text = c.get("text", c.get("chunk", ""))
        new_text = text
        for rx in regexes:
            new_text = rx.sub(replace_with, new_text)
        if new_text != text:
            modified = True
            if "text" in c:
                c["text"] = new_text
            else:
                c["chunk"] = new_text
        if fields and "metadata" in c:
            meta = dict(c["metadata"])
            for f in fields:
                if f in meta:
                    meta[f] = replace_with
                    modified = True
            c["metadata"] = meta
        result.append(c)
    return ("modified" if modified else "allowed"), result


def action_filter_chunks(
    chunks: List[Dict[str, Any]],
    drop_tags: Optional[List[str]] = None,
    drop_sensitivity: Optional[List[str]] = None,
) -> Tuple[str, List[Dict[str, Any]], int]:
    """Drop chunks whose metadata matches the drop conditions.

    Returns (decision, surviving_chunks, dropped_count).
    """
    result: List[Dict[str, Any]] = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        should_drop = False
        if drop_tags:
            chunk_tags = meta.get("tags", [])
            if isinstance(chunk_tags, str):
                chunk_tags = [chunk_tags]
            if any(t in chunk_tags for t in drop_tags):
                should_drop = True
        if drop_sensitivity:
            sens = meta.get("sensitivity", "")
            if sens in drop_sensitivity:
                should_drop = True
        if not should_drop:
            result.append(chunk)
    dropped = len(chunks) - len(result)
    return ("modified" if dropped > 0 else "allowed"), result, dropped


# ── Post-generation actions ────────────────────────────────────────────────

def action_redact_text(
    text: str,
    pattern_names: List[str],
    replace_with: str = "[REDACTED]",
) -> Tuple[str, str]:
    """Apply PII regex patterns to a string (e.g. generated answer)."""
    regexes = _resolve_patterns(pattern_names)
    new_text = text
    for rx in regexes:
        new_text = rx.sub(replace_with, new_text)
    return ("modified" if new_text != text else "allowed"), new_text
