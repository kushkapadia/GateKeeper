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
# Handles formats: 
#   postgresql://user:pass@host:port/db
#   postgresql://user@host:port/db  
#   postgresql://user:@host:port/db (empty password)
#   postgresql://host:port/db (no auth)

$parsed = $false
$username = "postgres"
$password = $null
$dbHost = "localhost"
$port = "5432"
$database = "gatekeeper"

# Try to parse the connection string
if ($DatabaseUrl -match "^postgresql://") {
    # Remove the protocol
    $urlPart = $DatabaseUrl -replace "^postgresql://", ""
    
    # Split into auth@host:port/db parts
    if ($urlPart -match "^([^@]+)@(.+)$") {
        # Has authentication part
        $authPart = $matches[1]
        $rest = $matches[2]
        
        if ($authPart -match "^([^:]+):(.*)$") {
            # Has colon (password may be empty)
            $username = $matches[1]
            $password = $matches[2]
            # If password is empty string, set to $null
            if ([string]::IsNullOrEmpty($password)) {
                $password = $null
            }
        } else {
            # No password, just username
            $username = $authPart
        }
    } else {
        # No authentication
        $rest = $urlPart
    }
    
    # Parse host:port/database
    if ($rest -match "^([^:/]+)(?::(\d+))?/(.+)$") {
        $dbHost = $matches[1]
        if ($matches[2]) { $port = $matches[2] }
        $database = $matches[3]
        $parsed = $true
    }
}

if ($parsed) {
    # Build psql command with individual parameters
    if ($password) {
        $env:PGPASSWORD = $password
    }
    
    $psqlArgs = @(
    "-h", $dbHost,
    "-p", $port,
    "-U", $username,
    "-d", $database,
    "--set", "sslmode=require",
    "-v", "ON_ERROR_STOP=1",
    "-f", $migrationFile
)
    
    Write-Output "Running migration with: psql -h $dbHost -p $port -U $username -d $database"
    & psql $psqlArgs
    $exitCode = $LASTEXITCODE
    
    if ($password) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
} else {
    Write-Error "Could not parse connection string: $DatabaseUrl"
    Write-Error "Expected format: postgresql://[user[:password]@]host[:port]/database"
    exit 1
}

if ($exitCode -ne 0) {
  Write-Error "Migration failed with exit code $exitCode"
  exit $exitCode
}

Write-Output "Migration applied successfully."


