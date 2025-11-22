from typing import Any, Dict, Tuple, List
from backend.app.policies.redaction_patterns import RedactionEngine


# Global redaction engine instance
_redaction_engine = RedactionEngine()


def action_block(message: str) -> Tuple[str, Dict[str, Any]]:
    return "blocked", {"message": message}


def action_rewrite_query(query: str, replacement: str) -> Tuple[str, Dict[str, Any]]:
    return "modified", {"request": {"query": replacement}}


def action_add_filters(existing: Dict[str, Any], filters_to_add: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    new_filters = dict(existing or {})
    new_filters.update(filters_to_add)
    return "modified", {"request": {"filters": new_filters}}


def action_redact(
    chunks: List[Dict[str, Any]],
    patterns: List[str],
    fields: List[str],
    tags: List[str],
    drop_if: Dict[str, Any] = None
) -> Tuple[str, Dict[str, Any]]:
    """
    Apply redaction to retrieved chunks.

    Args:
        chunks: List of chunk dictionaries from retrieval
        patterns: PII patterns to apply (e.g., ["EMAIL", "PHONE", "PAN"])
        fields: Fields to redact (e.g., ["text", "metadata.notes"])
        tags: If chunk has these tags in metadata.tags, apply redaction
        drop_if: Conditions to drop chunks entirely (e.g., {"metadata.sensitivity": "confidential"})

    Returns:
        Tuple of (decision, modified data with redacted chunks)
    """
    if not chunks:
        return "allowed", {"artifacts": {"chunks": []}}

    processed_chunks = []

    for chunk in chunks:
        if drop_if and _should_drop_chunk(chunk, drop_if):
            continue

        if _should_redact_chunk(chunk, tags):
            redacted_chunk = _apply_redaction_to_fields(chunk, fields, patterns)
            processed_chunks.append(redacted_chunk)
        else:
            processed_chunks.append(chunk)

    return "modified", {"artifacts": {"chunks": processed_chunks}}


def action_enforce(
    text: str,
    citations: bool = False,
    min_confidence: float = None,
    style: str = None
) -> Tuple[str, Dict[str, Any]]:
    """
    Enforce output quality requirements on generated text.

    Args:
        text: Generated text to validate
        citations: If True, require at least one citation
        min_confidence: Minimum confidence score (0.0-1.0)
        style: Required style ("formal", "neutral", etc.)

    Returns:
        Tuple of (decision, validation result)
    """
    violations = []

    # Check for citations (simple heuristic: look for [1], [source], etc.)
    if citations:
        has_citation = bool(
            re.search(r'\[\d+\]|\[source\]|\[ref\]', text, re.IGNORECASE)
        )
        if not has_citation:
            violations.append("Missing required citations")

    # Confidence check (would need to be provided by LLM metadata)
    # For now, we'll add this as a placeholder for future integration
    if min_confidence is not None:
        # This would typically come from LLM response metadata
        # violations.append(f"Confidence below threshold: {min_confidence}")
        pass

    # Style check (basic tone detection)
    if style == "formal":
        informal_patterns = [
            r'\b(?:gonna|wanna|gotta|yeah|nah|ok|okay)\b',
            r'!!!',
            r':\)',
            r'lol|lmao|bruh'
        ]
        for pattern in informal_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"Informal language detected (required: {style})")
                break

    if violations:
        return "blocked", {
            "message": "Output quality requirements not met",
            "violations": violations
        }

    return "allowed", {}


def _should_redact_chunk(chunk: Dict[str, Any], tags: List[str]) -> bool:
    """
    Check if chunk should have redaction applied based on tags.

    Args:
        chunk: Chunk dictionary
        tags: Tags that trigger redaction

    Returns:
        True if chunk should be redacted
    """
    if not tags:
        return True  # If no tags specified, apply to all chunks

    chunk_tags = chunk.get("metadata", {}).get("tags", [])
    if isinstance(chunk_tags, list):
        return any(tag in chunk_tags for tag in tags)

    return False


def _apply_redaction_to_fields(
    chunk: Dict[str, Any],
    fields: List[str],
    patterns: List[str]
) -> Dict[str, Any]:
    """
    Apply redaction patterns to specified fields in a chunk.

    Args:
        chunk: Chunk dictionary
        fields: Field paths to redact (e.g., ["text", "metadata.notes"])
        patterns: PII patterns to apply

    Returns:
        Chunk with redacted fields
    """
    redacted_chunk = chunk.copy()

    for field in fields:
        _redact_field_path(redacted_chunk, field, patterns)

    return redacted_chunk


def _redact_field_path(data: Dict[str, Any], field_path: str, patterns: List[str]) -> None:
    """
    Redact a specific field path in a dictionary (modifies in place).

    Args:
        data: Dictionary containing the field
        field_path: Dotted path to field (e.g., "metadata.notes")
        patterns: PII patterns to apply
    """
    parts = field_path.split(".")
    current = data

    # Navigate to parent of target field
    for part in parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return  # Path doesn't exist

    # Redact the final field
    final_key = parts[-1]
    if isinstance(current, dict) and final_key in current:
        current[final_key] = _redact_value(current[final_key], patterns)


def _redact_value(value: Any, patterns: List[str]) -> Any:
    """
    Redact a value (string or list of strings).

    Args:
        value: Value to redact
        patterns: PII patterns to apply

    Returns:
        Redacted value
    """
    if isinstance(value, str):
        return _redaction_engine.redact_text(value, patterns)
    elif isinstance(value, list):
        return [
            _redaction_engine.redact_text(item, patterns)
            if isinstance(item, str) else item
            for item in value
        ]
    return value


def _should_drop_chunk(chunk: Dict[str, Any], drop_conditions: Dict[str, Any]) -> bool:
    """
    Check if chunk matches drop conditions.

    Args:
        chunk: Chunk dictionary
        drop_conditions: Conditions to check (e.g., {"metadata.sensitivity": "confidential"})

    Returns:
        True if chunk should be dropped
    """
    for path, expected_value in drop_conditions.items():
        parts = path.split(".")
        current = chunk

        # Navigate to the field
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return False

        # Check if value matches
        if current == expected_value:
            return True

    return False


# Import re for pattern matching in action_enforce
import re
