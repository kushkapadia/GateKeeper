from typing import Dict, List, Tuple
import json
import re

from .descriptor import fetch_descriptor_paths


_PATH_RE = re.compile(r"\b(user|doc\.metadata)\.([A-Za-z0-9_\.]+)")
_TEMPLATE_RE = re.compile(r"\$\{(user|doc\.metadata)\.([A-Za-z0-9_\.]+)\}")


def extract_paths(policy: Dict) -> List[str]:
    paths: List[str] = []
    for cond in (policy.get("when", {}).get("any", []) + policy.get("when", {}).get("all", [])):
        expr = cond.get("expr", "")
        for m in _PATH_RE.finditer(expr):
            paths.append(f"{m.group(1)}.{m.group(2)}")
    action = policy.get("action", {})
    action_str = json.dumps(action)
    for m in _TEMPLATE_RE.finditer(action_str):
        paths.append(f"{m.group(1)}.{m.group(2)}")
    return paths


def lint_policies(tenant_id: str, descriptor_version: str, policies: List[Dict]) -> Tuple[bool, List[Dict], List[Dict]]:
    allowed = fetch_descriptor_paths(tenant_id, descriptor_version)
    errors: List[Dict] = []
    warnings: List[Dict] = []
    for p in policies:
        try:
            pol = p if isinstance(p, dict) else json.loads(p)
        except Exception as e:
            errors.append({"policy": p.get("name", "unknown"), "message": f"invalid json: {e}"})
            continue
        for path in extract_paths(pol):
            if path.startswith("user."):
                field = path.split(".", 1)[1]
                if field not in allowed.get("user", set()):
                    errors.append({"policy": pol.get("name", "unknown"), "path": path, "message": "unknown user attribute"})
            elif path.startswith("doc.metadata."):
                field = path.split(".", 2)[2]
                if field not in allowed.get("doc.metadata", set()):
                    errors.append({"policy": pol.get("name", "unknown"), "path": path, "message": "unknown doc metadata field"})
            else:
                # Other namespaces allowed for now; could warn
                pass
    return (len(errors) == 0), errors, warnings


