#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=postgresql://localhost:5432/gatekeeper ./scripts/seed.sh

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/seed_example.sql
echo "Seed data applied successfully."


