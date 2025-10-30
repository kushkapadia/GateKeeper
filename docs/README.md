## GateKeeper: Pluggable Policy‑as‑Code Layer for RAG

### 1) Problem Statement
- RAG applications risk data leakage, inconsistent access control, non‑auditable decisions, and hallucinated answers.
- Enterprises need a governance layer that enforces security, compliance, and answer quality without rewriting app logic.

### 2) Vision (What GateKeeper Does)
- Acts as a framework‑agnostic “checkpoint” around any RAG pipeline.
- Applies policies at four stages: pre‑query, pre‑retrieval, post‑retrieval, post‑generation.
- Provides policy‑as‑code (YAML/JSON), a Policy Registry, and a Rules Studio for non‑technical admins.
- Logs every decision with reasons for analytics, audits, and research.

### 3) Core Objectives
- Prevent sensitive data exposure (PII, salaries, confidential docs).
- Enforce RBAC/ABAC using user and document attributes.
- Ensure answer integrity (citations, minimum confidence, tone safety).
- Offer versioned, testable policies with CI validation.
- Deliver observability: metrics, audit trails, and admin analytics.

### 4) Primary Users
- Policy Authors (HR, Legal, Compliance): author and publish rules via Studio.
- App Developers: integrate a thin SDK/HTTP to call `enforce(stage, user_ctx, data)`.
- DevOps/SRE: manage deployments, metrics, alerts; run policy lint/tests in CI.
- Auditors/Security: search decision traces; verify who/what/when/why.

### 5) Finalized Tech Stack (MVP)
- Backend: Python 3.11+, FastAPI, Pydantic.
- SDK: Thin Python client over HTTP.
- Policy Registry: YAML/JSON on disk initially; PostgreSQL (prod) with JSONB for policies, versions, and audit index.
- Cache/Rate‑limit: Redis (user attributes, policy bundle cache, quotas, idempotency keys).
- Vector/LLM: external to GateKeeper (developers’ systems). Optional adapters for LangChain/LlamaIndex.
- Observability: Prometheus client metrics; JSON logs (structlog); Grafana dashboards.
- Frontend: Next.js + TypeScript + shadcn/ui (Rules Studio).
- MCP: separate MCP server exposing tools `policy:lint`, `policy:test`, `policy:simulate` (plus `audit:get`, `audit:search` later).
- CI/CD: GitHub Actions; Docker + docker‑compose for local dev.

### 6) Four Enforcement Stages
- Pre‑Query: validate/intent‑classify, block/rewrite risky queries, rate‑limit.
- Pre‑Retrieval: constrain scope with metadata filters; enforce RBAC/ABAC.
- Post‑Retrieval: redact PII/sensitive content; drop invalid/outdated chunks.
- Post‑Generation: enforce citations, confidence, tone; provide safe fallbacks.

### 7) Policy Model (High‑Level)
- Fields: `name`, `version`, `enabled`, `stage`, `priority`, `labels`, `when`, `match`, `action`, `on_violation`.
- Actions: `block{message}`, `rewrite{query|filters|params}`, `filter{keep_if|drop_if}`, `redact{patterns|fields|tags}`, `degrade{mode}`, `enforce{citations,min_confidence,style}`.
- Evaluation: deterministic order by `priority desc, name asc`; deny‑overrides by default; `continue:true` to chain effects.
- Schema Awareness: organization registers a `schema.yaml` descriptor of valid attributes/metadata (user.*, request.*, doc.metadata.*). The Studio and `policy:lint` validate policies against it.

### 7A) Context Awareness — How GateKeeper “understands” your data
- Goal: policies must refer to real fields (e.g., `user.department`, `doc.metadata.tags`) and real values. GateKeeper achieves this via a shared descriptor, consistent runtime context, and validation.

1) Schema Descriptor (once per organization)
   - A small YAML file describing valid attributes and metadata:
   - Example:
