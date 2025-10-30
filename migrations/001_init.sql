-- Idempotent-ish: uses IF NOT EXISTS where possible

-- UUID helper (safe if already installed)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  labels JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  stage TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  content JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  distilled_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_id, version)
);

CREATE TABLE IF NOT EXISTS schema_descriptors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  descriptor JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);

-- Lightweight audit index (metadata only). Raw events can live in object store/files.
CREATE TABLE IF NOT EXISTS audit_index (
  audit_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  correlation_id TEXT,
  ts TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL,
  policy_version TEXT,
  policy_hash TEXT,
  user_id_hash TEXT,
  decision TEXT NOT NULL,
  policies JSONB NOT NULL DEFAULT '[]',
  metrics JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_index (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_stage ON audit_index (stage);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_index (user_id_hash);

-- Simple users table for Studio auth (optional placeholder)
CREATE TABLE IF NOT EXISTS studio_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analytics snapshots (precomputed aggregates for fast dashboards)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,        -- e.g., blocks_by_policy
  payload JSONB NOT NULL
);

-- Test suites storage for MCP policy:test
CREATE TABLE IF NOT EXISTS policy_test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);


