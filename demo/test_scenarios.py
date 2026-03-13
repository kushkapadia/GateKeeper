#!/usr/bin/env python3
"""Acme Corp — end-to-end test scenarios for all 4 RAG stages.

This script hits POST /api/policies/simulate for each scenario and
prints a colour-coded pass/fail report WITH expected vs actual output
so you can cross-check when running the same bodies manually.

Usage:
    python demo/seed.py          # seed first
    python demo/test_scenarios.py
"""

import json
import sys
import requests

BASE = "http://localhost:8000"
TENANT_NAME = "acme"
TENANT_PASSWORD = "admin"

PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"
DIM  = "\033[90m"
RST  = "\033[0m"
BOLD = "\033[1m"
CYAN = "\033[96m"

# ── Auth ─────────────────────────────────────────────────────────────────────

def get_token() -> str:
    r = requests.post(f"{BASE}/api/auth/login", json={
        "name": TENANT_NAME,
        "password": TENANT_PASSWORD,
    })
    r.raise_for_status()
    return r.json()["token"]


def simulate(token: str, payload: dict) -> dict:
    r = requests.post(
        f"{BASE}/api/policies/simulate",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
    )
    r.raise_for_status()
    return r.json()


# ── Test definitions ────────────────────────────────────────────────────────
# Each test is a dict with:
#   title      — display name
#   payload    — the JSON body to send to POST /api/policies/simulate
#   expected   — dict describing expected output values for manual comparison
#   check_fn   — lambda(response) → (bool, str) for automated pass/fail

