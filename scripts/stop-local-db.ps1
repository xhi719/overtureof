$root = Split-Path -Parent $PSScriptRoot
$ctl = Join-Path $root '.runtime\pgsql\bin\pg_ctl.exe'
$data = Join-Path $root '.runtime\pgdata'
& $ctl -D $data status *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Project-local PostgreSQL is already stopped.'; exit 0 }
& $ctl -D $data -m fast -w stop
if ($LASTEXITCODE -ne 0) { throw 'Could not stop PostgreSQL.' }
