#!/usr/bin/env python3
"""Acme Corp demo seeder.

Creates a tenant, uploads the schema descriptor, and seeds 8 realistic
policies spanning all 4 RAG pipeline stages.

Usage:
    python demo/seed.py

Prerequisite: the backend server must be running on localhost:8000.
"""

import json
import sys
import requests

BASE = "http://localhost:8000"
TENANT_NAME = "acme"
TENANT_PASSWORD = "admin"

# ── 1. Create tenant (or login if it already exists) ─────────────────────

def get_token() -> str:
    r = requests.post(f"{BASE}/api/auth/login", json={
        "name": TENANT_NAME,
        "password": TENANT_PASSWORD,
    })
    if r.ok:
        print(f"  Logged in as '{TENANT_NAME}'")
        return r.json()["token"]

    # Tenant doesn't exist or wrong password — upsert it directly in the DB
    import psycopg, bcrypt
    db_url = "postgresql://global@localhost:5432/gatekeeper"
    pw_hash = bcrypt.hashpw(TENANT_PASSWORD.encode(), bcrypt.gensalt()).decode()
    with psycopg.connect(db_url) as conn:
        conn.execute(
            """INSERT INTO tenants (name, password_hash) VALUES (%s, %s)
               ON CONFLICT (name) DO UPDATE SET password_hash = EXCLUDED.password_hash""",
            (TENANT_NAME, pw_hash),
        )
        conn.commit()
    print(f"  Created tenant '{TENANT_NAME}'")
    r = requests.post(f"{BASE}/api/auth/login", json={
        "name": TENANT_NAME,
        "password": TENANT_PASSWORD,
    })
    r.raise_for_status()
    return r.json()["token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── 2. Upload descriptor ────────────────────────────────────────────────

def upload_descriptor(token: str):
    with open("demo/descriptor.yaml") as f:
        content = f.read()
    r = requests.put(f"{BASE}/api/schema/descriptor", headers=auth(token), json={
        "version": "v0",
        "content": content,
    })
    r.raise_for_status()
    print("  Uploaded descriptor.yaml")


# ── 3. Seed policies ───────────────────────────────────────────────────

POLICIES = [

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 1: PRE-QUERY
    # These policies run BEFORE the user's question reaches the vector DB
    # or the LLM. Their job is to block dangerous or unauthorized questions
    # at the front door, before any retrieval or generation happens.
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ── Policy 1: block-intern-salary ──────────────────────────────────────
    #
    # WHAT IT DOES:
    #   Blocks interns and contractors from asking anything related to
    #   salary, compensation, bonuses, or pay packages.
    #
    # WHO IT TARGETS:
    #   Users whose role is "intern" OR whose employment_type is "contractor".
    #   Full-time employees, managers, HR admins, and executives are NOT affected.
    #
    # HOW IT WORKS:
    #   1. First checks the "when" condition — is the user an intern or contractor?
    #      If not, the policy is skipped entirely.
    #   2. Then checks "match" — does the user's query contain any of these words:
    #      salary, compensation, CTC, pay, bonus, package, stipend, wages, remuneration?
    #      This uses multi-layer detection (exact match, fuzzy match, leetspeak,
    #      separator stripping) so "s.a.l.a.r.y" and "s4l4ry" are also caught.
    #   3. If BOTH conditions are true → BLOCK the query with a message.
    #
    # REAL-WORLD SCENARIO:
    #   An intern types "What is the CEO's salary?" → Blocked.
    #   The same intern types "How many leave days do I get?" → Allowed (no blocked term).
    #   A full-time HR employee types "What is the salary range?" → Allowed (not intern/contractor).
    #
    {
        "name": "block-intern-salary",
        "stage": "pre_query",
        "priority": 100,
        "enabled": True,
        "labels": {"hr": True, "sensitive": True},
        "distilled_prompt": "Do not reveal salary, compensation, CTC, or bonus details to interns or contractors.",
        "content": {
            "name": "block-intern-salary",
            "stage": "pre_query",
            "when": {
                "any": [
                    {"expr": 'user.role == "intern"'},
                    {"expr": 'user.employment_type == "contractor"'},
                ]
            },
            "match": {
                "query.text": [
                    "salary", "compensation", "CTC", "pay", "bonus",
                    "package", "stipend", "wages", "remuneration",
                ]
            },
            "action": {
                "type": "block",
                "message": "Salary and compensation information is restricted for your role.",
            },
        },
    },

    # ── Policy 2: block-legal-privileged ───────────────────────────────────
    #
    # WHAT IT DOES:
    #   Prevents anyone outside the legal department from asking about
    #   lawsuits, litigation, settlements, attorney-client privileged
    #   matters, court orders, or subpoenas.
    #
    # WHO IT TARGETS:
    #   Every user whose department is NOT "legal".
    #   Legal counsel and legal staff can ask these questions freely.
    #
    # HOW IT WORKS:
    #   1. "when" checks: is user.department != "legal"? If user IS in legal, skip.
    #   2. "match" checks: does the query contain lawsuit, litigation, settlement,
    #      attorney, privileged, court order, or subpoena?
    #   3. Both true → BLOCK.
    #
    # REAL-WORLD SCENARIO:
    #   An engineer types "What's the status of the ongoing lawsuit?" → Blocked.
    #   A legal counsel types the same question → Allowed (they're in the legal dept).
    #
    {
        "name": "block-legal-privileged",
        "stage": "pre_query",
        "priority": 90,
        "enabled": True,
        "labels": {"legal": True},
        "distilled_prompt": "Do not discuss ongoing litigation, lawsuits, or attorney-client privileged matters with non-legal staff.",
        "content": {
            "name": "block-legal-privileged",
            "stage": "pre_query",
            "when": {
                "all": [
                    {"expr": 'user.department != "legal"'},
                ]
            },
            "match": {
                "query.text": [
                    "lawsuit", "litigation", "legal action", "settlement",
                    "attorney", "privileged", "court order", "subpoena",
                ]
            },
            "action": {
                "type": "block",
                "message": "Legal matters are restricted to the legal department.",
            },
        },
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 2: PRE-RETRIEVAL
    # These policies run AFTER the query is allowed but BEFORE documents
    # are fetched from the vector database. They modify the retrieval
    # filters to control WHICH documents the vector DB returns.
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ── Policy 3: scope-department-docs ────────────────────────────────────
    #
    # WHAT IT DOES:
    #   Forces regular employees to only see documents from their own
    #   department. An engineering employee can only retrieve engineering
    #   docs, an HR employee only HR docs, etc.
    #
    # WHO IT TARGETS:
    #   Everyone who is NOT a "manager" AND NOT an "executive".
    #   Managers and executives can search across all departments.
    #
    # HOW IT WORKS:
    #   1. "when" checks: is user.role != "manager" AND user.role != "executive"?
    #      If the user is a manager or executive, this policy is skipped.
    #   2. If the condition matches, the action INJECTS a metadata filter:
    #      department = the user's own department (e.g., "engineering").
    #      This filter gets sent to the vector DB so it only returns
    #      documents tagged with that department.
    #
    # REAL-WORLD SCENARIO:
    #   An engineering employee searches "onboarding documents" →
    #      Filter {department: "engineering"} is injected → only engineering
    #      onboarding docs come back (not HR's or finance's).
    #   A manager searches the same thing → no filter injected → they see
    #      onboarding docs from ALL departments.
    #
    {
        "name": "scope-department-docs",
        "stage": "pre_retrieval",
        "priority": 80,
        "enabled": True,
        "labels": {"rbac": True},
        "distilled_prompt": "Only retrieve documents from the user's own department unless they are a manager or executive.",
        "content": {
            "name": "scope-department-docs",
            "stage": "pre_retrieval",
            "when": {
                "all": [
                    {"expr": 'user.role != "manager"'},
                    {"expr": 'user.role != "executive"'},
                ]
            },
            "action": {
                "type": "rewrite",
                "filters": {
                    "add": {"department": "${user.department}"},
                },
            },
        },
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 3: POST-RETRIEVAL
    # These policies run AFTER documents (chunks) are fetched from the
    # vector DB but BEFORE they are sent to the LLM. They clean up
    # sensitive content from the retrieved chunks.
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ── Policy 4: redact-pii-from-chunks ───────────────────────────────────
    #
    # WHAT IT DOES:
    #   Scans every retrieved document chunk for personal identifiable
    #   information (PII) — emails, phone numbers, SSNs, PAN numbers,
    #   Aadhaar numbers — and replaces them with [REDACTED].
    #   Also blanks out the "author" metadata field.
    #
    # WHO IT TARGETS:
    #   ALL users, unconditionally. There is no "when" condition.
    #   PII should never reach the LLM regardless of who is asking.
    #
    # HOW IT WORKS:
    #   1. No "when" condition → always runs for every post_retrieval request.
    #   2. Applies regex patterns for EMAIL, PHONE, SSN, PAN, AADHAAR to
    #      the text content of each chunk.
    #   3. Also blanks the "author" metadata field to "[REDACTED]".
    #   4. Returns the sanitized chunks → these go to the LLM instead of
    #      the originals.
    #
    # REAL-WORLD SCENARIO:
    #   A chunk says "Contact John at john.doe@acme.com, SSN: 123-45-6789"
    #   → becomes "Contact John at [REDACTED], SSN: [REDACTED]"
    #   The LLM never sees the actual email or SSN.
    #
    {
        "name": "redact-pii-from-chunks",
        "stage": "post_retrieval",
        "priority": 100,
        "enabled": True,
        "labels": {"pii": True, "compliance": True},
        "distilled_prompt": "All personal identifiable information (emails, phones, national IDs) must be masked before the LLM sees any document.",
        "content": {
            "name": "redact-pii-from-chunks",
            "stage": "post_retrieval",
            "action": {
                "type": "redact",
                "patterns": ["EMAIL", "PHONE", "SSN", "PAN", "AADHAAR"],
                "fields": ["author"],
            },
        },
    },

    # ── Policy 5: drop-confidential-low-clearance ─────────────────────────
    #
    # WHAT IT DOES:
    #   Completely removes (drops) any document chunk that is marked as
    #   "confidential" if the user has low or medium security clearance.
    #   The LLM never sees these chunks at all — they're silently removed.
    #
    # WHO IT TARGETS:
    #   Users with clearance "low" OR "medium".
    #   Users with "high" or "executive" clearance keep all chunks.
    #
    # HOW IT WORKS:
    #   1. "when" checks: is user.clearance == "low" or "medium"?
    #      If the user has high/executive clearance, skip this policy.
    #   2. Looks at each chunk's metadata.sensitivity field.
    #   3. If sensitivity == "confidential" → DROP that chunk entirely.
    #   4. Public and internal chunks are kept.
    #
    # REAL-WORLD SCENARIO:
    #   A low-clearance employee retrieves 3 chunks:
    #     - "Public overview" (public) → kept
    #     - "Q3 financials: $50M revenue" (confidential) → DROPPED
    #     - "Office relocation memo" (internal) → kept
    #   The LLM only sees the 2 non-confidential chunks.
    #
    {
        "name": "drop-confidential-low-clearance",
        "stage": "post_retrieval",
        "priority": 90,
        "enabled": True,
        "labels": {"abac": True, "sensitive": True},
        "distilled_prompt": "Remove confidential and restricted documents for users without high or executive clearance.",
        "content": {
            "name": "drop-confidential-low-clearance",
            "stage": "post_retrieval",
            "when": {
                "any": [
                    {"expr": 'user.clearance == "low"'},
                    {"expr": 'user.clearance == "medium"'},
                ]
            },
            "match": {
                "chunk.metadata.sensitivity": ["confidential", "restricted"],
            },
            "action": {
                "type": "filter",
                "drop_if": {"sensitivity": "confidential"},
            },
        },
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STAGE 4: POST-GENERATION
    # These policies run AFTER the LLM generates an answer but BEFORE
    # it reaches the user. They are the last line of defense — catching
    # anything the LLM might have leaked, hallucinated, or generated
    # without proper evidence.
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ── Policy 6: enforce-answer-quality ───────────────────────────────────
    #
    # WHAT IT DOES:
    #   Ensures every LLM answer meets minimum quality standards:
    #   it must cite at least 1 source document, and the LLM's own
    #   confidence score must be above 0.6 (60%).
    #   If either check fails, the answer is BLOCKED and replaced with
    #   a safe fallback message.
    #
    # WHO IT TARGETS:
    #   ALL users, unconditionally. No "when" condition.
    #   Every answer must have evidence, regardless of who asked.
    #
    # HOW IT WORKS:
    #   1. Checks artifacts.generated_response.citations — must have ≥ 1 item.
    #   2. Checks artifacts.generated_response.confidence — must be ≥ 0.6.
    #   3. If either fails → BLOCK and replace with fallback message:
    #      "I'm not confident enough to provide a reliable answer."
    #
    # REAL-WORLD SCENARIO:
    #   LLM generates "The company was founded in 2010." with citations=[]
    #   → Blocked (no citations). User sees the fallback instead.
    #   LLM generates same answer with citations=["doc-001"], confidence=0.3
    #   → Blocked (confidence too low).
    #   LLM generates with citations=["doc-001","doc-002"], confidence=0.95
    #   → Allowed (passes both checks).
    #
    {
        "name": "enforce-answer-quality",
        "stage": "post_generation",
        "priority": 100,
        "enabled": True,
        "labels": {"quality": True},
        "distilled_prompt": "Every answer must cite at least 1 source document and have a confidence score above 0.6.",
        "content": {
            "name": "enforce-answer-quality",
            "stage": "post_generation",
            "action": {
                "type": "enforce",
                "citations": {"min": 1},
                "min_confidence": 0.6,
                "fallback": "I'm not confident enough to provide a reliable answer. Please consult the original documents.",
            },
        },
    },

    # ── Policy 7: redact-pii-from-answer ──────────────────────────────────
    #
    # WHAT IT DOES:
    #   Even after PII was redacted from the input chunks (Policy 4),
    #   the LLM might hallucinate or reconstruct PII in its answer.
    #   This policy scans the FINAL generated answer for emails, phones,
    #   SSNs, PAN numbers, and credit card numbers, and masks them.
    #
    # WHO IT TARGETS:
    #   ALL users, unconditionally.
    #   This is a compliance safety net — PII must never reach the end user.
    #
    # HOW IT WORKS:
    #   1. No "when" condition → always runs.
    #   2. Applies regex patterns for EMAIL, PHONE, SSN, PAN, CREDIT_CARD
    #      to the generated answer text.
    #   3. Replaces matches with [REDACTED].
    #   4. Returns decision=modified with the cleaned answer.
    #
    # REAL-WORLD SCENARIO:
    #   LLM answer: "Contact HR at hr@acme.com or call 555-987-6543."
    #   → becomes: "Contact HR at [REDACTED] or call [REDACTED]."
    #   LLM answer: "The corporate card is 4111-1111-1111-1111."
    #   → becomes: "The corporate card is [REDACTED]."
    #
    {
        "name": "redact-pii-from-answer",
        "stage": "post_generation",
        "priority": 90,
        "enabled": True,
        "labels": {"pii": True, "compliance": True},
        "distilled_prompt": "If any PII leaks into the generated answer, it must be masked before reaching the user.",
        "content": {
            "name": "redact-pii-from-answer",
            "stage": "post_generation",
            "action": {
                "type": "redact",
                "patterns": ["EMAIL", "PHONE", "SSN", "PAN", "CREDIT_CARD"],
            },
        },
    },

    # ── Policy 8: block-salary-in-answer ──────────────────────────────────
    #
    # WHAT IT DOES:
    #   Even if a query was allowed through pre_query (because the user
    #   is a full-time employee), the LLM might still include salary or
    #   compensation data in its answer. This policy checks the FINAL
    #   answer for salary-related words and blocks it for non-HR,
    #   non-executive users.
    #
    #   Think of it as a second layer: Policy 1 blocks the question,
    #   Policy 8 blocks the answer. Together they cover both sides.
    #
    # WHO IT TARGETS:
    #   Everyone who is NOT an "hr_admin" AND NOT an "executive".
    #   HR admins and executives are allowed to see salary data.
    #
    # HOW IT WORKS:
    #   1. "when" checks: is user.role != "hr_admin" AND != "executive"?
    #   2. "match" scans the answer text for: salary, compensation, CTC,
    #      bonus, package.
    #   3. If the answer contains any of these → BLOCK with message:
    #      "The answer contained compensation data that is restricted."
    #
    # REAL-WORLD SCENARIO:
    #   An engineer's query passes pre_query (they're not an intern).
    #   The LLM generates: "The average salary is $150,000 with a bonus."
    #   → BLOCKED because "salary" and "bonus" are in the answer and
    #     the user is not hr_admin/executive.
    #   An HR admin gets the same answer → ALLOWED (exempt).
    #
    {
        "name": "block-salary-in-answer",
        "stage": "post_generation",
        "priority": 80,
        "enabled": True,
        "labels": {"hr": True, "sensitive": True},
        "distilled_prompt": "Never include salary figures or compensation data in responses to non-HR, non-executive users.",
        "content": {
            "name": "block-salary-in-answer",
            "stage": "post_generation",
            "when": {
                "all": [
                    {"expr": 'user.role != "hr_admin"'},
                    {"expr": 'user.role != "executive"'},
                ]
            },
            "match": {
                "answer.text": ["salary", "compensation", "CTC", "bonus", "package"],
            },
            "action": {
                "type": "block",
                "message": "The answer contained compensation data that is restricted for your role.",
            },
        },
    },
]


def seed_policies(token: str):
    # Delete existing policies first to avoid duplicates
    r = requests.get(f"{BASE}/api/policies?version=v0", headers=auth(token))
    if r.ok:
        existing = r.json().get("policies", [])
        for p in existing:
            requests.delete(f"{BASE}/api/policies/{p['id']}", headers=auth(token))
        if existing:
            print(f"  Cleaned {len(existing)} existing policies")

    for pol in POLICIES:
        r = requests.post(f"{BASE}/api/policies", headers=auth(token), json=pol)
        r.raise_for_status()
        print(f"  Created: {pol['name']} ({pol['stage']})")


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    print("\n🏢 Acme Corp Demo Seeder")
    print("=" * 50)

    print("\n[1/3] Authenticating...")
    token = get_token()

    print("\n[2/3] Uploading schema descriptor...")
    upload_descriptor(token)

    print("\n[3/3] Seeding policies...")
    seed_policies(token)

    print(f"\n✅ Done! Created {len(POLICIES)} policies across all 4 stages.")
    print(f"   Login: name={TENANT_NAME} password={TENANT_PASSWORD}")
    print(f"   Now run: python demo/test_scenarios.py\n")


if __name__ == "__main__":
    main()
