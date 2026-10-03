# JobAgent AI — Automated PostgreSQL Database Backup Script
# Usage: powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1

param (
    [string]$ContainerName = "job-agent-postgres-1",
    [string]$DbUser = "postgres",
    [string]$DbName = "jobagent",
    [string]$BackupDir = "$PSScriptRoot\..\backups",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = [System.IO.Path]::GetFullPath($BackupDir)

if (-not (Test-Path $BackupPath)) {
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
}

$OutputFile = Join-Path $BackupPath "jobagent_backup_$Timestamp.sql"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " JobAgent AI Database Backup Utility" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Target Database: $DbName"
Write-Host "Output File:     $OutputFile"

try {
    # Check if docker container is running
    $dockerCheck = docker ps --filter "name=$ContainerName" --format "{{.Names}}"
    if (-not $dockerCheck) {
        # Fallback to any postgres container in project
        $dockerCheck = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
    }

    if ($dockerCheck) {
        Write-Host "Executing pg_dump inside container '$dockerCheck'..." -ForegroundColor Green
        docker exec -t $dockerCheck pg_dump -U $DbUser -d $DbName --clean --if-exists > $OutputFile
    } else {
        Write-Host "Docker container not found, trying local pg_dump..." -ForegroundColor Yellow
        pg_dump -U $DbUser -h localhost -p 5432 -d $DbName --clean --if-exists -f $OutputFile
    }

    $FileInfo = Get-Item $OutputFile
    $SizeKB = [math]::Round($FileInfo.Length / 1KB, 2)
    Write-Host "Backup completed successfully! ($SizeKB KB)" -ForegroundColor Green

    # Retention cleanup
    Write-Host "Enforcing $RetentionDays-day retention policy..." -ForegroundColor Gray
    Get-ChildItem -Path $BackupPath -Filter "jobagent_backup_*.sql" | Where-Object {
        $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays)
    } | Remove-Item -Force

    Write-Host "Database backup workflow complete." -ForegroundColor Cyan
} catch {
    Write-Host "Database backup failed: $_" -ForegroundColor Red
    exit 1
}
