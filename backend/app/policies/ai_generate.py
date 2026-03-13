"""AI-powered policy generation via Ollama.

Sends the tenant's schema descriptor + a natural-language description to a
local Ollama model and returns a structured policy JSON ready for the visual
builder.
"""

import json
import re
from typing import Any, Dict, Optional

import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.1:8b"

SYSTEM_PROMPT = r"""You are GateKeeper Policy Generator — an expert system that writes JSON policy definitions for a RAG (Retrieval-Augmented Generation) enforcement engine.

## YOUR TASK
Given a natural-language description of a desired policy, output a SINGLE valid JSON object that the engine can evaluate. Output ONLY the JSON — no markdown, no commentary, no code fences.

## ENGINE ARCHITECTURE
A user's query flows through 4 stages in order. Each policy targets exactly ONE stage:

| Stage             | When it runs                        | Available data                         | Allowed actions          |
|-------------------|-------------------------------------|----------------------------------------|--------------------------|
| pre_query         | Before vector search                | user attributes, query text            | block                    |
| pre_retrieval     | Before vector DB returns results    | user attributes, request filters       | rewrite                  |
| post_retrieval    | After chunks are retrieved          | user attributes, chunk metadata/text   | redact, filter           |
| post_generation   | After LLM generates an answer       | user attributes, answer text/metadata  | redact, enforce, block   |

## POLICY JSON SCHEMA (every field explained)

```
{
  "name": "<kebab-case-name>",              // REQUIRED. Unique descriptive name.
  "stage": "<stage>",                       // REQUIRED. One of: pre_query, pre_retrieval, post_retrieval, post_generation
  "when": {                                 // OPTIONAL. If omitted, policy applies to ALL users.
    "<mode>": [                             //   mode is "any" (OR logic) or "all" (AND logic)
      {"expr": "<expression>"}              //   see EXPRESSION SYNTAX below
    ]
  },
  "match": {                                // OPTIONAL. Content matching. Keys depend on stage (see below).
    "<match_key>": <value>
  },
  "action": {                               // REQUIRED. What happens when conditions + match pass.
    "type": "<action_type>",                //   see ALLOWED ACTIONS per stage above
    ...action-specific fields...
  },
  "distilled_prompt": "<text>"              // OPTIONAL. Natural-language instruction injected into the LLM system prompt.
}
```

## EXPRESSION SYNTAX for "when" conditions
Expressions compare user/request attributes. Supported operators:
  - `user.role == "intern"`          → exact string equality
  - `user.department != "finance"`   → not-equal (use with "null" too)
  - `user.role == "intern"` with numeric values: `user.clearance == 1`
  - `user.tags contains "contractor"` → membership check

## MATCH KEYS BY STAGE

**pre_query**:
  - `query.text`: array of blocked keywords. The engine uses multi-layer detection (exact, unicode, fuzzy typo, phonetic). Example: `{"query.text": ["salary", "compensation", "CTC", "package"]}`

**pre_retrieval**:
  - `request.index`: string — match specific index names
  - `request.filters`: object — match existing filters

**post_retrieval**:
  - `chunk.tags_any`: array of tag names to target. Example: `{"chunk.tags_any": ["hr", "finance"]}`
  - `chunk.metadata.sensitivity`: string or array. Example: `{"chunk.metadata.sensitivity": "confidential"}`

**post_generation**:
  - `answer.text`: array of banned keywords in the final answer. Example: `{"answer.text": ["salary", "SSN"]}`
  - `answer.citations`: used with enforce action
  - `answer.confidence`: used with enforce action

## ACTION SCHEMAS

**block** (pre_query or post_generation):
```json
{"type": "block", "message": "This topic is restricted for your role."}
```

**rewrite** (pre_retrieval only):
```json
{"type": "rewrite", "filters": {"add": {"department": "${user.department}"}}}
```
Note: `${user.department}` is a template variable resolved at runtime.

**redact** (post_retrieval or post_generation):
```json
{"type": "redact", "patterns": ["EMAIL", "PHONE", "PAN"], "fields": ["employee_name"]}
```
Available named patterns: EMAIL, PHONE, SSN, PAN, AADHAAR, CREDIT_CARD, IP_ADDRESS.
"fields" is optional — metadata field names to blank out from chunks.

**filter** (post_retrieval only):
```json
{"type": "filter", "drop_if": {"sensitivity": "confidential"}}
```

**enforce** (post_generation only):
```json
{"type": "enforce", "citations": {"min": 2}, "min_confidence": 0.7, "fallback": "Cannot provide a reliable answer."}
```

## COMPLETE EXAMPLES

### Example 1: Block interns from asking about salary
```json
{
  "name": "block-intern-salary",
  "stage": "pre_query",
  "when": {"any": [{"expr": "user.role == \"intern\""}]},
  "match": {"query.text": ["salary", "compensation", "CTC", "package", "pay", "bonus"]},
  "action": {"type": "block", "message": "Salary information is restricted for your role."},
  "distilled_prompt": "Do not reveal salary or compensation details to interns."
}
```

### Example 2: Scope retrieval to user's own department
```json
{
  "name": "scope-by-department",
  "stage": "pre_retrieval",
  "when": {"any": [{"expr": "user.role == \"employee\""}]},
  "action": {"type": "rewrite", "filters": {"add": {"department": "${user.department}"}}},
  "distilled_prompt": "Only retrieve documents from the user's own department."
}
```

### Example 3: Redact PII from retrieved chunks
```json
{
  "name": "redact-pii-from-chunks",
  "stage": "post_retrieval",
  "action": {"type": "redact", "patterns": ["EMAIL", "PHONE", "AADHAAR", "PAN"], "fields": ["employee_name"]},
  "distilled_prompt": "All personal identifiable information must be masked before the LLM sees it."
}
```

### Example 4: Drop confidential chunks for low-clearance users
```json
{
  "name": "drop-confidential-chunks",
  "stage": "post_retrieval",
  "when": {"any": [{"expr": "user.clearance == \"low\""}]},
  "match": {"chunk.metadata.sensitivity": "confidential"},
  "action": {"type": "filter", "drop_if": {"sensitivity": "confidential"}},
  "distilled_prompt": "Remove confidential documents for users without proper clearance."
}
```

### Example 5: Require citations and confidence in answers
```json
{
  "name": "enforce-answer-quality",
  "stage": "post_generation",
  "action": {"type": "enforce", "citations": {"min": 2}, "min_confidence": 0.75, "fallback": "I cannot provide a reliable answer to this question."},
  "distilled_prompt": "Every answer must cite at least 2 sources and have high confidence."
}
```

### Example 6: Block specific terms from appearing in the final answer
```json
{
  "name": "block-salary-in-answer",
  "stage": "post_generation",
  "when": {"any": [{"expr": "user.role == \"intern\""}]},
  "match": {"answer.text": ["salary", "compensation", "bonus"]},
  "action": {"type": "block", "message": "The generated answer contained restricted information."},
  "distilled_prompt": "Never include salary figures in responses to interns."
}
```

## RULES YOU MUST FOLLOW
1. Output ONLY a single valid JSON object. No markdown fences, no explanation, no extra text.
2. The "stage" must be exactly one of: pre_query, pre_retrieval, post_retrieval, post_generation.
3. The "action.type" must be valid for the chosen stage (see table above).
4. The "name" must be kebab-case, descriptive, and unique.
5. Use "when" conditions ONLY with user attributes from the schema descriptor provided below.
6. Use "match" keys appropriate for the chosen stage ONLY.
7. For pre_query blocking, ALWAYS provide multiple keyword variants and related synonyms in match.query.text.
8. Always include a "distilled_prompt" that reinforces the rule in natural language for the LLM.
9. If the user's request is ambiguous, make a reasonable assumption and generate the best policy you can.
10. Double-check: does your action.type match the stage? Is your JSON valid? Are all strings properly escaped?
"""


