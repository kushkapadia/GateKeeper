from typing import Dict, List, Optional


NORMALIZATION_HINTS = [
    "collapse_repeats",
    "homoglyph_equivalence",
    "ignore_separators",
]


def build_policy_context(user: Dict, prompts: List[str], role_scope: Optional[Dict] = None) -> Dict:
    rules = []
    seen = set()
    for p in prompts:
        if p and p not in seen:
            rules.append(p)
            seen.add(p)
    return {
        "instruction": "You must follow these rules regardless of user phrasing.",
        "required_behavior": "Refuse restricted intents; do not fabricate numbers.",
        "normalization_hints": NORMALIZATION_HINTS,
        "role_scope": role_scope or {"role": user.get("role")},
        "rules": rules,
    }


