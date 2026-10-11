$logDir = Join-Path $env:TEMP 'opencode-curator'
$pidFile = Join-Path $logDir 'opencode-curator.pids.json'

if (-not (Test-Path $pidFile)) {
  Write-Host 'no pid file (not started via start.ps1)'
  return
}

$pids = Get-Content $pidFile -Raw | ConvertFrom-Json
foreach ($p in @($pids.server, $pids.opencode)) {
  if ($p) {
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    Write-Host "stopped $p"
  }
}
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host 'done.'
