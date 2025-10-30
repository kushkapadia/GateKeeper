Param(
  [Parameter(Mandatory=$false)][string]$DatabaseUrl
)

if (-not $DatabaseUrl) {
  $DatabaseUrl = $Env:DATABASE_URL
}

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Pass -DatabaseUrl or set env var."
  exit 1
}

psql $DatabaseUrl -v ON_ERROR_STOP=1 -f migrations/001_init.sql
Write-Output "Migration applied successfully."


