# CLI Remote — Tunnel URL Monitor & Phone Notifier
# Compatible with Windows PowerShell 5.1+
#
# Watches for tunnel URL changes and sends the new URL to your phone.
#
# This script does three things:
#   1. Monitors the tunnel log for URL changes
#   2. Saves the current URL to startup/logs/current-url.txt
#   3. Sends a push notification to your phone via ntfy.sh (FREE, no signup!)
#
# SETUP (one-time, 1 minute):
#   1. Install "ntfy" app on your phone (Android or iPhone)
#   2. Open the app, tap "+", subscribe to topic: cli-remote-virat
#   3. Done! You will get push notifications with your URL automatically.

param(
    [int]$PollIntervalSeconds = 10
)

$ErrorActionPreference = "Continue"

$AppDir     = Split-Path -Parent $PSScriptRoot
$LogDir     = Join-Path $AppDir "startup\logs"
$UrlFile    = Join-Path $LogDir "current-url.txt"
$TunnelLog  = Join-Path $LogDir "tunnel-error.log"
$ConfigFile = Join-Path $PSScriptRoot ".notifier-config"

# Ensure log directory exists
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# ---- Load config ----
$NtfyTopic = "cli-remote-virat"
$Phone     = ""
$ApiKey    = ""

if (Test-Path $ConfigFile) {
    foreach ($line in (Get-Content $ConfigFile)) {
        if ($line -match '^\s*PHONE\s*=\s*(.+)$')      { $Phone     = $matches[1].Trim() }
        if ($line -match '^\s*APIKEY\s*=\s*(.+)$')     { $ApiKey    = $matches[1].Trim() }
        if ($line -match '^\s*NTFY_TOPIC\s*=\s*(.+)$') { $NtfyTopic = $matches[1].Trim() }
    }
}

$canWhatsApp = ($Phone -ne "") -and ($ApiKey -ne "") -and ($ApiKey -ne "YOUR_API_KEY_HERE")

Write-Host ("[monitor] ntfy.sh push notifications enabled (topic: " + $NtfyTopic + ")")

# ---- Helper: extract URL from tunnel log ----
function Get-TunnelUrl {
    if (-not (Test-Path $TunnelLog)) { return $null }
    $match = Get-Content $TunnelLog -ErrorAction SilentlyContinue |
        Select-String "https://[a-z0-9\-]+\.trycloudflare\.com" |
        Select-Object -Last 1
    if ($match) { return $match.Matches[0].Value.Trim() }
    return $null
}

# ---- Helper: send push notification via ntfy.sh ----
function Send-Ntfy {
    param([string]$Title, [string]$Message, [string]$ClickUrl)
    try {
        $bodyObj = @{
            topic    = $NtfyTopic
            title    = $Title
            message  = $Message
            priority = 4
            tags     = @("computer", "link")
            click    = $ClickUrl
            actions  = @(@{
                action = "view"
                label  = "Open CLI Remote"
                url    = $ClickUrl
            })
        }
        $bodyJson = $bodyObj | ConvertTo-Json -Depth 3
        Invoke-RestMethod -Uri "https://ntfy.sh" -Method POST -Body $bodyJson -ContentType "application/json" -TimeoutSec 15 | Out-Null
        Write-Host "[monitor] ntfy.sh push notification sent!"
    } catch {
        Write-Host ("[monitor] ntfy.sh send failed: " + $_.Exception.Message)
    }
}

# ---- Helper: send WhatsApp message via CallMeBot (optional) ----
function Send-WhatsApp {
    param([string]$Message)
    if (-not $canWhatsApp) { return }
    try {
        $encoded = [System.Uri]::EscapeDataString($Message)
        $waUrl = "https://api.callmebot.com/whatsapp.php?phone=" + $Phone + "&text=" + $encoded + "&apikey=" + $ApiKey
        Invoke-RestMethod -Uri $waUrl -Method GET -TimeoutSec 15 | Out-Null
        Write-Host "[monitor] WhatsApp notification sent!"
    } catch {
        Write-Host ("[monitor] WhatsApp send failed: " + $_.Exception.Message)
    }
}

# ---- Monitor loop ----
Write-Host ("[monitor] Watching for tunnel URL changes (poll every " + $PollIntervalSeconds + "s)...")

$lastUrl = $null
if (Test-Path $UrlFile) {
    $lastUrl = (Get-Content $UrlFile -Raw -ErrorAction SilentlyContinue)
    if ($lastUrl) { $lastUrl = $lastUrl.Trim() }
}

while ($true) {
    try {
        $currentUrl = Get-TunnelUrl

        if ($currentUrl -and ($currentUrl -ne $lastUrl)) {
            Write-Host ("[monitor] New URL detected: " + $currentUrl)

            # Save to file
            $currentUrl | Out-File -FilePath $UrlFile -NoNewline -Encoding UTF8
            Write-Host ("[monitor] Saved to " + $UrlFile)

            # Send push notification via ntfy.sh
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
            $ntfyMsg = $currentUrl + "`nUpdated: " + $timestamp
            Send-Ntfy -Title "CLI Remote is online!" -Message $ntfyMsg -ClickUrl $currentUrl

            # Also send WhatsApp if configured
            $waMsg = "CLI Remote is online! " + $currentUrl + " (Updated: " + $timestamp + ")"
            Send-WhatsApp -Message $waMsg

            $lastUrl = $currentUrl
        }
    } catch {
        Write-Host ("[monitor] Error: " + $_.Exception.Message)
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
