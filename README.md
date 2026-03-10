# CLI Remote

Access your computer's command line from anywhere in the world. Full terminal access from your phone, tablet, or any browser — no VPN, no SSH config, no port forwarding. Just open a link and you're in.

## What It Does

CLI Remote turns your computer into a remotely accessible terminal server. It runs a web-based terminal on your machine and exposes it through a secure Cloudflare tunnel, giving you **full command-line access** to your computer from any device, anywhere on the planet.

- Run any command as if you were sitting at your computer
- Install software, manage files, run scripts, administer your system
- Works from your phone on mobile data, a hotel Wi-Fi, or another continent

## Features

- **Full Terminal Access** – Complete shell access (PowerShell, CMD, Bash) with PTY support via node-pty, fallback to child_process
- **Access From Anywhere** – Cloudflare Tunnel integration gives you a public HTTPS URL with zero config
- **Mobile-First UI** – Responsive design optimised for phones; 44px touch targets, slide-in sidebar, on-screen keyboard toolbar
- **Multiple Sessions** – Create, switch, and close independent terminal sessions simultaneously
- **Real-Time Streaming** – WebSocket-based bidirectional terminal I/O with zero perceptible lag
- **AI Command Help** – Optional GitHub Copilot integration to suggest or explain commands
- **Secure Authentication** – JWT-based login with bcrypt passwords, token refresh, and session blacklisting
- **Auto-Start on Boot** – Startup script + Windows Startup folder integration so it's always running
- **Dark Theme** – Clean dark UI inspired by GitHub's colour palette

## Requirements

- Node.js 18+
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (`cloudflared`) for remote access
- GitHub CLI (`gh`) with Copilot extension *(optional — for AI command suggestions)*

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
# Edit .env — set JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

# 3. Start the server
npm start

# 4. (Optional) Expose to the internet
cloudflared tunnel --url http://localhost:3000
```

Open the printed URL on any device — phone, tablet, another PC — and log in.

## Auto-Start on Boot

The `startup/` folder contains scripts to run CLI Remote automatically when your computer starts:

```powershell
# Starts both the server and Cloudflare tunnel in the background
.\startup\start-copilot-remote.ps1

# Stops everything
.\startup\stop-copilot-remote.ps1
```

A shortcut in the Windows Startup folder ensures it launches at login. To find your current public URL after a restart:

```powershell
Get-Content "startup\logs\tunnel-error.log" | Select-String "trycloudflare.com"
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | auto-generated | Secret for signing JWTs — **must be set in production** |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime |
| `ADMIN_USERNAME` | `admin` | Login username |
| `ADMIN_PASSWORD` | `changeme` | Login password — **change this immediately** |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins (use `*` for tunnel access) |
| `MAX_SESSIONS` | `10` | Maximum concurrent terminal sessions |
| `SESSION_TIMEOUT` | `1800000` | Idle session timeout in ms (30 min) |
| `COPILOT_COMMAND` | `gh copilot` | Copilot CLI command prefix (for AI suggestions) |
| `NODE_ENV` | `development` | Set to `production` for production |

## Architecture

```
server.js              Express + WebSocket server entry point
startup/
  start-*.ps1          Auto-start script (server + Cloudflare tunnel)
  stop-*.ps1           Stop script
  logs/                Runtime logs
src/
  config.js            Environment-based configuration (reads .env)
  auth/
    middleware.js       JWT authentication middleware + blacklist
    routes.js           Login / logout / refresh / verify endpoints
  api/
    sessions.js         Terminal session CRUD REST API
    commands.js         Command execute / history / suggest / explain
    status.js           Health check endpoints
  services/
    terminal.js         PTY / child_process terminal wrapper
    sessionManager.js   Session lifecycle management (singleton)
    copilot.js          GitHub Copilot CLI integration (optional)
  ws/
    handler.js          WebSocket message protocol handler
public/
  index.html            Main SPA
  login.html            Login page
  css/                  Styles
  js/                   Client-side JavaScript modules
```

## Security Notes

- **Always** set a strong `JWT_SECRET` and `ADMIN_PASSWORD` before exposing to the internet
- This gives **full shell access** to your computer — treat credentials like root passwords
- HTTPS is provided automatically when using Cloudflare Tunnel
- Rate limiting is applied to all endpoints (5 login attempts per 15 min)
- The server binds to `0.0.0.0` by default; restrict with `HOST` if needed
- Consider firewall rules to limit local access if the machine is shared

## License

MIT
