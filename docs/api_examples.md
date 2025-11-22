# GateKeeper API Examples

## Request/Response Examples for All 4 Enforcement Stages

---

## Stage 1: Pre-Query

**Purpose:** Validate and sanitize user queries before any retrieval or model call.

**What's Available:**
- User context (role, department, clearance)
- Raw query text
- Request metadata (index, filters if pre-filled)

**Example Request:**
```json
{
  "stage": "pre_query",
  "user": {
    "id": "U123",
    "role": "intern",
    "department": "HR",
    "clearance": 1
  },
  "request": {
    "query": {
      "text": "What is the CEO's salary?",
      "intent": "salary_inquiry"
    },
    "index": "employee_docs",
    "filters": {}
  },
  "artifacts": {},
  "policyVersion": "v0",
  "correlationId": "req-001"
}
```

**Example Response (Blocked):**
```json
{
  "decision": "blocked",
  "data": {},
  "auditId": "audit-20241201-001",
  "trace": [
    {
      "policy": "block_salary_queries",
      "stage": "pre_query",
      "action": "block",
      "reason": "Interns cannot access salary information"
    }
  ],
  "policyContext": null
}
```

**Example Response (Allowed with Context):**
```json
{
  "decision": "allowed",
  "data": {
    "query": {
      "text": "Show me HR policies summary",
      "intent": "general_inquiry"
    }
  },
  "auditId": "audit-20241201-002",
  "trace": [
    {
      "policy": "rewrite_sensitive_queries",
      "stage": "pre_query",
      "action": "rewrite",
      "reason": "Query rewritten to general HR policies"
    }
  ],
  "policyContext": {
    "instruction": "You are a helpful assistant for HR department documentation.",
    "required_behavior": "Do not reveal specific employee salaries or compensation details. Provide only general policy information.",
    "normalization_hints": ["collapse_repeats", "ignore_separators"],
    "role_scope": {
      "role": "intern",
      "department": "HR"
    },
    "rules": [
      "Do not answer questions about individual employee salaries.",
      "Refer salary-related queries to HR department."
    ]
  }
}
```

---

## Stage 2: Pre-Retrieval

**Purpose:** Constrain document retrieval scope using metadata filters (RBAC/ABAC).

**What's Available:**
- User context (role, department, clearance)
- Query (possibly rewritten from pre-query)
- Filters to be applied
- Index/collection information

**Example Request:**
```json
{
  "stage": "pre_retrieval",
  "user": {
    "id": "U456",
    "role": "nurse",
    "department": "ICU",
    "clearance": 3,
    "region": "US-East"
  },
  "request": {
    "query": {
      "text": "Show me patient protocols for emergency situations"
    },
    "index": "medical_docs",
    "filters": {
      "category": "protocols"
    },
    "top_k": 10
  },
  "artifacts": {},
  "policyVersion": "v0",
  "correlationId": "req-002"
}
```

**Example Response (Modified Filters):**
```json
{
  "decision": "modified",
  "data": {
    "filters": {
      "category": "protocols",
      "department": "ICU",
      "sensitivity": {
        "$lte": 3
      },
      "region": "US-East"
    },
    "top_k": 10
  },
  "auditId": "audit-20241201-003",
  "trace": [
    {
      "policy": "scope_by_department",
      "stage": "pre_retrieval",
      "action": "rewrite",
      "reason": "Added department filter: ICU"
    },
    {
      "policy": "enforce_clearance_level",
      "stage": "pre_retrieval",
      "action": "rewrite",
      "reason": "Added clearance filter: max 3"
    },
    {
      "policy": "region_isolation",
      "stage": "pre_retrieval",
      "action": "rewrite",
      "reason": "Added region filter: US-East"
    }
  ],
  "policyContext": {
    "instruction": "You are retrieving medical documentation for ICU department.",
    "required_behavior": "Only return documents accessible to clearance level 3 or below. Filter by region US-East.",
    "normalization_hints": [],
    "role_scope": {
      "role": "nurse",
      "department": "ICU",
      "clearance": 3
    },
    "rules": [
      "Retrieve only ICU department documents.",
      "Exclude documents with sensitivity > 3.",
      "Include only US-East region documents."
    ]
  }
}
```

