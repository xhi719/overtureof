$root = Split-Path -Parent $PSScriptRoot
$ctl = Join-Path $root '.runtime\pgsql\bin\pg_ctl.exe'
$data = Join-Path $root '.runtime\pgdata'
$log = Join-Path $root '.runtime\postgres.log'
if (-not (Test-Path -LiteralPath $ctl) -or -not (Test-Path -LiteralPath $data)) { throw 'Project-local PostgreSQL is not initialized. See README.' }
& $ctl -D $data status *> $null
if ($LASTEXITCODE -eq 0) { Write-Host 'Project-local PostgreSQL is already running.'; exit 0 }
& $ctl -D $data -l $log -w start
if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL; inspect .runtime/postgres.log.' }
