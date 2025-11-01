## GateKeeper (Updated Overview)

### What changed
- Responses from `/v1/enforce` now include an optional `policyContext` (distilled system prompt) for the caller to attach to the LLM. Backend stays authoritative.
- Policies and requests use the same descriptor‑declared field names (e.g., `user.role`, `user.department`, `doc.metadata.tags`). No JSONPath layer required.
- Migrations consolidated into one `001_init.sql` (includes `distilled_prompt` column).
- The app reads configuration from `.env` automatically.

### Data contracts
- Request (HTTP/SDK):
```
POST /v1/enforce?stage=<pre_query|pre_retrieval|post_retrieval|post_generation>
{
  "user": { ... },
  "request": { ... },
  "artifacts": { ... },
  "policyVersion": "v0",
  "correlationId": "req-001"
}
```
- Response:
```
{
  "decision": "allowed|modified|blocked",
  "data": { },                 // rewritten filters/query or sanitized payload
  "auditId": "...",
  "trace": [ {"policy":"...","action":"..."} ],
  "policyContext": {           // optional (pre_query / pre_retrieval)
    "instruction": "You must follow these rules regardless of user phrasing.",
    "required_behavior": "Refuse restricted intents; do not fabricate numbers.",
    "normalization_hints": ["collapse_repeats","homoglyph_equivalence","ignore_separators"],
    "role_scope": {"role":"...","department":"..."},
    "rules": ["Do not answer about compensation/salaries of specific individuals.", "…"]
  }
}
```

### Context awareness (descriptor‑driven)
- Each tenant registers a `schema.yaml` (stored as JSONB) listing allowed paths and types (e.g., `user.role`, `doc.metadata.tags`).
- Policies reference those paths in `when` and `action` templates (e.g., `${user.department}`).
- `policy:lint` validates every referenced path against the descriptor before publish.

### Enforcement flow (runtime)
1) Pre‑Query: evaluate `when`; possibly `block`; compose `policyContext` with distilled rules.
2) Pre‑Retrieval: evaluate `when`; `rewrite` filters (with `${...}` substitutions); return `decision=modified` and `policyContext`.
3) Post‑Retrieval: redact/filter chunks (handlers to be added next); no prompt needed.
4) Post‑Generation: enforce citations/confidence; redact final output if needed.

### Storage and seeding
- PostgreSQL tables include `policies`, `policy_versions` (with `distilled_prompt`), `schema_descriptors`, `audit_index`.
- Seed via `scripts/seed.sh` to insert a tenant, descriptor v0, and four example policies.

### Local run
- `.env` (create locally; not committed):
```
ENV=dev
DATABASE_URL=postgresql://YOUR_USER@localhost:5432/gatekeeper
REDIS_URL=redis://localhost:6379/0
POLICY_VERSION=v0
```
- Start API: `uvicorn backend.app.main:app --reload`

### Next implementation steps
- Add Redis caching for compiled `policyContext`.
- Implement redact/enforce handlers and audit/metrics emission.
- Expose `policy:test` in MCP to run golden cases.


Major thing to handle: (kush)
If gatekeepr correctly handles the request in pre query mode, even then the rules will be passed to the llm (which will contradict) but when it falsely passses the system, then it shouldnt. how do we handle this?

