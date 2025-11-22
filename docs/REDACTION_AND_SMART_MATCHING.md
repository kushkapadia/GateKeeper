# GateKeeper: Intelligent Redaction & Smart Query Matching

This document explains the advanced redaction and query matching capabilities implemented in GateKeeper.

---

## Table of Contents

1. [PII Redaction (Post-Retrieval)](#pii-redaction-post-retrieval)
2. [Smart Query Matching (Pre-Query)](#smart-query-matching-pre-query)
3. [Post-Generation Enforcement](#post-generation-enforcement)
4. [Policy Examples](#policy-examples)
5. [API Usage](#api-usage)

---

## PII Redaction (Post-Retrieval)

### Overview

GateKeeper provides comprehensive PII detection and redaction for retrieved document chunks before they're sent to the LLM.

### Supported PII Types

| Pattern | Description | Example | Redacted |
|---------|-------------|---------|----------|
| `EMAIL` | Email addresses | `john@example.com` | `[EMAIL]` |
| `PHONE` | Phone numbers (various formats) | `+1-555-123-4567` | `[PHONE]` |
| `PAN` | Indian PAN numbers | `ABCDE1234F` | `[PAN]` |
| `AADHAAR` | Indian Aadhaar numbers | `1234 5678 9012` | `[AADHAAR]` |
| `CREDIT_CARD` | Credit card numbers | `1234-5678-9012-3456` | `[CREDIT_CARD]` |
| `SSN` | US Social Security Numbers | `123-45-6789` | `[SSN]` |
| `IP_ADDRESS` | IPv4 addresses | `192.168.1.1` | `[IP_ADDRESS]` |
| `SALARY` | Salary/currency amounts | `Rs. 50,000`, `$75,000` | `[SALARY]` |
| `MRN` | Medical Record Numbers | `MRN-123456` | `[MRN]` |
| `ID_NUMBER` | Generic ID numbers | `EMP-12345`, `CUST-98765` | `[ID_NUMBER]` |
| `PERSON_NAME` | Person names (with titles) | `Dr. John Smith` | `[PERSON_NAME]` |
| `DATE` | Dates in various formats | `12/31/2024`, `Dec 31, 2024` | `[DATE]` |

### Masking Strategies

```python
from backend.app.policies.redaction_patterns import MaskingStrategy

# FULL - Complete replacement
"secret" → "[REDACTED]"

# TYPE_LABEL - Replace with type name (default)
"john@example.com" → "[EMAIL]"

# PARTIAL - Keep first/last characters
"john@example.com" → "j**************m"

# HASH - Deterministic hash for consistency
"john@example.com" → "[EMAIL-4523]"
```

### Policy Configuration

```yaml
- name: redact-pii-from-hr-docs
  stage: post_retrieval
  priority: 90
  when:
    all:
      - user.role != "HR"
  match: {}
  action:
    type: redact
    patterns:
      - EMAIL
      - PHONE
      - PAN
      - SALARY
    fields:
      - text
      - metadata.notes
    tags:
      - hr
      - confidential
    drop_if:
      metadata.sensitivity: "confidential"
```

### Example Usage

```python
from backend.app.policies.redaction_patterns import redact_text, redact_chunks

# Redact specific patterns
text = "Contact john.doe@example.com or call +1-555-1234. PAN: ABCDE1234F"
redacted = redact_text(text, ["EMAIL", "PHONE", "PAN"])
# Result: "Contact [EMAIL] or call [PHONE]. PAN: [PAN]"

# Redact chunks from retrieval
chunks = [
    {
        "text": "Employee salary: Rs. 50,000. Email: hr@company.com",
        "metadata": {"tags": ["hr"]}
    }
]
redacted_chunks = redact_chunks(chunks, ["EMAIL", "SALARY"])
# Result: chunks with [EMAIL] and [SALARY] replacements
```

---

## Smart Query Matching (Pre-Query)

### Overview

Traditional keyword matching fails when users try to bypass filters. GateKeeper's smart matching detects obfuscation attempts.

### Obfuscation Techniques Detected

#### 1. **Homoglyphs** (lookalike characters)

```
Query: "What is the sаlаry?"  # 'а' is Cyrillic, not Latin 'a'
Normalized: "What is the salary?"
Status: ✅ BLOCKED
```

#### 2. **Leet Speak** (character substitutions)

```
Query: "What is the s@l@ry?"  # @ replacing 'a'
Normalized: "What is the salary?"
Status: ✅ BLOCKED
```

#### 3. **Separator Injection**

```
Query: "What is the s.a.l.a.r.y?"
Normalized: "What is the salary?"
Status: ✅ BLOCKED
```

#### 4. **Character Repetition**

```
Query: "What is the saaaaalary?"
Normalized: "What is the salary?"
Status: ✅ BLOCKED
```

#### 5. **Typos** (intentional or accidental)

```
Query: "What is the salery?"  # 1 typo
Fuzzy Match: ✅ MATCHES "salary"
Status: ✅ BLOCKED
```

#### 6. **Mixed Techniques**

```
Query: "What is the s-@-l-a-r-y?"  # Separators + leet speak
Normalized: "What is the salary?"
Status: ✅ BLOCKED
```

### Match Modes

#### **Fuzzy Mode** (default, recommended)

```yaml
match:
  query.text:
    - salary
    - compensation
  mode: fuzzy  # Handles typos, homoglyphs, separators
```

**Catches:**
- ✅ `salary`, `Salary`, `SALARY`
- ✅ `salaary`, `salery` (typos)
- ✅ `s@l@ry` (leet speak)
- ✅ `sаlаry` (Cyrillic)
- ✅ `s.a.l.a.r.y` (separators)
- ✅ `saaaalary` (repetition)

#### **Exact Mode**

```yaml
match:
  query.text:
    - salary
  mode: exact  # Only after normalization
```

**Catches:**
- ✅ `salary` (exact, case-insensitive)
- ✅ `s.a.l.a.r.y` (normalized to "salary")
- ❌ `salery` (typo not matched)

#### **Typo Mode**

```yaml
match:
  query.text:
    - salary
  mode: typo  # Edit distance ≤ 2
```

**Catches:**
- ✅ `salary`, `salery`, `salaary`
- ❌ `xyz` (too different)

#### **Semantic Mode**

```yaml
match:
  query.text:
    - salary_query  # Intent pattern name
  mode: semantic
```

**Catches:**
- ✅ `What is the CEO's salary?`
- ✅ `How much does John make?`
- ✅ `Tell me about compensation`
- ✅ `Show me the earnings data`

Uses pattern matching for intent detection without explicit keywords.

#### **Any Mode** (most aggressive)

```yaml
match:
  query.text:
    - salary
  mode: any  # Fuzzy OR typo OR exact
```

Tries all matching strategies. Use when maximum detection is needed.

### Normalization Pipeline

```
Input: "What is the s-@-l-а-r-y?"
    ↓
1. Homoglyph replacement: 'а' (Cyrillic) → 'a'
   "What is the s-@-l-a-r-y?"
    ↓
2. Leet speak: '@' → 'a'
   "What is the s-a-l-a-r-y?"
    ↓
3. Lowercase:
   "what is the s-a-l-a-r-y?"
    ↓
4. Remove separators: '-' between letters
   "what is the salary?"
    ↓
5. Collapse repeated chars: (none in this case)
   "what is the salary?"
    ↓
6. Normalize whitespace:
   "what is the salary?"

Final: "what is the salary?" → MATCHED ✅
```

### Policy Configuration

```yaml
- name: block-salary-queries
  stage: pre_query
  priority: 100
  when:
    any:
      - user.role != "HR"
      - user.role != "Finance"
  match:
    query.text:
      - salary
      - compensation
      - pay
      - earnings
      - income
    mode: fuzzy  # Smart matching
  action:
    type: block
    message: "Salary information is restricted to HR and Finance roles."
```

### Programmatic Usage

```python
from backend.app.policies.query_normalizer import smart_match, QueryMatcher

# Quick matching
is_blocked, matched_terms = smart_match(
    "What is the s@l@ry?",
    ["salary", "compensation"],
    match_mode="fuzzy"
)
# is_blocked = True, matched_terms = ["salary"]

# Advanced configuration
matcher = QueryMatcher(
    fuzzy_threshold=0.85,  # Similarity threshold
    max_typos=2,           # Allow up to 2 typos
    enable_normalization=True
)

matched, terms = matcher.matches(
    "What is the sаlаry?",  # Cyrillic
    ["salary"],
    match_mode="fuzzy"
)
# matched = True
```

---

## Post-Generation Enforcement

### Overview

Validate LLM-generated responses before returning them to users.

### Enforcement Types

#### 1. **Citation Requirements**

```yaml
action:
  type: enforce
  citations: true
```

**Requires:** At least one citation in format `[1]`, `[source]`, or `[ref]`

**Example:**
```
✅ Allowed: "The sky is blue [1]. Water is wet [source]."
❌ Blocked: "The sky is blue. Water is wet."
```

#### 2. **Style Enforcement**

```yaml
action:
  type: enforce
  style: formal
```

**Blocks informal language:**
```
❌ "Yeah, this is gonna be awesome lol!!!"
✅ "This will be excellent."
```

#### 3. **Confidence Thresholds** (placeholder)

```yaml
action:
  type: enforce
  min_confidence: 0.8
```

*Note: Requires LLM metadata integration (future feature)*

### Policy Example

```yaml
- name: enforce-citations
  stage: post_generation
  priority: 80
  when:
    all:
      - request.require_citations == true
  match: {}
  action:
    type: enforce
    citations: true
    style: formal
    message: "Response must include citations and maintain formal tone."
```

---

## Complete Policy Examples

### Example 1: Block Salary Queries with Smart Matching

```yaml
- name: block-salary-queries-smart
  stage: pre_query
  priority: 100
  when:
    any:
      - user.role != "HR"
      - user.role != "Finance"
  match:
    query.text:
      - salary
      - compensation
      - pay
      - earnings
      - income
      - wage
    mode: fuzzy  # Detects s@l@ry, salaary, s.a.l.a.r.y, etc.
  action:
    type: block
    message: "Salary information is restricted. Contact HR for assistance."
```

**Blocks:**
- "What is John's salary?"
- "What is John's s@l@ry?"
- "What is John's saaaaalary?"
- "What is John's s.a.l.a.r.y?"
- "What is John's sаlаry?" (Cyrillic)
- "What is John's salery?" (typo)

### Example 2: Redact PII from Medical Records

```yaml
- name: redact-medical-pii
  stage: post_retrieval
  priority: 90
  when:
    all:
      - user.role != "Doctor"
      - user.clearance < 3
  match: {}
  action:
    type: redact
    patterns:
      - PERSON_NAME
      - EMAIL
      - PHONE
      - MRN
      - DATE
      - IP_ADDRESS
    fields:
      - text
      - metadata.patient_notes
    tags:
      - medical
      - patient-data
```

**Before redaction:**
```
{
  "text": "Patient Dr. Jane Smith, MRN-123456, contacted at jane@hospital.com or 555-1234. Admitted on 12/31/2024.",
  "metadata": {"tags": ["medical"]}
}
```

**After redaction:**
```
{
  "text": "Patient [PERSON_NAME], [MRN], contacted at [EMAIL] or [PHONE]. Admitted on [DATE].",
  "metadata": {"tags": ["medical"]}
}
```

### Example 3: Semantic Intent Blocking

```yaml
- name: block-salary-intent
  stage: pre_query
  priority: 100
  when:
    any:
      - user.role == "Intern"
      - user.role == "Contractor"
  match:
    query.text:
      - salary_query  # Semantic pattern
    mode: semantic
  action:
    type: block
    message: "You do not have access to compensation information."
```

**Blocks any query matching salary intent:**
- "How much does the CEO make?"
- "What's the compensation for managers?"
- "Tell me about employee pay"
- "Show me earnings data"

---

## API Usage

### Enforcement Request (Post-Retrieval)

```bash
POST /v1/enforce?stage=post_retrieval
Content-Type: application/json
Authorization: Bearer <token>

{
  "user": {
    "id": "U123",
    "role": "Employee",
    "department": "Engineering"
  },
  "request": {
    "query": "What is the CEO's contact info?"
  },
  "artifacts": {
    "chunks": [
      {
        "text": "CEO John Smith, email: ceo@company.com, phone: 555-CEO-1234",
        "metadata": {"tags": ["executive", "confidential"]}
      }
    ]
  },
  "policyVersion": "v0"
}
```

**Response:**

```json
{
  "decision": "modified",
  "data": {
    "artifacts": {
      "chunks": [
        {
          "text": "CEO [PERSON_NAME], email: [EMAIL], phone: [PHONE]",
          "metadata": {"tags": ["executive", "confidential"]}
        }
      ]
    }
  },
  "auditId": "audit-stub",
  "trace": [
    {
      "policy": "redact-executive-pii",
      "action": "redact",
      "patterns": ["EMAIL", "PHONE", "PERSON_NAME"],
      "fields": ["text"]
    }
  ]
}
```

### Enforcement Request (Pre-Query with Smart Matching)

```bash
POST /v1/enforce?stage=pre_query

{
  "user": {"id": "U123", "role": "Intern"},
  "request": {"query": "What is the s@l@ry of the CEO?"},
  "policyVersion": "v0"
}
```

**Response (Blocked):**

```json
{
  "decision": "blocked",
  "data": {
    "message": "Salary information is restricted."
  },
  "trace": [
    {
      "policy": "block-salary-queries-smart",
      "action": "block",
      "matched_terms": ["salary"],
      "match_mode": "fuzzy",
      "original_query": "What is the s@l@ry of the CEO?",
      "normalized_query": "what is the salary of the ceo?"
    }
  ]
}
```

---

## Testing

### Run Redaction Tests

```bash
pytest tests/test_redaction.py -v
```

### Run Query Normalizer Tests

```bash
pytest tests/test_query_normalizer.py -v
```

### Example Test Cases

```python
from backend.app.policies.redaction_patterns import redact_text
from backend.app.policies.query_normalizer import smart_match

# Test PII redaction
text = "Contact john@example.com or call 555-1234"
result = redact_text(text, ["EMAIL", "PHONE"])
assert "[EMAIL]" in result
assert "[PHONE]" in result

# Test smart matching
is_blocked, terms = smart_match("What is the s@l@ry?", ["salary"], "fuzzy")
assert is_blocked is True
assert "salary" in terms
```

---

## Summary

GateKeeper now provides:

✅ **Comprehensive PII Redaction**
- 12+ built-in PII patterns
- Configurable masking strategies
- Field-level and tag-based filtering
- Chunk dropping capabilities

✅ **Intelligent Query Matching**
- Homoglyph detection (Cyrillic, Greek, symbols)
- Leet speak normalization (@, $, 3, 4, etc.)
- Separator bypass detection (., -, _, spaces)
- Typo tolerance (edit distance ≤ 2)
- Character repetition handling
- Semantic intent matching

✅ **Post-Generation Enforcement**
- Citation requirements
- Style validation (formal/informal)
- Quality gating

✅ **Comprehensive Testing**
- 50+ test cases for redaction
- 40+ test cases for smart matching
- Real-world obfuscation examples

---

**Next Steps:**
- Integrate with audit logging
- Add Redis caching for normalized queries
- Implement advanced NER-based redaction
- Add custom pattern registration API
