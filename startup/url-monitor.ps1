# CLI Remote — Tunnel URL Monitor & Phone Notifier
# Watches for tunnel URL changes and sends the new URL to your phone.
#
# This script does three things:
#   1. Monitors the tunnel log for URL changes
#   2. Saves the current URL to startup/logs/current-url.txt
#   3. Sends a push notification to your phone via ntfy.sh (FREE, no signup!)
#
# ── SETUP (one-time, 1 minute) ──────────────────────────────────────────────
#
# 1. Install the "ntfy" app on your phone:
#      Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy
#      iPhone:  https://apps.apple.com/app/ntfy/id1625396347
#
# 2. Open the app → tap "+" → Subscribe to topic: cli-remote-virat
#    (this is your private channel name — change it if you want)
#
# 3. That's it! You'll get push notifications with your URL automatically.
#
# Optional: WhatsApp via CallMeBot (if you get an API key later)
#   Set APIKEY in startup/.notifier-config
#
# Config file: startup/.notifier-config
# ┌─────────────────────────────────────────────┐
# │ PHONE=918273436552                          │
# │ APIKEY=your-callmebot-key (optional)        │
# │ NTFY_TOPIC=cli-remote-virat                 │
# └─────────────────────────────────────────────┘
#
# ─────────────────────────────────────────────────────────────────────────────

param(
    [int]$PollIntervalSeconds = 10
)

$ErrorActionPreference = "Continue"

$AppDir   = Split-Path -Parent $PSScriptRoot
$LogDir   = Join-Path $AppDir "startup\logs"
$UrlFile  = Join-Path $LogDir "current-url.txt"
$TunnelLog = Join-Path $LogDir "tunnel-error.log"
$ConfigFile = Join-Path $PSScriptRoot ".notifier-config"

# ---- Load config ----
$Phone     = $env:CALLMEBOT_PHONE
$ApiKey    = $env:CALLMEBOT_APIKEY
$NtfyTopic = $env:NTFY_TOPIC ?? "cli-remote-virat"

if (Test-Path $ConfigFile) {
    Get-Content $ConfigFile | ForEach-Object {
        if ($_ -match '^\s*PHONE\s*=\s*(.+)$')      { $Phone     = $matches[1].Trim() }
        if ($_ -match '^\s*APIKEY\s*=\s*(.+)$')     { $ApiKey    = $matches[1].Trim() }
        if ($_ -match '^\s*NTFY_TOPIC\s*=\s*(.+)$') { $NtfyTopic = $matches[1].Trim() }
    }
}

$canWhatsApp = $Phone -and $ApiKey -and ($ApiKey -ne "YOUR_API_KEY_HERE")

Write-Host "[monitor] ntfy.sh push notifications enabled (topic: $NtfyTopic)"
if ($canWhatsApp) {
    Write-Host "[monitor] WhatsApp notifications also enabled for +$Phone"
} else {
    Write-Host "[monitor] WhatsApp notifications disabled (no CallMeBot API key)"
    Write-Host "[monitor] Using ntfy.sh only — install the ntfy app and subscribe to: $NtfyTopic"
}

# ---- Helper: extract URL from tunnel log ----
function Get-TunnelUrl {
    if (-not (Test-Path $TunnelLog)) { return $null }
    $match = Get-Content $TunnelLog -ErrorAction SilentlyContinue |
        Select-String "https://[a-z0-9\-]+\.trycloudflare\.com" |
        Select-Object -Last 1
    if ($match) { return $match.Matches[0].Value.Trim() }
    return $null
}

# ---- Helper: send push notification via ntfy.sh (FREE, no signup) ----
function Send-Ntfy {
    param([string]$Title, [string]$Message, [string]$Url)
    try {
        $body = @{
            topic    = $NtfyTopic
            title    = $Title
            message  = $Message
            priority = 4
            tags     = @("computer", "link")
            click    = $Url
            actions  = @(@{
                action = "view"
                label  = "Open CLI Remote"
                url    = $Url
            })
        } | ConvertTo-Json -Depth 3

        Invoke-RestMethod -Uri "https://ntfy.sh" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15 | Out-Null
        Write-Host "[monitor] ntfy.sh push notification sent!"
    } catch {
        Write-Host "[monitor] ntfy.sh send failed: $($_.Exception.Message)"
    }
}

# ---- Helper: send WhatsApp message via CallMeBot (optional) ----
function Send-WhatsApp {
    param([string]$Message)
    if (-not $canWhatsApp) { return }
    try {
        $encoded = [System.Uri]::EscapeDataString($Message)
        $uri = "https://api.callmebot.com/whatsapp.php?phone=$Phone&text=$encoded&apikey=$ApiKey"
        Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 15 | Out-Null
        Write-Host "[monitor] WhatsApp notification sent!"
    } catch {
        Write-Host "[monitor] WhatsApp send failed: $($_.Exception.Message)"
    }
}

# ---- Monitor loop ----
Write-Host "[monitor] Watching for tunnel URL changes (poll every ${PollIntervalSeconds}s)..."
Write-Host "[monitor] Press Ctrl+C to stop"
Write-Host ""

$lastUrl = $null
if (Test-Path $UrlFile) {
    $lastUrl = (Get-Content $UrlFile -Raw -ErrorAction SilentlyContinue).Trim()
}

while ($true) {
    $currentUrl = Get-TunnelUrl

    if ($currentUrl -and $currentUrl -ne $lastUrl) {
        Write-Host "[monitor] New URL detected: $currentUrl" -ForegroundColor Green

        # Save to file
        $currentUrl | Out-File -FilePath $UrlFile -NoNewline -Encoding UTF8
        Write-Host "[monitor] Saved to $UrlFile"

        # Send push notification via ntfy.sh
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        Send-Ntfy -Title "CLI Remote is online!" -Message "$currentUrl`n`nUpdated: $timestamp" -Url $currentUrl

        # Also send WhatsApp if configured
        $msg = "CLI Remote is online!`n`n$currentUrl`n`nOpen this link to access your computer.`n`nUpdated: $timestamp"
        Send-WhatsApp -Message $msg

        $lastUrl = $currentUrl
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
