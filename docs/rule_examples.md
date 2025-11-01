# GateKeeper Policy Examples

This document provides 40 real-world policy examples across all 4 enforcement stages, demonstrating different use cases, industries, and enforcement actions.

---

## Pre-Query Stage (10 Examples)

### 1. Block Interns from Salary Queries
**Use Case**: Corporate HR system  
**Scenario**: Interns should not be able to query about compensation information.

```yaml
name: block-intern-salary-queries
stage: pre_query
priority: 100
enabled: true
when:
  all:
    - expr: user.role == "intern"
match:
  query.text: ["salary", "compensation", "pay", "wage", "bonus", "CEO salary"]
action:
  type: block
  message: "Access to compensation information is restricted for your role."
distilled_prompt: "Do not answer questions about salaries, compensation, or pay. Redirect to HR policies."
```

### 2. Rate Limit High-Risk Users
**Use Case**: Financial services chatbot  
**Scenario**: Users flagged as "high-risk" should be rate-limited to prevent abuse.

```yaml
name: rate-limit-high-risk-users
stage: pre_query
priority: 90
enabled: true
when:
  all:
    - expr: user.risk_score >= 7
    - expr: user.query_count >= 50
action:
  type: block
  message: "Query limit exceeded. Please try again in 1 hour."
distilled_prompt: "This user has exceeded their query limit. Decline politely."
```

### 3. Block PII Extraction Attempts
**Use Case**: Healthcare RAG system  
**Scenario**: Prevent users from extracting patient identifiers through clever queries.

```yaml
name: block-pii-extraction
stage: pre_query
priority: 95
enabled: true
when:
  any:
    - expr: query.text.contains("all patients")
    - expr: query.text.contains("list of patients")
    - expr: query.text.contains("export patients")
match:
  query.text: ["SSN", "social security", "patient ID", "medical record number"]
action:
  type: block
  message: "Bulk data extraction queries are not allowed."
distilled_prompt: "Do not provide lists of patients or bulk data. Refuse extraction requests."
```

### 4. Require Authentication for Sensitive Topics
**Use Case**: Government document system  
**Scenario**: Users without proper clearance cannot query classified documents.

```yaml
name: require-clearance-for-classified
stage: pre_query
priority: 100
enabled: true
when:
  all:
    - expr: user.clearance < 3
match:
  query.text: ["classified", "confidential", "top secret", "restricted access"]
action:
  type: block
  message: "This topic requires security clearance level 3 or higher."
distilled_prompt: "Do not answer questions about classified or restricted topics without proper clearance."
```

### 5. Block Queries Outside Business Hours (Non-Employees)
**Use Case**: Customer support chatbot  
**Scenario**: Non-employees can only query during business hours.

```yaml
name: business-hours-restriction
stage: pre_query
priority: 80
enabled: true
when:
  all:
    - expr: user.role != "employee"
    - expr: request.timestamp.hour < 9
    - expr: request.timestamp.hour >= 18
action:
  type: block
  message: "Service is available Monday-Friday, 9 AM - 6 PM."
distilled_prompt: "Politely inform the user that service is only available during business hours."
```

### 6. Redirect Complex Queries to Human Agent
**Use Case**: Insurance claim system  
**Scenario**: Complex queries requiring interpretation should be escalated.

```yaml
name: escalate-complex-queries
stage: pre_query
priority: 70
enabled: true
when:
  all:
    - expr: query.intent == "complex"
    - expr: user.role == "customer"
action:
  type: rewrite
  query:
    append: " [Escalate to human agent]"
  redirect: true
distilled_prompt: "This query requires human assistance. Offer to connect the user with a specialist."
```

### 7. Block Multi-Intent Queries for Low-Clearance Users
**Use Case**: Internal knowledge base  
**Scenario**: Users with low clearance cannot combine multiple sensitive topics in one query.

```yaml
name: block-multi-intent-low-clearance
stage: pre_query
priority: 85
enabled: true
when:
  all:
    - expr: user.clearance <= 2
    - expr: query.intent_count >= 3
match:
  query.text: ["and also", "what about", "also tell me"]
action:
  type: block
  message: "Please ask one question at a time."
distilled_prompt: "Request one question at a time. Do not combine multiple sensitive topics."
```

### 8. Prevent Jailbreak Attempts (Fuzzy Matching)
**Use Case**: General-purpose RAG system  
**Scenario**: Block attempts to bypass filters using obfuscated keywords.

