# Stop Script — kills the server and tunnel processes
$LogDir = Join-Path (Split-Path -Parent $PSScriptRoot) "startup\logs"
$PidFile = Join-Path $LogDir "pids.json"

if (Test-Path $PidFile) {
    $pids = Get-Content $PidFile | ConvertFrom-Json
    Write-Host "[stop] Stopping server (PID: $($pids.server))..."
    Stop-Process -Id $pids.server -Force -ErrorAction SilentlyContinue
    Write-Host "[stop] Stopping tunnel (PID: $($pids.tunnel))..."
    Stop-Process -Id $pids.tunnel -Force -ErrorAction SilentlyContinue
    Remove-Item $PidFile -Force
    Write-Host "[stop] All processes stopped."
} else {
    Write-Host "[stop] No PID file found. Attempting to stop by port..."
    Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "[stop] Done."
}