---

## Stage 3: Post-Retrieval

**Purpose:** Redact/filter retrieved chunks before sending to LLM.

**What's Available:**
- User context
- Query
- Retrieved chunks with metadata
- Filters that were applied

**Example Request:**
```json
{
  "stage": "post_retrieval",
  "user": {
    "id": "U789",
    "role": "analyst",
    "department": "Finance",
    "clearance": 2
  },
  "request": {
    "query": {
      "text": "What are the Q4 financial results?"
    },
    "index": "financial_reports",
    "filters": {
      "department": "Finance",
      "quarter": "Q4"
    }
  },
  "artifacts": {
    "chunks": [
      {
        "id": "chunk-001",
        "text": "Q4 revenue was $12.5M, with CEO compensation of $2.3M...",
        "metadata": {
          "tags": ["revenue", "compensation", "confidential"],
          "sensitivity": "restricted",
          "department": "Finance",
          "date": "2024-12-01"
        },
        "score": 0.95
      },
      {
        "id": "chunk-002",
        "text": "Q4 expenses breakdown: Operations $5.2M, Marketing $1.8M...",
        "metadata": {
          "tags": ["expenses", "operations"],
          "sensitivity": "public",
          "department": "Finance",
          "date": "2024-12-01"
        },
        "score": 0.87
      },
      {
        "id": "chunk-003",
        "text": "The board approved a merger with Company X. Details: SSN: 123-45-6789...",
        "metadata": {
          "tags": ["merger", "PII"],
          "sensitivity": "confidential",
          "department": "Finance",
          "date": "2024-12-01"
        },
        "score": 0.82
      }
    ]
  },
  "policyVersion": "v0",
  "correlationId": "req-003"
}
```

**Example Response (Filtered & Redacted):**
```json
{
  "decision": "modified",
  "data": {
    "chunks": [
      {
        "id": "chunk-001",
        "text": "[REDACTED: compensation] Q4 revenue was $12.5M...",
        "metadata": {
          "tags": ["revenue", "confidential"],
          "sensitivity": "restricted",
          "department": "Finance",
          "date": "2024-12-01"
        },
        "score": 0.95
      },
      {
        "id": "chunk-002",
        "text": "Q4 expenses breakdown: Operations $5.2M, Marketing $1.8M...",
        "metadata": {
          "tags": ["expenses", "operations"],
          "sensitivity": "public",
          "department": "Finance",
          "date": "2024-12-01"
        },
        "score": 0.87
      }
    ]
  },
  "auditId": "audit-20241201-004",
  "trace": [
    {
      "policy": "redact_compensation",
      "stage": "post_retrieval",
      "action": "redact",
      "reason": "Redacted compensation information from chunk-001"
    },
    {
      "policy": "filter_confidential",
      "stage": "post_retrieval",
      "action": "filter",
      "reason": "Dropped chunk-003 (sensitivity: confidential > clearance: 2)"
    },
    {
      "policy": "redact_pii",
      "stage": "post_retrieval",
      "action": "redact",
      "reason": "Redacted SSN from chunk-003 before drop"
    }
  ],
  "policyContext": null
}
```

---

## Stage 4: Post-Generation

**Purpose:** Enforce citations, confidence thresholds, tone safety on final output.

**What's Available:**
- User context
- Query
- Retrieved chunks (possibly filtered/redacted)
- Generated response from LLM
- Citations/metadata from generation

**Example Request:**
```json
{
  "stage": "post_generation",
  "user": {
    "id": "U321",
    "role": "manager",
    "department": "Sales",
    "clearance": 4
  },
  "request": {
    "query": {
      "text": "What were our top-selling products last month?"
    },
    "index": "sales_data",
    "filters": {
      "department": "Sales",
      "month": "2024-11"
    }
  },
  "artifacts": {
    "chunks": [
      {
        "id": "chunk-004",
        "text": "November sales: Product A ($50K), Product B ($45K), Product C ($30K)...",
        "metadata": {
          "tags": ["sales", "november"],
          "source": "sales_report_2024_11.pdf",
          "page": 5
        },
        "score": 0.92
      }
    ],
    "generated_response": {
      "text": "Last month, our top-selling products were Product A with $50,000 in revenue, followed by Product B at $45,000, and Product C at $30,000. These three products accounted for over 60% of our total sales.",
      "citations": [
        {
          "chunk_id": "chunk-004",
          "source": "sales_report_2024_11.pdf",
          "page": 5
        }
      ],
      "confidence": 0.88,
      "tokens": 156
    }
  },
  "policyVersion": "v0",
  "correlationId": "req-004"
}
```