TESTS = [
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 1: PRE-QUERY  (8 tests)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        "title": "[pre_query] Intern asks about salary → BLOCKED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "intern", "department": "engineering", "clearance": "low", "employment_type": "intern"},
            "request": {"query": "What is the CEO's salary?"},
        },
        "expected": {
            "decision": "blocked",
            "data.message": "Salary and compensation information is restricted for your role.",
            "trace[0].policy": "block-intern-salary",
            "trace[0].details.matched_term": "salary",
            "trace[0].details.detection": "exact",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Intern salary with obfuscation (s.a.l.a.r.y) → BLOCKED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "intern", "department": "engineering", "clearance": "low", "employment_type": "intern"},
            "request": {"query": "Tell me the CEO's s.a.l.a.r.y"},
        },
        "expected": {
            "decision": "blocked",
            "data.message": "Salary and compensation information is restricted for your role.",
            "trace[0].policy": "block-intern-salary",
            "trace[0].details.matched_term": "salary",
            "trace[0].details.detection": "normalized  (separator-stripped)",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Intern salary with leetspeak (s4l4ry) → BLOCKED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "intern", "department": "engineering", "clearance": "low", "employment_type": "intern"},
            "request": {"query": "What is the s4l4ry of the CEO?"},
        },
        "expected": {
            "decision": "blocked",
            "data.message": "Salary and compensation information is restricted for your role.",
            "trace[0].policy": "block-intern-salary",
            "trace[0].details.matched_term": "salary",
            "trace[0].details.detection": "normalized  (leetspeak-decoded)",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Contractor asks about bonus → BLOCKED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "employee", "department": "sales", "clearance": "medium", "employment_type": "contractor"},
            "request": {"query": "What's the quarterly bonus structure?"},
        },
        "expected": {
            "decision": "blocked",
            "data.message": "Salary and compensation information is restricted for your role.",
            "trace[0].policy": "block-intern-salary",
            "trace[0].details.matched_term": "bonus",
            "trace[0].details.detection": "exact",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Full-time employee asks about salary → ALLOWED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "employee", "department": "hr", "clearance": "medium", "employment_type": "full_time"},
            "request": {"query": "What is the salary range for senior engineers?"},
        },
        "expected": {
            "decision": "allowed",
            "data": {},
            "trace": "[] (empty — no policy matched)",
            "why": "User is full_time employee, not intern/contractor, so block-intern-salary's 'when' does not match.",
        },
        "check_fn": lambda r: (r["decision"] == "allowed", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Intern asks about leave policy → ALLOWED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "intern", "department": "engineering", "clearance": "low", "employment_type": "intern"},
            "request": {"query": "How many leave days do I get?"},
        },
        "expected": {
            "decision": "allowed",
            "data": {},
            "trace": "[] (empty — 'leave' is not in blocked terms)",
            "why": "Query contains 'leave' which is NOT in the blocked term list [salary, compensation, CTC, pay, bonus, ...]",
        },
        "check_fn": lambda r: (r["decision"] == "allowed", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Non-legal engineer asks about lawsuit → BLOCKED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium", "employment_type": "full_time"},
            "request": {"query": "What's the status of the ongoing lawsuit?"},
        },
        "expected": {
            "decision": "blocked",
            "data.message": "Legal matters are restricted to the legal department.",
            "trace[0].policy": "block-legal-privileged",
            "trace[0].details.matched_term": "lawsuit",
            "trace[0].details.detection": "exact",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_query] Legal counsel asks about lawsuit → ALLOWED",
        "payload": {
            "stage": "pre_query",
            "user": {"role": "legal_counsel", "department": "legal", "clearance": "high", "employment_type": "full_time"},
            "request": {"query": "What's the status of the ongoing lawsuit?"},
        },
        "expected": {
            "decision": "allowed",
            "data": {},
            "trace": "[] (empty — block-legal-privileged's when requires department != 'legal')",
            "why": "User is in the legal department, so the block-legal-privileged policy's 'when' condition does not match.",
        },
        "check_fn": lambda r: (r["decision"] == "allowed", f"decision={r['decision']}"),
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 2: PRE-RETRIEVAL  (3 tests)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        "title": "[pre_retrieval] Employee gets department filter → MODIFIED",
        "payload": {
            "stage": "pre_retrieval",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium"},
            "request": {"query": "Find onboarding documents", "filters": {}},
        },
        "expected": {
            "decision": "modified",
            "data.request.filters": {"department": "engineering"},
            "trace[0].policy": "scope-department-docs",
            "trace[0].action": "rewrite_filters",
            "trace[0].details.filters_added": {"department": "engineering"},
            "why": "User is 'employee' (not manager/executive), so retrieval is scoped to their own department.",
        },
        "check_fn": lambda r: (
            r["decision"] == "modified"
            and r.get("data", {}).get("request", {}).get("filters", {}).get("department") == "engineering",
            f"decision={r['decision']}, filters={r.get('data', {}).get('request', {}).get('filters', {})}",
        ),
    },
    {
        "title": "[pre_retrieval] Manager gets no filter restriction → ALLOWED",
        "payload": {
            "stage": "pre_retrieval",
            "user": {"role": "manager", "department": "engineering", "clearance": "high"},
            "request": {"query": "Show all HR documents", "filters": {}},
        },
        "expected": {
            "decision": "allowed",
            "data": {},
            "trace": "[] (empty — manager is exempt from department scoping)",
            "why": "scope-department-docs requires role != 'manager' AND role != 'executive'. Manager fails the first condition.",
        },
        "check_fn": lambda r: (r["decision"] == "allowed", f"decision={r['decision']}"),
    },
    {
        "title": "[pre_retrieval] Executive gets no filter restriction → ALLOWED",
        "payload": {
            "stage": "pre_retrieval",
            "user": {"role": "executive", "department": "finance", "clearance": "executive"},
            "request": {"query": "Cross-department performance reviews", "filters": {}},
        },
        "expected": {
            "decision": "allowed",
            "data": {},
            "trace": "[] (empty — executive is exempt from department scoping)",
        },
        "check_fn": lambda r: (r["decision"] == "allowed", f"decision={r['decision']}"),
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 3: POST-RETRIEVAL  (4 tests)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        "title": "[post_retrieval] PII in chunks gets redacted → MODIFIED",
        "payload": {
            "stage": "post_retrieval",
            "user": {"role": "employee", "department": "engineering", "clearance": "high"},
            "request": {},
            "artifacts": {
                "chunks": [
                    {
                        "text": "Contact John at john.doe@acme.com or call 555-123-4567. SSN: 123-45-6789",
                        "metadata": {"department": "hr", "sensitivity": "internal", "author": "Jane Smith"},
                    },
                    {
                        "text": "The company was founded in 2010 and has grown to 500 employees.",
                        "metadata": {"department": "marketing", "sensitivity": "public", "author": "PR Team"},
                    },
                ],
            },
        },
        "expected": {
            "decision": "modified",
            "data.chunks[0].text": "Contact John at [REDACTED] or call [REDACTED]. SSN: [REDACTED]",
            "data.chunks[0].metadata.author": "[REDACTED]",
            "data.chunks[1].text": "The company was founded in 2010 and has grown to 500 employees.  (unchanged — no PII)",
            "data.chunks[1].metadata.author": "[REDACTED]",
            "trace[0].policy": "redact-pii-from-chunks",
            "trace[0].action": "redact",
            "trace[0].details.patterns": ["EMAIL", "PHONE", "SSN", "PAN", "AADHAAR"],
        },
        "check_fn": lambda r: (
            r["decision"] == "modified"
            and "[REDACTED]" in r.get("data", {}).get("chunks", [{}])[0].get("text", ""),
            f"decision={r['decision']}, chunk0_text={r.get('data', {}).get('chunks', [{}])[0].get('text', '')[:80]}",
        ),
    },
    {
        "title": "[post_retrieval] Author field gets redacted → MODIFIED",
        "payload": {
            "stage": "post_retrieval",
            "user": {"role": "employee", "department": "engineering", "clearance": "high"},
            "request": {},
            "artifacts": {
                "chunks": [
                    {
                        "text": "Employee handbook section 3.2: email admin@acme.com for queries.",
                        "metadata": {"department": "hr", "sensitivity": "internal", "author": "HR Admin"},
                    },
                ],
            },
        },
        "expected": {
            "decision": "modified",
            "data.chunks[0].text": "Employee handbook section 3.2: email [REDACTED] for queries.",
            "data.chunks[0].metadata.author": "[REDACTED]",
            "trace[0].policy": "redact-pii-from-chunks",
            "why": "Both the email in text AND the author metadata field get redacted by redact-pii-from-chunks.",
        },
        "check_fn": lambda r: (
            r["decision"] == "modified"
            and r.get("data", {}).get("chunks", [{}])[0].get("metadata", {}).get("author") == "[REDACTED]",
            f"decision={r['decision']}, author={r.get('data', {}).get('chunks', [{}])[0].get('metadata', {}).get('author', 'N/A')}",
        ),
    },
    {
        "title": "[post_retrieval] Confidential chunks dropped for low-clearance → MODIFIED",
        "payload": {
            "stage": "post_retrieval",
            "user": {"role": "employee", "department": "engineering", "clearance": "low"},
            "request": {},
            "artifacts": {
                "chunks": [
                    {
                        "text": "Public company overview available on the website.",
                        "metadata": {"department": "marketing", "sensitivity": "public"},
                    },
                    {
                        "text": "Confidential: Q3 financials show revenue of $50M.",
                        "metadata": {"department": "finance", "sensitivity": "confidential"},
                    },
                    {
                        "text": "Internal memo about office relocation.",
                        "metadata": {"department": "operations", "sensitivity": "internal"},
                    },
                ],
            },
        },
        "expected": {
            "decision": "modified",
            "data.chunks": "[2 chunks — the confidential one is DROPPED]",
            "data.chunks[0].text": "Public company overview available on the website.  (kept — public)",
            "data.chunks[1].text": "Internal memo about office relocation.  (kept — internal)",
            "DROPPED": "Confidential: Q3 financials show revenue of $50M.  (dropped — sensitivity=confidential)",
            "trace": "Two entries: redact-pii-from-chunks (no change) + drop-confidential-low-clearance (1 dropped)",
            "why": "User clearance is 'low', so chunks with sensitivity='confidential' are removed.",
        },
        "check_fn": lambda r: (
            r["decision"] == "modified"
            and len(r.get("data", {}).get("chunks", [])) == 2,
            f"decision={r['decision']}, chunks_remaining={len(r.get('data', {}).get('chunks', []))}",
        ),
    },
    {
        "title": "[post_retrieval] High-clearance keeps all chunks → ALLOWED",
        "payload": {
            "stage": "post_retrieval",
            "user": {"role": "manager", "department": "finance", "clearance": "high"},
            "request": {},
            "artifacts": {
                "chunks": [
                    {
                        "text": "Public info.",
                        "metadata": {"department": "marketing", "sensitivity": "public"},
                    },
                    {
                        "text": "Confidential: Q3 financials.",
                        "metadata": {"department": "finance", "sensitivity": "confidential"},
                    },
                ],
            },
        },
        "expected": {
            "decision": "allowed",
            "data": "{}  (no changes — both chunks kept as-is because no PII and clearance=high)",
            "trace": "[] (empty — redact finds no PII, filter skips because clearance is 'high')",
            "why": "drop-confidential-low-clearance only activates for clearance='low' or 'medium'. High-clearance users keep everything.",
        },
        "check_fn": lambda r: (
            r["decision"] in ("allowed", "modified"),
            f"decision={r['decision']}, data_keys={list(r.get('data', {}).keys())}",
        ),
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 4: POST-GENERATION  (7 tests)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        "title": "[post_generation] No citations → BLOCKED",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "The company was founded in 2010.",
                    "citations": [],
                    "confidence": 0.8,
                },
            },
        },
        "expected": {
            "decision": "blocked",
            "data.answer": "I'm not confident enough to provide a reliable answer. Please consult the original documents.",
            "data.message": "Citations required but missing.",
            "trace[0].policy": "enforce-answer-quality",
            "trace[0].action": "block",
            "trace[0].details": {"reason": "insufficient_citations", "found": 0, "required": 1},
            "why": "enforce-answer-quality requires min 1 citation. The answer has 0 citations.",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[post_generation] Low confidence → BLOCKED",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "I think the office might be relocating.",
                    "citations": ["doc-001"],
                    "confidence": 0.3,
                },
            },
        },
        "expected": {
            "decision": "blocked",
            "data.answer": "I'm not confident enough to provide a reliable answer. Please consult the original documents.",
            "data.message": "Confidence 0.3 below threshold 0.6.",
            "trace[0].policy": "enforce-answer-quality",
            "trace[0].details": {"reason": "low_confidence", "confidence": 0.3, "threshold": 0.6},
            "why": "enforce-answer-quality requires min_confidence=0.6. The answer has confidence=0.3.",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[post_generation] Good answer, no PII → ALLOWED",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "The company was founded in 2010 and has 500 employees worldwide.",
                    "citations": ["doc-001", "doc-002"],
                    "confidence": 0.95,
                },
            },
        },
        "expected": {
            "decision": "allowed",
            "data": "{}  (no changes — answer is clean)",
            "trace": "[] (empty — passes enforce, no PII to redact, no banned terms)",
            "why": "Has 2 citations (≥1), confidence 0.95 (≥0.6), no PII, no salary terms → passes all policies.",
        },
        "check_fn": lambda r: (r["decision"] in ("allowed", "modified"), f"decision={r['decision']}"),
    },
    {
        "title": "[post_generation] PII in answer → MODIFIED (redacted)",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "Contact HR at hr@acme.com or call 555-987-6543. SSN on file: 987-65-4321.",
                    "citations": ["doc-001"],
                    "confidence": 0.9,
                },
            },
        },
        "expected": {
            "decision": "modified",
            "data.answer": "Contact HR at [REDACTED] or call [REDACTED]. SSN on file: [REDACTED].",
            "trace[0].policy": "redact-pii-from-answer",
            "trace[0].action": "redact",
            "trace[0].details.patterns": ["EMAIL", "PHONE", "SSN", "PAN", "CREDIT_CARD"],
            "why": "Passes enforce (1 citation, 0.9 confidence). Then redact-pii-from-answer masks email, phone, SSN.",
        },
        "check_fn": lambda r: (
            r["decision"] == "modified"
            and "[REDACTED]" in r.get("data", {}).get("answer", ""),
            f"decision={r['decision']}, answer={r.get('data', {}).get('answer', '')[:80]}",
        ),
    },
    {
        "title": "[post_generation] Salary in answer to engineer → BLOCKED",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "employee", "department": "engineering", "clearance": "medium"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "The average salary for senior engineers is $150,000 per year with a performance bonus.",
                    "citations": ["doc-hr-001"],
                    "confidence": 0.85,
                },
            },
        },
        "expected": {
            "decision": "blocked",
            "data.message": "The answer contained compensation data that is restricted for your role.",
            "trace[0].policy": "block-salary-in-answer",
            "trace[0].action": "block",
            "trace[0].details.matched_term": "salary",
            "why": "Passes enforce (1 citation, 0.85). No PII to redact. But answer contains 'salary' and user is not hr_admin/executive → blocked.",
        },
        "check_fn": lambda r: (r["decision"] == "blocked", f"decision={r['decision']}"),
    },
    {
        "title": "[post_generation] Salary in answer to HR admin → ALLOWED",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "hr_admin", "department": "hr", "clearance": "high"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "The average salary for senior engineers is $150,000 per year with a performance bonus.",
                    "citations": ["doc-hr-001"],
                    "confidence": 0.85,
                },
            },
        },
        "expected": {
            "decision": "allowed",
            "data": "{}  (no changes — HR admin is exempt)",
            "trace": "[] (empty)",
            "why": "block-salary-in-answer requires role != 'hr_admin'. User IS hr_admin, so the policy's 'when' doesn't match → skipped.",
        },
        "check_fn": lambda r: (r["decision"] in ("allowed", "modified"), f"decision={r['decision']}"),
    },
    {
        "title": "[post_generation] Credit card in answer → MODIFIED (redacted)",
        "payload": {
            "stage": "post_generation",
            "user": {"role": "employee", "department": "finance", "clearance": "medium"},
            "request": {},
            "artifacts": {
                "generated_response": {
                    "text": "The corporate card number is 4111-1111-1111-1111 and should be used for expenses.",
                    "citations": ["doc-fin-001"],
                    "confidence": 0.9,
                },
            },
        },
        "expected": {
            "decision": "modified",
            "data.answer": "The corporate card number is [REDACTED] and should be used for expenses.",
            "trace[0].policy": "redact-pii-from-answer",
            "trace[0].action": "redact",
            "trace[0].details.patterns": ["EMAIL", "PHONE", "SSN", "PAN", "CREDIT_CARD"],
            "why": "Passes enforce (1 citation, 0.9). The CREDIT_CARD pattern matches 4111-1111-1111-1111 and replaces it with [REDACTED].",
        },
        "check_fn": lambda r: (
            r["decision"] == "modified"
            and "4111" not in r.get("data", {}).get("answer", "4111"),
            f"decision={r['decision']}, answer={r.get('data', {}).get('answer', '')[:80]}",
        ),
    },
]


