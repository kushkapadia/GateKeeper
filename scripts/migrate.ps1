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

# Get the migration file path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$migrationFile = Join-Path $projectRoot "migrations\001_init.sql"

if (-not (Test-Path $migrationFile)) {
  Write-Error "Migration file not found: $migrationFile"
  exit 1
}

$migrationFile = (Resolve-Path $migrationFile).Path

# Parse connection string and use individual psql parameters (more reliable on Windows)
# Handles formats: postgresql://user:pass@host:port/db or postgresql://user@host:port/db
if ($DatabaseUrl -match "^postgresql://(?:([^:@]+)(?::([^@]+))?@)?([^:/]+)(?::(\d+))?/(.+)$") {
    $username = if ($matches[1]) { $matches[1] } else { "postgres" }
    $password = $matches[2]
    $host = $matches[3]
    $port = if ($matches[4]) { $matches[4] } else { "5432" }
    $database = $matches[5]
    
    # Build psql command with individual parameters
    $env:PGPASSWORD = $password
    $psqlArgs = @(
        "-h", $host,
        "-p", $port,
        "-U", $username,
        "-d", $database,
        "-v", "ON_ERROR_STOP=1",
        "-f", $migrationFile
    )
    
    & psql $psqlArgs
    $exitCode = $LASTEXITCODE
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
} else {
    # Fallback: try using connection string directly (may not work on all Windows setups)
    Write-Warning "Could not parse connection string, trying direct format..."
    & psql $DatabaseUrl -v "ON_ERROR_STOP=1" -f $migrationFile
    $exitCode = $LASTEXITCODE
}

if ($exitCode -ne 0) {
  Write-Error "Migration failed with exit code $exitCode"
  exit $exitCode
}

Write-Output "Migration applied successfully."


