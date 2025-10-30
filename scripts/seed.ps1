Param(
  [Parameter(Mandatory=$false)][string]$DatabaseUrl
)

if (-not $DatabaseUrl) { $DatabaseUrl = $Env:DATABASE_URL }
if (-not $DatabaseUrl) { Write-Error "DATABASE_URL is not set"; exit 1 }

psql $DatabaseUrl -v ON_ERROR_STOP=1 -f migrations/seed_example.sql
Write-Output "Seed data applied successfully."


