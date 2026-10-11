param(
  [int]$Port = 8787,
  [int]$OpencodePort = 4096,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:TEMP 'opencode-curator'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$pidFile = Join-Path $logDir 'opencode-curator.pids.json'

function Test-Port([int]$p) {
  return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

$serverDist = Join-Path $root 'server\dist\index.js'
$webDist = Join-Path $root 'web\dist\index.html'
if (-not (Test-Path $serverDist) -or -not (Test-Path $webDist)) {
  Write-Host '[build] npm run build ...'
  Push-Location $root
  npm run build
  Pop-Location
}

$opencodePid = $null
if (Test-Port $OpencodePort) {
  Write-Host "[opencode] reuse running serve on :$OpencodePort"
} else {
  Write-Host "[opencode] starting serve on :$OpencodePort"
  $oc = Start-Process -FilePath 'opencode.cmd' -ArgumentList @('serve', '--port', "$OpencodePort", '--hostname', '127.0.0.1') -RedirectStandardOutput (Join-Path $logDir 'opencode.out.log') -RedirectStandardError (Join-Path $logDir 'opencode.err.log') -PassThru -WindowStyle Hidden
  $opencodePid = $oc.Id
}

if (Test-Port $Port) {
  Write-Host "[opencode-curator] port $Port already in use"
} else {
  $env:PORT = "$Port"
  $env:OPENCODE_SERVER_URL = "http://127.0.0.1:$OpencodePort"
  Write-Host "[opencode-curator] starting server on :$Port"
  $srv = Start-Process -FilePath 'node' -ArgumentList @('server/dist/index.js') -WorkingDirectory $root -RedirectStandardOutput (Join-Path $logDir 'opencode-curator.out.log') -RedirectStandardError (Join-Path $logDir 'opencode-curator.err.log') -PassThru -WindowStyle Hidden
  @{ server = $srv.Id; opencode = $opencodePid } | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8
}

$url = "http://127.0.0.1:$Port"
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $r = Invoke-RestMethod "$url/api/health" -TimeoutSec 2
    if ($r.ok) { $ready = $true; break }
  } catch { }
}

Write-Host ''
if ($ready) { Write-Host "[ready] $url" } else { Write-Host "[warn] not healthy yet, check logs: $logDir" }
Write-Host "[logs] $logDir   [stop] scripts\stop.ps1"
if (-not $NoBrowser) { Start-Process $url }