**Example Response (Enforced Citations):**
```json
{
  "decision": "modified",
  "data": {
    "generated_response": {
      "text": "Last month, our top-selling products were Product A with $50,000 in revenue, followed by Product B at $45,000, and Product C at $30,000. These three products accounted for over 60% of our total sales.",
      "citations": [
        {
          "chunk_id": "chunk-004",
          "source": "sales_report_2024_11.pdf",
          "page": 5,
          "link": "https://docs.example.com/sales_report_2024_11.pdf#page=5"
        }
      ],
      "confidence": 0.88,
      "tokens": 156,
      "metadata": {
        "policy_enforced": true,
        "citation_required": true,
        "min_confidence_met": true
      }
    }
  },
  "auditId": "audit-20241201-005",
  "trace": [
    {
      "policy": "require_citations",
      "stage": "post_generation",
      "action": "enforce",
      "reason": "Added source links to citations"
    },
    {
      "policy": "verify_confidence",
      "stage": "post_generation",
      "action": "enforce",
      "reason": "Confidence 0.88 meets minimum threshold (0.75)"
    }
  ],
  "policyContext": null
}
```

**Example Response (Blocked - Low Confidence):**
```json
{
  "decision": "blocked",
  "data": {
    "generated_response": {
      "text": "[Response blocked: Confidence score 0.65 is below minimum threshold of 0.75]",
      "citations": [],
      "confidence": 0.65,
      "tokens": 0
    }
  },
  "auditId": "audit-20241201-006",
  "trace": [
    {
      "policy": "minimum_confidence_threshold",
      "stage": "post_generation",
      "action": "block",
      "reason": "Confidence 0.65 < 0.75 threshold"
    }
  ],
  "policyContext": null
}
```

---

## Complete Flow Example

**End-to-End Request Flow:**

```json
// 1. PRE-QUERY
{
  "stage": "pre_query",
  "user": { "id": "U123", "role": "intern", "department": "HR" },
  "request": { "query": { "text": "What is the CEO's salary?" } },
  "policyVersion": "v0",
  "correlationId": "req-001"
}
// Response: decision="blocked" OR decision="allowed" with rewritten query

// 2. PRE-RETRIEVAL (only if pre_query allowed)
{
  "stage": "pre_retrieval",
  "user": { "id": "U123", "role": "intern", "department": "HR" },
  "request": {
    "query": { "text": "Show me HR policies summary" }, // rewritten
    "index": "hr_docs",
    "filters": {}
  },
  "policyVersion": "v0",
  "correlationId": "req-001" // same correlation ID
}
// Response: decision="modified", data.filters={department: "HR", sensitivity: {$lte: 1}}

// 3. POST-RETRIEVAL (after vector DB returns chunks)
{
  "stage": "post_retrieval",
  "user": { "id": "U123", "role": "intern", "department": "HR" },
  "request": {
    "query": { "text": "Show me HR policies summary" },
    "index": "hr_docs",
    "filters": { "department": "HR", "sensitivity": { "$lte": 1 } }
  },
  "artifacts": {
    "chunks": [
      { "id": "c1", "text": "HR policies...", "metadata": {...} },
      { "id": "c2", "text": "[Salary data]...", "metadata": {...} }
    ]
  },
  "policyVersion": "v0",
  "correlationId": "req-001"
}
// Response: decision="modified", data.chunks=[filtered & redacted chunks]

// 4. POST-GENERATION (after LLM generates response)
{
  "stage": "post_generation",
  "user": { "id": "U123", "role": "intern", "department": "HR" },
  "request": {
    "query": { "text": "Show me HR policies summary" },
    "index": "hr_docs",
    "filters": { "department": "HR", "sensitivity": { "$lte": 1 } }
  },
  "artifacts": {
    "chunks": [...], // filtered chunks from post_retrieval
    "generated_response": {
      "text": "HR policies include...",
      "citations": [...],
      "confidence": 0.92
    }
  },
  "policyVersion": "v0",
  "correlationId": "req-001"
}
// Response: decision="allowed" or "modified", with enforced citations/confidence
```

