-- Seed minimal data for GateKeeper (tenant, schema, policies, versions)
-- Safe to run multiple times due to ON CONFLICT clauses
-- Password: 'admin' (will be hashed with bcrypt in backend)

DO $$
DECLARE
  acme_id UUID;
BEGIN
  -- Insert tenant (or get existing)
  INSERT INTO tenants (name, password_hash)
  VALUES ('acme', 'temp_hash_will_be_updated_by_backend')
  ON CONFLICT (name) DO UPDATE SET password_hash = EXCLUDED.password_hash
  RETURNING id INTO acme_id;

  -- If tenant already exists, get its ID
  IF acme_id IS NULL THEN
    SELECT id INTO acme_id FROM tenants WHERE name = 'acme';
  END IF;

  -- Schema descriptor v0
  INSERT INTO schema_descriptors (tenant_id, version, descriptor)
  VALUES (
    acme_id,
    'v0',
    '{
      "user_attributes": [
        {"name": "role", "type": "string"},
        {"name": "department", "type": "string"}
      ],
      "doc_metadata": [
        {"name": "tags", "type": "list[string]"},
        {"name": "sensitivity", "type": "string"}
      ]
    }'::jsonb
  )
  ON CONFLICT (tenant_id, version) DO NOTHING;

  -- Helper to insert a policy and version in one go
  -- pre_query: block sensitive queries for interns
  WITH p AS (
    INSERT INTO policies (tenant_id, name, labels, created_by)
    VALUES (acme_id, 'block-sensitive-queries', '{"attack": true}'::jsonb, 'seed')
    ON CONFLICT DO NOTHING
    RETURNING id
  ), pid AS (
    SELECT COALESCE((SELECT id FROM p), (SELECT id FROM policies WHERE tenant_id=acme_id AND name='block-sensitive-queries')) AS id
  )
  INSERT INTO policy_versions (policy_id, version, hash, stage, priority, content, enabled, distilled_prompt)
  SELECT id, 'v0', 'sha256:seed', 'pre_query', 100,
  '{
    "name": "block-sensitive-queries",
    "stage": "pre_query",
    "when": {"any": [{"expr": "user.role == \"intern\""}]},
    "match": {"query.text": ["salary", "PAN", "SSN"]},
    "action": {"type": "block", "message": "Restricted topic for your role."}
  }'::jsonb,
  true,
  'Do not answer about compensation/salaries of specific individuals.'
  FROM pid
  ON CONFLICT (policy_id, version) DO NOTHING;

  -- pre_retrieval: scope by department
  WITH p AS (
    INSERT INTO policies (tenant_id, name, labels, created_by)
    VALUES (acme_id, 'scope-by-department', '{}'::jsonb, 'seed')
    ON CONFLICT DO NOTHING
    RETURNING id
  ), pid AS (
    SELECT COALESCE((SELECT id FROM p), (SELECT id FROM policies WHERE tenant_id=acme_id AND name='scope-by-department')) AS id
  )
  INSERT INTO policy_versions (policy_id, version, hash, stage, priority, content, enabled, distilled_prompt)
  SELECT id, 'v0', 'sha256:seed', 'pre_retrieval', 90,
  '{
    "name": "scope-by-department",
    "stage": "pre_retrieval",
    "when": {"all": [{"expr": "user.department != null"}]},
    "match": {},
    "action": {"type": "rewrite", "filters": {"add": {"department": "${user.department}"}}}
  }'::jsonb,
  true,
  'Limit retrieval scope to the user''s department; do not access other departments.'
  FROM pid
  ON CONFLICT (policy_id, version) DO NOTHING;

  -- post_retrieval: redact PII in salary/confidential
  WITH p AS (
    INSERT INTO policies (tenant_id, name, labels, created_by)
    VALUES (acme_id, 'redact-pii-in-chunks', '{"category": "pii"}'::jsonb, 'seed')
    ON CONFLICT DO NOTHING
    RETURNING id
  ), pid AS (
    SELECT COALESCE((SELECT id FROM p), (SELECT id FROM policies WHERE tenant_id=acme_id AND name='redact-pii-in-chunks')) AS id
  )
  INSERT INTO policy_versions (policy_id, version, hash, stage, priority, content, enabled, distilled_prompt)
  SELECT id, 'v0', 'sha256:seed', 'post_retrieval', 80,
  '{
    "name": "redact-pii-in-chunks",
    "stage": "post_retrieval",
    "when": {},
    "match": {"chunk.tags_any": ["salary", "confidential"]},
    "action": {"type": "redact", "patterns": ["EMAIL", "PHONE"], "fields": ["employee_name", "amount"]}
  }'::jsonb,
  true,
  'Remove or mask PII (emails, phones) and sensitive amounts before model input.'
  FROM pid
  ON CONFLICT (policy_id, version) DO NOTHING;

  -- post_generation: enforce citations and confidence
  WITH p AS (
    INSERT INTO policies (tenant_id, name, labels, created_by)
    VALUES (acme_id, 'enforce-citations-and-confidence', '{}'::jsonb, 'seed')
    ON CONFLICT DO NOTHING
    RETURNING id
  ), pid AS (
    SELECT COALESCE((SELECT id FROM p), (SELECT id FROM policies WHERE tenant_id=acme_id AND name='enforce-citations-and-confidence')) AS id
  )
  INSERT INTO policy_versions (policy_id, version, hash, stage, priority, content, enabled, distilled_prompt)
  SELECT id, 'v0', 'sha256:seed', 'post_generation', 100,
  '{
    "name": "enforce-citations-and-confidence",
    "stage": "post_generation",
    "when": {},
    "match": {},
    "action": {"type": "enforce", "citations": {"min": 1}, "min_confidence": 0.65}
  }'::jsonb,
  true,
  'Only return factual answers with at least one citation and sufficient confidence; otherwise refuse or provide a safe fallback.'
  FROM pid
  ON CONFLICT (policy_id, version) DO NOTHING;

END $$;
