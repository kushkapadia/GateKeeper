# Running Migrations on Windows

## Option 1: Using Docker (Recommended)

If you're using `docker-compose.yml` to run PostgreSQL:

### Steps:

1. **Start your Docker containers:**
   ```powershell
   docker-compose up -d postgres
   ```
   This starts the PostgreSQL container in the background.

2. **Wait a few seconds** for PostgreSQL to fully start.

3. **Run the migration from inside the container:**
   ```powershell
   docker-compose exec postgres psql -U postgres -d gatekeeper -f /app/migrations/001_init.sql
   ```
   
   **OR** if you need to copy the file first:
   ```powershell
   # Copy migration file to container
   docker cp migrations/001_init.sql $(docker-compose ps -q postgres):/tmp/001_init.sql
   
   # Run migration
   docker-compose exec postgres psql -U postgres -d gatekeeper -f /tmp/001_init.sql
   ```

4. **Verify the migration:**
   ```powershell
   docker-compose exec postgres psql -U postgres -d gatekeeper -c "\dt"
   ```
   This lists all tables to confirm they were created.

---

## Option 2: Using Local PostgreSQL Installation

If you have PostgreSQL installed locally on Windows:

### Prerequisites:
- PostgreSQL must be installed (download from https://www.postgresql.org/download/windows/)
- `psql` must be in your PATH (usually `C:\Program Files\PostgreSQL\<version>\bin\`)

### Steps:

1. **Open PowerShell** in the project root directory.

2. **Set the DATABASE_URL environment variable:**
   ```powershell
   $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/gatekeeper"
   ```
   Replace `postgres:postgres` with your actual PostgreSQL username and password if different.

3. **Run the migration script:**
   ```powershell
   .\scripts\migrate.ps1
   ```

   **OR** pass the database URL directly:
   ```powershell
   .\scripts\migrate.ps1 -DatabaseUrl "postgresql://postgres:postgres@localhost:5432/gatekeeper"
   ```

4. **If you get an error about psql not found:**
   - Add PostgreSQL bin directory to PATH:
     ```powershell
     $env:Path += ";C:\Program Files\PostgreSQL\15\bin"
     ```
     (Replace `15` with your PostgreSQL version number)

---

## Option 3: Using WSL (Windows Subsystem for Linux)

If you have WSL installed:

1. **Open WSL terminal** and navigate to your project:
   ```bash
   cd /mnt/c/path/to/PluggablepolicyLayer
   ```

2. **Set DATABASE_URL:**
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gatekeeper"
   ```

3. **Run the bash migration script:**
   ```bash
   bash scripts/migrate.sh
   ```

---

## Troubleshooting

### Error: "psql: command not found"
- **Solution**: Install PostgreSQL or use Docker (Option 1)

### Error: "connection refused" or "could not connect"
- **Solution**: Make sure PostgreSQL is running:
  - Docker: `docker-compose ps` (check if postgres container is up)
  - Local: Check Windows Services for "postgresql" service

### Error: "database does not exist"
- **Solution**: Create the database first:
  ```powershell
  # Docker
  docker-compose exec postgres psql -U postgres -c "CREATE DATABASE gatekeeper;"
  
  # Local
  psql -U postgres -c "CREATE DATABASE gatekeeper;"
  ```

### Error: "permission denied" or "authentication failed"
- **Solution**: Check your database credentials in the DATABASE_URL connection string

---

## Quick Reference: Database URL Format

```
postgresql://[username]:[password]@[host]:[port]/[database]
```

Example:
```
postgresql://postgres:postgres@localhost:5432/gatekeeper
```