```yaml
name: prevent-jailbreak-attempts
stage: pre_query
priority: 95
enabled: true
when:
  any:
    - expr: query.text.contains("s@l@ry")
    - expr: query.text.contains("sallllary")
    - expr: query.text.contains("c0mpensat10n")
match:
  query.text: ["salary", "compensation", "pay"]
action:
  type: block
  message: "Invalid query format detected."
distilled_prompt: "Ignore obfuscated or modified versions of restricted keywords. Refuse the request."
```

### 9. Require Department Approval for Cross-Department Queries
**Use Case**: Enterprise document management  
**Scenario**: Users cannot query documents from other departments without approval.

```yaml
name: cross-department-approval
stage: pre_query
priority: 90
enabled: true
when:
  all:
    - expr: user.department != null
    - expr: request.target_department != user.department
    - expr: user.cross_dept_access != true
action:
  type: block
  message: "Cross-department access requires approval. Contact your manager."
distilled_prompt: "Explain that cross-department queries require approval."
```

### 10. Block Queries with Suspicious Patterns
**Use Case**: Security-conscious organization  
**Scenario**: Detect and block queries that match known attack patterns.

```yaml
name: block-suspicious-patterns
stage: pre_query
priority: 100
enabled: true
when:
  any:
    - expr: query.text.contains("DROP TABLE")
    - expr: query.text.contains("SELECT * FROM")
    - expr: query.text.contains("<?php")
    - expr: query.text.contains("javascript:")
action:
  type: block
  message: "Query contains suspicious patterns and has been blocked."
distilled_prompt: "Security threat detected. Do not process this query."
```

---

## Pre-Retrieval Stage (10 Examples)

### 1. Scope Retrieval by User Department
**Use Case**: Corporate intranet  
**Scenario**: Users should only retrieve documents from their own department.

```yaml
name: scope-by-department
stage: pre_retrieval
priority: 100
enabled: true
when:
  all:
    - expr: user.department != null
action:
  type: rewrite
  filters:
    add:
      department: "${user.department}"
distilled_prompt: "Only retrieve documents relevant to the user's department."
```

### 2. Limit Retrieval Count Based on Role
**Use Case**: Research database  
**Scenario**: Non-premium users get fewer results.

```yaml
name: limit-retrieval-by-role
stage: pre_retrieval
priority: 80
enabled: true
when:
  all:
    - expr: user.plan == "free"
action:
  type: rewrite
  params:
    top_k: 5
distilled_prompt: "Limit results to top 5 most relevant documents for free users."
```

### 3. Add Security Clearance Filter
**Use Case**: Government classified documents  
**Scenario**: Only retrieve documents matching or below user's clearance level.

```yaml
name: filter-by-clearance
stage: pre_retrieval
priority: 100
enabled: true
when:
  all:
    - expr: user.clearance != null
action:
  type: rewrite
  filters:
    add:
      max_clearance_level: "${user.clearance}"
      required_clearance: "< ${user.clearance}"
distilled_prompt: "Only retrieve documents within the user's security clearance level."
```

### 4. Restrict to Recent Documents (Time-Based)
**Use Case**: News/article database  
**Scenario**: Free users only get documents from the last 30 days.

```yaml
name: restrict-to-recent-docs
stage: pre_retrieval
priority: 70
enabled: true
when:
  all:
    - expr: user.plan == "free"
    - expr: user.subscription_date < (now() - 30 days)
action:
  type: rewrite
  filters:
    add:
      created_at: ">= ${now() - 30 days}"
distilled_prompt: "Focus on recent documents from the past 30 days."
```

### 5. Add Region-Based Filtering
**Use Case**: Global company with regional data  
**Scenario**: Users can only access documents from their region.

```yaml
name: filter-by-region
stage: pre_retrieval
priority: 90
enabled: true
when:
  all:
    - expr: user.region != null
    - expr: user.global_access != true
action:
  type: rewrite
  filters:
    add:
      region: "${user.region}"
distilled_prompt: "Only retrieve documents from the user's assigned region."
```

### 6. Combine Multiple Metadata Filters
**Use Case**: Healthcare system  
**Scenario**: Doctors can access patient records, but only from their specialty.

```yaml
name: multi-filter-doctor-access
stage: pre_retrieval
priority: 95
enabled: true
when:
  all:
    - expr: user.role == "doctor"
    - expr: user.specialty != null
action:
  type: rewrite
  filters:
    add:
      document_type: "patient_record"
      specialty: "${user.specialty}"
      access_level: ">= doctor"
distilled_prompt: "Retrieve only patient records relevant to the doctor's specialty."
```

### 7. Block Access to Specific Indexes
**Use Case**: Multi-tenant system  
**Scenario**: Free-tier tenants cannot access premium indexes.