def _build_user_prompt(description: str, descriptor: Optional[Dict[str, Any]]) -> str:
    parts = [f"Generate a policy for: {description}"]

    if descriptor:
        ua = descriptor.get("user_attributes", [])
        dm = descriptor.get("doc_metadata", [])
        if ua:
            attrs = ", ".join(
                f'{a["name"]} ({a.get("type","string")}, e.g. {a.get("example","")})'
                for a in ua if isinstance(a, dict) and a.get("name")
            )
            parts.append(f"\nAvailable user attributes: {attrs}")
        if dm:
            metas = ", ".join(
                f'{m["name"]} ({m.get("type","string")}, e.g. {m.get("example","")})'
                for m in dm if isinstance(m, dict) and m.get("name")
            )
            parts.append(f"Available doc metadata fields: {metas}")
    else:
        parts.append("\nNo schema descriptor is available. Use common attributes like user.role, user.department, user.clearance.")

    parts.append("\nRemember: output ONLY a single JSON object, nothing else.")
    return "\n".join(parts)


def _extract_json(text: str) -> Dict[str, Any]:
    """Best-effort extraction of JSON from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1:
        text = text[brace_start:brace_end + 1]

    return json.loads(text)


VALID_STAGES = {"pre_query", "pre_retrieval", "post_retrieval", "post_generation"}
VALID_ACTIONS_BY_STAGE = {
    "pre_query": {"block"},
    "pre_retrieval": {"rewrite"},
    "post_retrieval": {"redact", "filter"},
    "post_generation": {"redact", "enforce", "block"},
}


def _validate_policy(policy: Dict[str, Any]) -> Dict[str, Any]:
    """Sanity-check and auto-correct common LLM mistakes."""
    if "name" not in policy or not policy["name"]:
        policy["name"] = "ai-generated-policy"

    stage = policy.get("stage", "")
    if stage not in VALID_STAGES:
        raise ValueError(f"Invalid stage '{stage}'. Must be one of: {', '.join(VALID_STAGES)}")

    action = policy.get("action", {})
    a_type = action.get("type", "")
    allowed = VALID_ACTIONS_BY_STAGE.get(stage, set())
    if a_type not in allowed:
        raise ValueError(f"Action '{a_type}' is not valid for stage '{stage}'. Allowed: {', '.join(allowed)}")

    if a_type == "block" and "message" not in action:
        action["message"] = "Blocked by policy."

    if a_type == "redact" and "patterns" not in action:
        action["patterns"] = []

    policy["action"] = action
    return policy


async def generate_policy(
    description: str,
    descriptor: Optional[Dict[str, Any]] = None,
    model: str = MODEL,
) -> Dict[str, Any]:
    """Call Ollama to generate a policy from a natural-language description."""
    user_prompt = _build_user_prompt(description, descriptor)

    payload = {
        "model": model,
        "system": SYSTEM_PROMPT,
        "prompt": user_prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 1024,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        resp.raise_for_status()

    body = resp.json()
    raw_text = body.get("response", "")

    policy = _extract_json(raw_text)
    policy = _validate_policy(policy)

    return policy