# ── Pretty-print helpers ────────────────────────────────────────────────────

def fmt_expected(expected: dict) -> str:
    lines = []
    for key, val in expected.items():
        if isinstance(val, dict):
            val_str = json.dumps(val)
        elif isinstance(val, list):
            val_str = json.dumps(val)
        else:
            val_str = str(val)
        lines.append(f"           {DIM}{key}: {val_str}{RST}")
    return "\n".join(lines)


def fmt_actual_short(resp: dict) -> str:
    lines = []
    lines.append(f"           decision: {resp.get('decision', '?')}")
    data = resp.get("data", {})
    if data:
        lines.append(f"           data: {json.dumps(data, default=str)[:200]}")
    trace = resp.get("trace", [])
    if trace:
        for i, t in enumerate(trace):
            lines.append(f"           trace[{i}]: policy={t.get('policy')}, action={t.get('action')}, details={json.dumps(t.get('details', {}))[:120]}")
    else:
        lines.append(f"           trace: []")
    return "\n".join(lines)


# ── Runner ──────────────────────────────────────────────────────────────────

def main():
    print(f"\n🧪 {BOLD}Acme Corp — Policy Test Suite{RST}")
    print("=" * 70)

    token = get_token()
    passed = 0
    failed = 0
    errors = []

    for i, test in enumerate(TESTS, 1):
        title = test["title"]
        payload = test["payload"]
        expected = test["expected"]
        check_fn = test["check_fn"]

        try:
            resp = simulate(token, payload)
            ok, detail = check_fn(resp)
            status = PASS if ok else FAIL
            if not ok:
                failed += 1
                errors.append((title, detail, resp))
            else:
                passed += 1

            print(f"\n  {status}  {BOLD}{i:2d}. {title}{RST}")
            print(f"\n       {CYAN}Expected:{RST}")
            print(fmt_expected(expected))
            print(f"\n       {CYAN}Actual:{RST}")
            print(fmt_actual_short(resp))

        except Exception as exc:
            failed += 1
            errors.append((title, str(exc), {}))
            print(f"\n  {FAIL}  {BOLD}{i:2d}. {title}{RST}")
            print(f"         ERROR: {exc}")

    # ── Summary ──────────────────────────────────────────────────────────
    total = passed + failed
    print("\n" + "=" * 70)
    print(f"  Results: {passed}/{total} passed", end="")
    if failed:
        print(f", {failed} failed")
        print("\n  Failed tests:")
        for title, detail, resp in errors:
            print(f"    • {title}")
            print(f"      → {detail}")
        print()
        sys.exit(1)
    else:
        print(" — all green! 🎉\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