```yaml
name: restrict-index-access
stage: pre_retrieval
priority: 85
enabled: true
when:
  all:
    - expr: user.plan == "free"
    - expr: request.index in ["premium_docs", "archived_data", "research_papers"]
action:
  type: block
  message: "This index is only available for premium subscribers."
distilled_prompt: "Inform that premium subscription is required for this content."
```

### 8. Add Quality Score Threshold
**Use Case**: Content recommendation system  
**Scenario**: Only retrieve high-quality, verified content.

```yaml
name: quality-threshold-filter
stage: pre_retrieval
priority: 75
enabled: true
when:
  all:
    - expr: user.verified_account == true
action:
  type: rewrite
  filters:
    add:
      quality_score: ">= 0.8"
      verified: true
distilled_prompt: "Prioritize high-quality, verified content sources."
```

### 9. Dynamic Top-K Based on Query Complexity
**Use Case**: Legal research system  
**Scenario**: Complex queries need more context chunks.

```yaml
name: dynamic-top-k-by-complexity
stage: pre_retrieval
priority: 60
enabled: true
when:
  all:
    - expr: request.query_complexity >= 0.7
action:
  type: rewrite
  params:
    top_k: 20
distilled_prompt: "Retrieve more context chunks for complex queries."
```

### 10. Filter by Document Ownership
**Use Case**: Team collaboration platform  
**Scenario**: Users can only retrieve documents they own or have been shared with.

```yaml
name: filter-by-ownership
stage: pre_retrieval
priority: 90
enabled: true
when:
  all:
    - expr: user.id != null
action:
  type: rewrite
  filters:
    add:
      owner: "${user.id}"
      shared_with: "${user.id}"
      visibility: "in [public, shared]"
distilled_prompt: "Only retrieve documents owned by or shared with the user."
```

---

## Post-Retrieval Stage (10 Examples)

### 1. Drop Confidential Chunks for Low Clearance
**Use Case**: Security-sensitive organization  
**Scenario**: Users with clearance < 3 cannot see confidential documents.

```yaml
name: drop-confidential-low-clearance
stage: post_retrieval
priority: 100
enabled: true
when:
  all:
    - expr: user.clearance < 3
match:
  chunk.metadata.sensitivity: ["confidential", "restricted", "top_secret"]
action:
  type: filter
  drop_if:
    sensitivity: "in [confidential, restricted, top_secret]"
distilled_prompt: "Exclude confidential information from the retrieved context."
```

### 2. Remove Outdated Documents
**Use Case**: Product documentation  
**Scenario**: Documents older than 2 years are considered outdated.

```yaml
name: filter-outdated-docs
stage: post_retrieval
priority: 80
enabled: true
when:
  all:
    - expr: chunk.metadata.created_at < (now() - 2 years)
match:
  chunk.metadata.version: ["deprecated", "legacy"]
action:
  type: filter
  drop_if:
    created_at: "< ${now() - 2 years}"
distilled_prompt: "Prioritize recent, up-to-date information."
```

### 3. Filter Chunks by Department Ownership
**Use Case**: Enterprise knowledge base  
**Scenario**: HR documents should only be visible to HR department members.

```yaml
name: filter-by-department-ownership
stage: post_retrieval
priority: 95
enabled: true
when:
  all:
    - expr: user.department != "HR"
match:
  chunk.metadata.department: ["HR"]
action:
  type: filter
  drop_if:
    department: "== HR"
distilled_prompt: "Exclude department-specific content not relevant to the user."
```

### 4. Redact PII from Chunks
**Use Case**: Healthcare system  
**Scenario**: Remove personally identifiable information before showing to non-clinical staff.

```yaml
name: redact-pii-non-clinical
stage: post_retrieval
priority: 90
enabled: true
when:
  all:
    - expr: user.role != "doctor"
    - expr: user.role != "nurse"
match:
  chunk.text: ["SSN", "patient ID", "medical record number"]
action:
  type: redact
  patterns: ["SSN", "\\d{3}-\\d{2}-\\d{4}", "MRN-\\d+"]
  fields: ["chunk.text"]
distilled_prompt: "Do not include any patient identifiers or PII in responses."
```

### 5. Drop Chunks with Incompatible Licenses
**Use Case**: Research paper database  
**Scenario**: Users without proper license cannot access licensed content.

```yaml
name: filter-by-license
stage: post_retrieval
priority: 85
enabled: true
when:
  all:
    - expr: user.license_type != "premium"
match:
  chunk.metadata.license: ["premium", "paid", "subscription"]
action:
  type: filter
  drop_if:
    license: "in [premium, paid, subscription]"
distilled_prompt: "Only use content accessible under the user's license."
```

