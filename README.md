# Copilot CLI Remote

A production-quality web application that lets you control a GitHub Copilot CLI running on your laptop from any mobile device via a browser.

## Features

- **Full Terminal Emulation** – xterm.js-powered terminal with PTY support (node-pty) and fallback to child_process
- **Mobile-First Design** – Responsive UI optimised for phones; 44px touch targets, slide-in sidebar, bottom toolbar
- **Multiple Sessions** – Create, switch, and close independent terminal sessions
- **WebSocket Streaming** – Real-time bidirectional terminal I/O via WebSocket
- **Copilot Integration** – Ask Copilot to suggest or explain commands from within the UI
- **JWT Authentication** – Secure login with token refresh and logout blacklisting
- **Dark GitHub Theme** – Familiar colour palette matching GitHub's dark mode

## Requirements

- Node.js 18+ 
- GitHub CLI (`gh`) with Copilot extension (optional but recommended)

## Quick Start

```bash
# Clone / navigate to project directory
cd /path/to/project

# Install dependencies
npm install

# Configure (copy and edit)
cp .env.example .env
# Edit .env and set a strong JWT_SECRET and ADMIN_PASSWORD

# Start the server
npm start
```

Open `http://localhost:3000` in your browser (or the network address printed on startup to access from a phone).

Default credentials: `admin` / `changeme` — **change these before deploying**.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | auto-generated | Secret for signing JWTs — **must be set in production** |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime |
| `ADMIN_USERNAME` | `admin` | Login username |
| `ADMIN_PASSWORD` | `changeme` | Login password — **must be changed** |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `MAX_SESSIONS` | `10` | Maximum concurrent terminal sessions |
| `SESSION_TIMEOUT` | `1800000` | Idle session timeout in ms (30 min) |
| `COPILOT_COMMAND` | `gh copilot` | Copilot CLI command prefix |
| `NODE_ENV` | `development` | Set to `production` for production |

## Accessing from Mobile

When the server starts it prints the local network IP address:

```
🚀 Copilot CLI Remote started
   Local: http://localhost:3000
   Network: http://192.168.1.42:3000  ← use this on mobile
```

Open that URL on any device on the same Wi-Fi network.

## Architecture

```
server.js            Express + WebSocket server entry point
src/
  config.js          Environment-based configuration
  auth/
    middleware.js    JWT authentication middleware + blacklist
    routes.js        Login / logout / refresh / verify endpoints
  api/
    sessions.js      Terminal session REST API
    commands.js      Command execute / history / suggest / explain
    status.js        Health check endpoints
  services/
    terminal.js      PTY / child_process terminal wrapper
    sessionManager.js  Session lifecycle management (singleton)
    copilot.js       gh copilot CLI integration
  ws/
    handler.js       WebSocket message protocol handler
public/
  index.html         Main SPA
  login.html         Login page
  css/               Styles
  js/                Client-side JavaScript modules
```

## Security Notes

- Always set a strong, unique `JWT_SECRET` in production
- Change `ADMIN_PASSWORD` before exposing the server to a network
- Use HTTPS (e.g., via a reverse proxy like nginx or Caddy) when accessing over the internet
- The server binds to `0.0.0.0` by default; restrict with `HOST` if needed
- Rate limiting is applied to all endpoints (5 login attempts per 15 minutes)
