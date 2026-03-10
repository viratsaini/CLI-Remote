# CLI Remote — Startup Script
# Starts the Node.js server and Cloudflare tunnel together.
# Gives you full terminal access to this computer from anywhere in the world.
# Runs at Windows startup via the Startup folder shortcut.

$ErrorActionPreference = "Continue"

# ---- Configuration ----
$AppDir      = Split-Path -Parent $PSScriptRoot   # Remote-CLI root
$LogDir      = Join-Path $AppDir "startup\logs"
$ServerLog   = Join-Path $LogDir "server.log"
$TunnelLog   = Join-Path $LogDir "tunnel.log"
$CloudflaredExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

# Ensure log directory exists
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# ---- Load .env file into process environment ----
$EnvFile = Join-Path $AppDir ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
    Write-Host "[startup] Loaded .env file"
} else {
    Write-Host "[startup] WARNING: No .env file found at $EnvFile"
}

# ---- Kill any previous instances ----
Get-Process -Name "node" -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.CommandLine -match "server\.js" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# ---- Start the Node.js server ----
Write-Host "[startup] Starting CLI Remote server..."
$serverProcess = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $AppDir `
    -RedirectStandardOutput $ServerLog `
    -RedirectStandardError "$LogDir\server-error.log" `
    -PassThru -WindowStyle Hidden

Write-Host "[startup] Server started (PID: $($serverProcess.Id))"

# Give the server a moment to bind to the port
Start-Sleep -Seconds 3

# ---- Start Cloudflare Tunnel ----
Write-Host "[startup] Starting Cloudflare Tunnel..."
$tunnelProcess = Start-Process -FilePath $CloudflaredExe `
    -ArgumentList "tunnel --url http://localhost:3000" `
    -RedirectStandardOutput $TunnelLog `
    -RedirectStandardError "$LogDir\tunnel-error.log" `
    -PassThru -WindowStyle Hidden

Write-Host "[startup] Cloudflare Tunnel started (PID: $($tunnelProcess.Id))"

# Wait for tunnel to establish and get a URL before starting monitor
Write-Host "[startup] Waiting for tunnel URL..."
$tunnelReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    $tunnelErrLog = Join-Path $LogDir "tunnel-error.log"
    if (Test-Path $tunnelErrLog) {
        $urlMatch = Get-Content $tunnelErrLog -ErrorAction SilentlyContinue | Select-String "trycloudflare\.com" | Select-Object -Last 1
        if ($urlMatch) {
            Write-Host "[startup] Tunnel URL found!"
            $tunnelReady = $true
            break
        }
    }
}
if (-not $tunnelReady) {
    Write-Host "[startup] WARNING: Tunnel URL not detected after 60s. Monitor will keep polling."
}

# ---- Start URL Monitor (detects URL change -> saves to file + ntfy push) ----
$monitorScript = Join-Path $PSScriptRoot "url-monitor.ps1"
if (Test-Path $monitorScript) {
    $monitorProcess = Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$monitorScript`"" `
        -WorkingDirectory $PSScriptRoot `
        -PassThru -WindowStyle Hidden
    Write-Host "[startup] URL Monitor started (PID: $($monitorProcess.Id))"
}

# ---- Save PIDs for the stop script ----
$PidFile = Join-Path $LogDir "pids.json"
@{
    server  = $serverProcess.Id
    tunnel  = $tunnelProcess.Id
    monitor = if ($monitorProcess) { $monitorProcess.Id } else { 0 }
    startedAt = (Get-Date -Format "o")
} | ConvertTo-Json | Out-File -FilePath $PidFile -Encoding UTF8

Write-Host "[startup] Done. To get your URL anytime, run:"
Write-Host "  .\startup\get-url.ps1"