### 6. Remove Redundant Chunks (Deduplication)
**Use Case**: General RAG system  
**Scenario**: Remove duplicate or highly similar chunks to reduce token usage.

```yaml
name: deduplicate-chunks
stage: post_retrieval
priority: 50
enabled: true
when:
  all:
    - expr: artifacts.retrieved_chunks.length > 10
action:
  type: filter
  deduplicate: true
  similarity_threshold: 0.95
distilled_prompt: "Use the most relevant chunks, avoiding redundancy."
```

### 7. Filter by Document Tags (Whitelist)
**Use Case**: Content curation  
**Scenario**: Only keep chunks tagged as "verified" or "approved".

```yaml
name: filter-by-tags-whitelist
stage: post_retrieval
priority: 80
enabled: true
when:
  all:
    - expr: user.role == "customer"
match:
  chunk.metadata.tags: ["verified", "approved"]
action:
  type: filter
  keep_if:
    tags: "contains verified OR contains approved"
distilled_prompt: "Only reference verified and approved content sources."
```

### 8. Drop Chunks with Low Relevance Score
**Use Case**: Search quality optimization  
**Scenario**: Remove chunks below relevance threshold to improve answer quality.

```yaml
name: filter-low-relevance
stage: post_retrieval
priority: 60
enabled: true
when:
  all:
    - expr: chunk.relevance_score < 0.5
action:
  type: filter
  drop_if:
    relevance_score: "< 0.5"
distilled_prompt: "Focus on highly relevant content only."
```

### 9. Restrict Access Based on Document Age Classification
**Use Case**: Legal/regulatory compliance  
**Scenario**: Interns cannot access documents marked as "senior-only".

```yaml
name: restrict-senior-only-docs
stage: post_retrieval
priority: 90
enabled: true
when:
  all:
    - expr: user.role == "intern"
    - expr: user.senior_access != true
match:
  chunk.metadata.access_level: ["senior", "executive"]
action:
  type: filter
  drop_if:
    access_level: "in [senior, executive]"
distilled_prompt: "Do not reference senior-level or executive-only documents."
```

### 10. Mask Financial Data for Non-Finance Users
**Use Case**: Corporate financial system  
**Scenario**: Mask specific financial figures for users outside finance department.

```yaml
name: mask-financial-data
stage: post_retrieval
priority: 95
enabled: true
when:
  all:
    - expr: user.department != "Finance"
    - expr: user.role != "CFO"
    - expr: user.role != "Finance Manager"
match:
  chunk.metadata.category: ["financial", "revenue", "budget"]
action:
  type: redact
  patterns: ["\\$[\\d,]+", "\\d+%", "revenue: \\$\\d+"]
  fields: ["chunk.text"]
  replace_with: "[REDACTED]"
distilled_prompt: "Do not disclose specific financial figures or revenue numbers."
```

---

## Post-Generation Stage (10 Examples)

### 1. Require Citations for All Claims
**Use Case**: Academic/research system  
**Scenario**: Every factual claim must be backed by a source.

```yaml
name: require-citations
stage: post_generation
priority: 100
enabled: true
when:
  all:
    - expr: answer.citations.length < 1
action:
  type: enforce
  citations:
    required: true
    min_count: 1
    format: "chunk_id"
distilled_prompt: "Always cite sources for factual claims. Include at least one citation per response."
```

### 2. Enforce Minimum Confidence Threshold
**Use Case**: Medical/legal advice system  
**Scenario**: Answers below 70% confidence should be flagged or refused.

```yaml
name: min-confidence-threshold
stage: post_generation
priority: 95
enabled: true
when:
  all:
    - expr: answer.confidence < 0.7
action:
  type: enforce
  min_confidence: 0.7
  fallback: "I'm not confident enough to provide a reliable answer. Please consult an expert."
distilled_prompt: "Only provide answers when confidence is high. Decline uncertain answers."
```

### 3. Redact PII from Generated Answers
**Use Case**: Customer support chatbot  
**Scenario**: Never expose customer PII even if it appears in sources.

```yaml
name: redact-pii-from-answer
stage: post_generation
priority: 100
enabled: true
when:
  any:
    - expr: answer.text.contains("SSN")
    - expr: answer.text.contains("credit card")
    - expr: answer.text.contains("\\d{3}-\\d{2}-\\d{4}")
action:
  type: redact
  patterns: ["\\d{3}-\\d{2}-\\d{4}", "\\d{4}[ -]\\d{4}[ -]\\d{4}[ -]\\d{4}", "\\b\\d{9}\\b"]
  fields: ["answer.text"]
  replace_with: "[REDACTED]"
distilled_prompt: "Never include SSNs, credit card numbers, or other PII in responses."
```

