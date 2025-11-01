-- Drop all tables in correct order (respecting foreign key constraints)
-- WARNING: This will delete all data!

DROP TABLE IF EXISTS policy_test_suites CASCADE;
DROP TABLE IF EXISTS analytics_snapshots CASCADE;
DROP TABLE IF EXISTS audit_index CASCADE;
DROP TABLE IF EXISTS studio_users CASCADE;
DROP TABLE IF EXISTS policy_versions CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS schema_descriptors CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

