from typing import Any, Dict, Tuple


def action_block(message: str) -> Tuple[str, Dict[str, Any]]:
    return "blocked", {"message": message}


def action_rewrite_query(query: str, replacement: str) -> Tuple[str, Dict[str, Any]]:
    return "modified", {"request": {"query": replacement}}


def action_add_filters(existing: Dict[str, Any], filters_to_add: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    new_filters = dict(existing or {})
    new_filters.update(filters_to_add)
    return "modified", {"request": {"filters": new_filters}}