### 4. Enforce Professional Tone
**Use Case**: Corporate communication system  
**Scenario**: Answers must maintain professional, formal tone.

```yaml
name: enforce-professional-tone
stage: post_generation
priority: 80
enabled: true
when:
  all:
    - expr: answer.tone != "professional"
    - expr: answer.tone != "formal"
action:
  type: enforce
  style:
    tone: "professional"
    avoid_casual: true
    require_formal: true
distilled_prompt: "Maintain a professional, formal tone. Avoid casual language or slang."
```

### 5. Require Disclaimers for Medical Information
**Use Case**: Healthcare information system  
**Scenario**: Medical information requires appropriate disclaimers.

```yaml
name: medical-disclaimer
stage: post_generation
priority: 100
enabled: true
when:
  any:
    - expr: answer.text.contains("treatment")
    - expr: answer.text.contains("diagnosis")
    - expr: answer.text.contains("medication")
action:
  type: enforce
  append_disclaimer: "This information is for educational purposes only and does not constitute medical advice. Please consult a healthcare professional."
distilled_prompt: "Always include a disclaimer that this is not medical advice and recommend consulting a doctor."
```

### 6. Limit Answer Length for Free Users
**Use Case**: SaaS product with tiered access  
**Scenario**: Free-tier users get shorter, summarized answers.

```yaml
name: limit-answer-length-free
stage: post_generation
priority: 70
enabled: true
when:
  all:
    - expr: user.plan == "free"
    - expr: answer.tokens > 200
action:
  type: enforce
  max_tokens: 200
  summarize_if_exceeds: true
distilled_prompt: "Provide concise answers within 200 tokens for free users."
```

### 7. Block Answers Containing Banned Keywords
**Use Case**: Content moderation  
**Scenario**: Answers containing offensive or inappropriate content must be blocked.

```yaml
name: block-banned-keywords
stage: post_generation
priority: 100
enabled: true
when:
  any:
    - expr: answer.text.contains("hate speech")
    - expr: answer.text.contains("explicit content")
match:
  answer.text: ["banned_word_1", "banned_word_2", "inappropriate_term"]
action:
  type: block
  message: "Answer contains inappropriate content and has been blocked."
distilled_prompt: "Never include offensive, inappropriate, or banned content in responses."
```

### 8. Require Multiple Sources for Critical Claims
**Use Case**: Fact-checking system  
**Scenario**: Critical factual claims must cite at least 2 sources.

```yaml
name: require-multiple-sources
stage: post_generation
priority: 90
enabled: true
when:
  all:
    - expr: answer.citations.length < 2
    - expr: answer.text.contains("critical claim keywords")
action:
  type: enforce
  citations:
    required: true
    min_count: 2
    require_confirmation: true
distilled_prompt: "For critical or factual claims, cite at least two independent sources."
```

### 9. Enforce Word Limit for Specific Topics
**Use Case**: Regulatory compliance  
**Scenario**: Legal disclaimers cannot exceed specified length.

```yaml
name: enforce-word-limit-legal
stage: post_generation
priority: 85
enabled: true
when:
  all:
    - expr: answer.text.contains("legal")
    - expr: answer.word_count > 500
action:
  type: enforce
  max_words: 500
  truncate_if_exceeds: true
distilled_prompt: "Keep legal information concise, under 500 words."
```

### 10. Validate Answer Against Source Metadata
**Use Case**: Multi-tenant system  
**Scenario**: Answers must not reference documents from restricted tenants.

```yaml
name: validate-source-tenant
stage: post_generation
priority: 95
enabled: true
when:
  all:
    - expr: answer.sources.metadata.tenant_id != user.tenant_id
    - expr: user.cross_tenant_access != true
action:
  type: block
  message: "Answer references restricted content."
distilled_prompt: "Only reference content from authorized sources and tenants."
```

---

## Summary

These 40 examples demonstrate:

1. **Diverse Industries**: Healthcare, finance, government, corporate, legal, research
2. **All Action Types**: `block`, `rewrite`, `filter`, `redact`, `enforce`
3. **Complex Conditions**: Multi-field conditions, nested logic, fuzzy matching
4. **Real-World Scenarios**: Rate limiting, access control, compliance, security
5. **Stage-Appropriate Logic**: Correct use of available fields per stage

Each policy includes:
- Clear use case and scenario
- Complete YAML structure
- `distilled_prompt` for LLM self-regulation
- Appropriate priority and matching conditions