---

## Common Patterns

### Pattern 1: Block Interns from Salary Queries
```json
// Request
{
  "stage": "pre_query",
  "user": { "id": "U123", "role": "intern", "department": "HR" },
  "request": { "query": { "text": "What is John's salary?" } },
  "policyVersion": "v0",
  "correlationId": "req-005"
}

// Response
{
  "decision": "blocked",
  "data": {},
  "auditId": "audit-20241201-007",
  "trace": [
    {
      "policy": "block_intern_salary_queries",
      "stage": "pre_query",
      "action": "block",
      "reason": "Interns cannot access salary information per policy"
    }
  ]
}
```

### Pattern 2: Scope Retrieval by Department
```json
// Request
{
  "stage": "pre_retrieval",
  "user": { "id": "U456", "role": "doctor", "department": "Cardiology" },
  "request": {
    "query": { "text": "Show me patient records" },
    "index": "medical_records",
    "filters": {}
  },
  "policyVersion": "v0",
  "correlationId": "req-006"
}

// Response
{
  "decision": "modified",
  "data": {
    "filters": {
      "department": "Cardiology",
      "sensitivity": { "$lte": 4 }
    }
  },
  "auditId": "audit-20241201-008",
  "trace": [
    {
      "policy": "scope_by_department",
      "stage": "pre_retrieval",
      "action": "rewrite",
      "reason": "Added department filter: Cardiology"
    }
  ]
}
```

### Pattern 3: Redact PII from Chunks
```json
// Request
{
  "stage": "post_retrieval",
  "user": { "id": "U789", "role": "analyst", "department": "Finance" },
  "request": { "query": { "text": "Show customer data" } },
  "artifacts": {
    "chunks": [
      {
        "id": "c1",
        "text": "Customer John Doe (SSN: 123-45-6789) purchased...",
        "metadata": { "tags": ["customer", "PII"] }
      }
    ]
  },
  "policyVersion": "v0",
  "correlationId": "req-007"
}

// Response
{
  "decision": "modified",
  "data": {
    "chunks": [
      {
        "id": "c1",
        "text": "Customer [REDACTED] (SSN: [REDACTED]) purchased...",
        "metadata": { "tags": ["customer", "PII"] }
      }
    ]
  },
  "auditId": "audit-20241201-009",
  "trace": [
    {
      "policy": "redact_pii",
      "stage": "post_retrieval",
      "action": "redact",
      "reason": "Redacted SSN and name per PII policy"
    }
  ]
}
```

### Pattern 4: Enforce Citations
```json
// Request
{
  "stage": "post_generation",
  "user": { "id": "U321", "role": "researcher" },
  "request": { "query": { "text": "What are the latest findings?" } },
  "artifacts": {
    "generated_response": {
      "text": "Latest findings show...",
      "citations": [] // Missing citations!
    }
  },
  "policyVersion": "v0",
  "correlationId": "req-008"
}

// Response
{
  "decision": "blocked",
  "data": {
    "generated_response": {
      "text": "[Response blocked: Citations required but not provided]"
    }
  },
  "auditId": "audit-20241201-010",
  "trace": [
    {
      "policy": "require_citations",
      "stage": "post_generation",
      "action": "block",
      "reason": "Citations required but missing"
    }
  ]
}
```

---

## Notes

1. **Correlation ID**: Use the same `correlationId` across all 4 stages for a single request to trace the full flow.

2. **Policy Version**: Always specify `policyVersion` to ensure consistent enforcement.

3. **User Context**: Include all user attributes defined in your schema descriptor (role, department, clearance, etc.).

4. **Artifacts**: Only populated in `post_retrieval` (chunks) and `post_generation` (chunks + generated_response).

5. **Policy Context**: Only returned in `pre_query` and `pre_retrieval` stages for LLM self-regulation.

6. **Decision Values**: `"allowed"`, `"modified"`, or `"blocked"`.