```
user_attributes:
  - name: role
    type: string
    example: "Doctor, Nurse, Admin"
  - name: department
    type: string
    example: "Cardiology, HR"
  - name: clearance
    type: integer
    example: 1-5

doc_metadata:
  - name: tags
    type: list[string]
    example: ["salary", "policy", "confidential"]
  - name: sensitivity
    type: string
    example: "public, restricted, confidential"
```
   - Namespaces are fixed: `user.*`, `request.*`, `doc.metadata.*`. Unknown fields are rejected by `policy:lint`.

2) Runtime Context (per request)
   - The app sends concrete values that match the descriptor:
```
user_ctx = {"id": "U123", "role": "nurse", "department": "ICU", "clearance": 2}
request_ctx = {"query": "What is the CEO's salary?"}
artifacts = {"chunks": [...]}  // only for post-retrieval/post-generation
```
   - Redis may cache `user_ctx` and compiled `policy:{version}` for speed; missing required attributes cause deny‑by‑default.

3) Studio‑guided Authoring
   - The Rules Studio reads the descriptor and offers autocompletion, enums, and ranges; invalid fields/types cannot be published.

4) Pluggable Semantics for Actions
   - Redaction patterns (e.g., `PII`, `PAN`) are registered plugins; sectors (healthcare, corporate) can supply their own.

Example end‑to‑end flow (context aware)
1. Admin policy:
```
- name: scope-by-department
  stage: pre_retrieval
  priority: 90
  when:
    all:
      - user.department is not null
  match: {}
  action:
    type: rewrite
    filters:
      add:
        department: "${user.department}"
```
2. App calls `enforce("pre_retrieval", user_ctx, request_ctx)`.
3. GateKeeper validates `user.department` against `schema.yaml` (exists, string), substitutes the value `ICU`, and returns rewritten filters.
4. Retrieval runs in the developer’s vector DB with `department=ICU` enforced.
5. Later, `post_retrieval` uses `doc.metadata` tags from chunks to apply redaction rules; only fields defined in `schema.yaml` are allowed.

Outcome: Policies are portable, unambiguous, and safely validated because GateKeeper knows the organization’s vocabulary and receives the concrete context at runtime.

### 8) Data Contracts
- SDK/HTTP: `POST /v1/enforce?stage=<stage>` → `{ user, request, artifacts }` → `{ decision, data, auditId, trace }`.
- Audit Event (one per stage): includes `auditId`, `correlationId`, `stage`, `policyVersion/hash`, `userIdHash`, `decision`, `actions`, `violations`, `latencyMs`, and safe snapshots/counts.

### 9) Logging, Metrics, and Analytics
- Emit JSON audit events (to file → Postgres index for MVP). Pseudonymize user IDs.
- Prometheus metrics: counters (blocks, redactions, citation_failures), histograms (latency per stage/action).
- Studio Analytics: top policies by blocks; latency by stage; PII redaction counts; citation compliance.
- “Risky users” feature: maintain Redis counters and ranks per user for blocks/attacks; drill‑down via audit search.

### 10) Redis Usage (MVP)
- Caches: `user:attrs:{id}` (TTL 300s), `policy:{version}` (TTL 15m), `schema:{tenant}` (TTL 300s).
- Rate limiting: `rate:{tenant}:{user}:{stage}` with token‑bucket using INCR/EXPIRE.
- Idempotency: `idem:{correlationId}` short TTL to avoid duplicates.
- Optional light queue for offloaded NER redaction.

### 11) What GateKeeper Does NOT Host
- No vector database. Retrieval stacks remain in the developer’s environment. GateKeeper only shapes queries (pre‑retrieval) and sanitizes chunks (post‑retrieval).

### 12) MCP Server (Tooling Path)
- Purpose: interactive authoring/testing/inspection; not for hot‑path logging or enforcement.
- Tools (phase 1): `policy:lint`, `policy:test`, `policy:simulate`.
- Tools (phase 2): `audit:get`, `audit:search`, `metrics:snapshot`, `policy:propose_from_nl` (human‑approved).

