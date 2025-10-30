from typing import Any, Dict, Iterable


def get_by_path(ctx: Dict[str, Any], path: str) -> Any:
    """Resolve dotted path like 'user.department' against a nested dict.
    Returns None if any segment is missing.
    """
    if not path:
        return None
    parts = path.split(".")
    cur: Any = ctx
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur


def eval_expr(ctx: Dict[str, Any], expr: str) -> bool:
    s = (expr or "").strip()
    if not s:
        return True
    # == operator
    if "==" in s:
        left, right = s.split("==", 1)
        left = left.strip()
        right = right.strip().strip('"')
        return str(get_by_path(ctx, left)) == right
    # != null
    if "!=" in s and "null" in s:
        left, _ = s.split("!=", 1)
        left = left.strip()
        return get_by_path(ctx, left) is not None
    # contains
    if " contains " in s:
        left, right = s.split(" contains ", 1)
        left = left.strip()
        right = right.strip().strip('"')
        val = get_by_path(ctx, left)
        if isinstance(val, str):
            return right in val
        if isinstance(val, Iterable):
            return right in list(val)
        return False
    # in list: "value" in $.path not implemented for simplicity
    return False


