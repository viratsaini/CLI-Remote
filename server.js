'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');

const config = require('./src/config');
const authRoutes = require('./src/auth/routes');
const sessionsRouter = require('./src/api/sessions');
const commandsRouter = require('./src/api/commands');
const statusRouter = require('./src/api/status');
const sessionManager = require('./src/services/sessionManager');
const WSHandler = require('./src/ws/handler');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'cdn.jsdelivr.net', 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      imgSrc: ["'self'", 'data:'],
      workerSrc: ["'self'", 'blob:'],
    },
  },
}));

app.use(cors({
  origin: config.allowedOrigins.length === 1 && config.allowedOrigins[0] === '*'
    ? '*'
    : (origin, cb) => {
        if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('CORS: Origin not allowed'));
      },
  credentials: true,
}));

// General rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionsRouter);
app.use('/api/commands', commandsRouter);
app.use('/api/status', statusRouter);

// Fallback: serve index.html for unknown routes (SPA)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// HTTP server
const server = http.createServer(app);

// WebSocket server
const wsHandler = new WSHandler(sessionManager);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => wsHandler.handleConnection(ws, req));

// Startup
server.listen(config.port, config.host, () => {
  console.log(`\n🚀 Copilot CLI Remote started`);
  console.log(`   Local: http://localhost:${config.port}`);

  // Print all local IPs for mobile access
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   Network: http://${iface.address}:${config.port}  ← use this on mobile`);
      }
    }
  }
  console.log(`   Environment: ${config.nodeEnv}\n`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n[server] ${signal} received. Shutting down...`);
  sessionManager.closeAllSessions();
  wss.close();
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server };
