# CLI Remote — Get Current Tunnel URL
# Run this anytime to see your current public URL.

$LogDir = Join-Path (Split-Path -Parent $PSScriptRoot) "startup\logs"
$UrlFile = Join-Path $LogDir "current-url.txt"
$TunnelErrorLog = Join-Path $LogDir "tunnel-error.log"

# Method 1: Check saved URL file (updated by the monitor)
if (Test-Path $UrlFile) {
    $url = (Get-Content $UrlFile -Raw).Trim()
    Write-Host ""
    Write-Host "  Your CLI Remote URL:" -ForegroundColor Cyan
    Write-Host "  $url" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Open this on your phone from anywhere in the world." -ForegroundColor DarkGray
    Write-Host ""
    
    # Copy to clipboard
    $url | Set-Clipboard
    Write-Host "  (Copied to clipboard)" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# Method 2: Parse from tunnel log
if (Test-Path $TunnelErrorLog) {
    $match = Get-Content $TunnelErrorLog | Select-String "https://.*\.trycloudflare\.com" | Select-Object -Last 1
    if ($match) {
        $url = ($match.Matches[0].Value).Trim()
        Write-Host ""
        Write-Host "  Your CLI Remote URL:" -ForegroundColor Cyan
        Write-Host "  $url" -ForegroundColor Green
        Write-Host ""
        $url | Set-Clipboard
        Write-Host "  (Copied to clipboard)" -ForegroundColor DarkGray
        Write-Host ""
        exit 0
    }
}

Write-Host ""
Write-Host "  No tunnel URL found. Is the tunnel running?" -ForegroundColor Red
Write-Host "  Start it with: .\startup\start-copilot-remote.ps1" -ForegroundColor DarkGray
Write-Host ""