### 13) Security & Privacy
- Pseudonymize user IDs with tenant‑salted hashes.
- Deny‑by‑default on missing required attributes.
- Redact content fields in audit events by default; privileged views toggled in Studio.
- Signed policy bundles (optional future) and role‑scoped MCP access.

### 14) Deployment & Environments
- Local: docker‑compose (FastAPI, Redis, Postgres, Prometheus, Grafana, Studio, MCP server).
- Staging/Prod: containerized services; Postgres managed; Redis single‑node or small cluster.

#### Local Run (no Docker)
- macOS (Apple Silicon/M3)
```
brew install redis
brew services start redis
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export REDIS_URL=redis://localhost:6379/0
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gatekeeper  # optional
uvicorn backend.app.main:app --reload
```

- Windows (PowerShell)
```
winget install Redis.Redis
# Start Redis server from Start Menu or redis-server.exe
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:REDIS_URL = "redis://localhost:6379/0"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/gatekeeper"  # optional
uvicorn backend.app.main:app --reload
```
Then open `http://localhost:8000/health` and `POST /v1/enforce`.

### 15) MVP Scope (4–6 weeks)
- Enforcement service with 4 hooks; actions: block, rewrite, redact(regex), enforce(citations, min_confidence).
- YAML policy loader, deterministic evaluator, and `schema.yaml` validation.
- JSON audit events + Prometheus metrics + Grafana dashboard.
- Redis: caches and rate limits.
- MCP tools: lint/test/simulate; Studio UI to upload/test/publish policies and run simulations.
- “Risky users” widget using Redis counters; drill‑down via audit search API.

### 16) Milestones
- Week 1: repo scaffold, contracts, policy schema, basic enforce endpoint.
- Week 2: pre‑query + pre‑retrieval actions; Redis cache & rate limit; audit events.
- Week 3: post‑retrieval redaction; post‑generation citations/confidence; metrics dashboard.
- Week 4: MCP tools + Studio basic; policy lint/test; risky users analytics.
- Week 5: hardening, docs, demo scenarios; performance/ablation tests.
- Week 6: polish, prepare research datasets and paper draft.

### 17) Research Plan (Paper)
- Evaluate safety: reduction in PII leakage and restricted-topic answers.
- Evaluate integrity: citation compliance and confidence gating impact.
- Evaluate performance: added latency per stage/action; Redis cache hit rates.
- Usability: authoring error rate and time‑to‑publish with/without `schema.yaml` and MCP tools.
- Reproducibility: publish policy corpus, schema, event schema, and aggregated metrics (PII‑safe).

### 18) Non‑Goals (MVP)
- No built‑in vector search or document store.
- No heavy LLM‑based NER in hot path (optional microservice later).
- No Kafka initially (can be added later for durable streams).

### 19) End‑State Demo Narrative
1. Two roles issue the same question; pre‑query blocks one, allows another.
2. Pre‑retrieval injects department filter; retrieval proceeds in app’s own vector DB.
3. Post‑retrieval redacts PII from chunks; trace shows rules triggered.
4. Post‑generation enforces at least one citation and confidence threshold; fallback if unmet.
5. Studio shows decision traces, metrics, and top risky users; policies are edited, linted, tested, and published via MCP.

---

This document is the project map. If anything here changes (e.g., adding Kafka or advanced NER), update this file to keep architecture, contracts, and milestones in sync.


### 20) Future Scope (Assistive LLM, not on the hot path)
- NL → Policy Drafting: convert natural‑language rules into draft YAML with explanations and autogenerated test cases; requires human approval in Studio.
- Automatic Policy Suggestions: mine repeated violations and propose candidate rules (e.g., “block salary queries for interns”).
- Semantic Redaction/Classification: optional LLM‑ or NER‑assisted detection of PII, tone/toxicity, and jailbreak intent; run asynchronously or behind caches, with deterministic fallbacks.
- Provider Strategy: lightweight hosted models (e.g., GPT‑4o‑mini) or local Llama via Ollama; strict timeouts, circuit breakers, and full observability.
- Governance: never auto‑deploy LLM‑generated rules; all outputs pass `policy:lint` and `policy:test` before publish.


