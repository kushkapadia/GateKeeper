#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=postgresql://user:pass@localhost:5432/gatekeeper ./scripts/migrate.sh

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_init.sql
echo "Migration applied successfully."


