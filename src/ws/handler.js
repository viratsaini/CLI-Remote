'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const sessionManager = require('../services/sessionManager');
const { isBlacklisted } = require('../auth/middleware');

class WSHandler {
  constructor(sessionMgr) {
    this._sessionManager = sessionMgr;
    // Map: ws -> { user, sessionSubscriptions: Set<sessionId> }
    this._clients = new Map();
  }

  handleConnection(ws, req) {
    // sessionSubscriptions: Map<sessionId, { dataHandler, exitHandler }>
    const clientState = { user: null, sessionSubscriptions: new Map(), authenticated: false };
    this._clients.set(ws, clientState);

    this._send(ws, { type: 'connected', message: 'Send auth message to authenticate' });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        return this._send(ws, { type: 'error', message: 'Invalid JSON' });
      }
      this._handleMessage(ws, clientState, msg);
    });

    ws.on('close', () => {
      this._cleanupClient(ws, clientState);
      this._clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[ws] Client error:', err.message);
    });
  }

  _handleMessage(ws, state, msg) {
    if (msg.type === 'auth') {
      return this._handleAuth(ws, state, msg);
    }
    if (!state.authenticated) {
      return this._send(ws, { type: 'error', message: 'Not authenticated' });
    }
    switch (msg.type) {
      case 'subscribe':
        return this._handleSubscribe(ws, state, msg);
      case 'input':
        return this._handleInput(ws, state, msg);
      case 'resize':
        return this._handleResize(ws, state, msg);
      case 'create_session':
        return this._handleCreateSession(ws, state, msg);
      case 'close_session':
        return this._handleCloseSession(ws, state, msg);
      default:
        return this._send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
    }
  }

  _handleAuth(ws, state, msg) {
    const token = msg.token;
    if (!token) return this._send(ws, { type: 'error', message: 'Token required' });
    if (isBlacklisted(token)) return this._send(ws, { type: 'error', message: 'Token revoked' });
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      state.user = decoded;
      state.authenticated = true;
      this._send(ws, { type: 'auth_success', user: { username: decoded.username, id: decoded.id } });
    } catch (err) {
      this._send(ws, { type: 'error', message: 'Invalid or expired token' });
    }
  }

  _handleSubscribe(ws, state, msg) {
    const { sessionId } = msg;
    const session = this._sessionManager.getSession(sessionId);
    if (!session || session.userId !== state.user.id) {
      return this._send(ws, { type: 'error', message: 'Session not found' });
    }
    // Only attach terminal listeners once per (ws, sessionId) pair
    if (!state.sessionSubscriptions.has(sessionId)) {
      const dataHandler = (data) => {
        if (ws.readyState === ws.OPEN) {
          this._send(ws, { type: 'output', sessionId, data });
        }
      };
      const exitHandler = (code) => {
        if (ws.readyState === ws.OPEN) {
          this._send(ws, { type: 'session_closed', sessionId, exitCode: code });
        }
        state.sessionSubscriptions.delete(sessionId);
      };

      session.terminal.onData(dataHandler);
      session.terminal.onExit(exitHandler);
      state.sessionSubscriptions.set(sessionId, { dataHandler, exitHandler, terminal: session.terminal });
    }
    this._send(ws, { type: 'subscribed', sessionId });
  }

  _handleInput(ws, state, msg) {
    const { sessionId, data } = msg;
    const session = this._sessionManager.getSession(sessionId);
    if (!session || session.userId !== state.user.id) {
      return this._send(ws, { type: 'error', message: 'Session not found' });
    }
    session.terminal.write(data);
    session.lastActivity = new Date();
  }

  _handleResize(ws, state, msg) {
    const { sessionId, cols, rows } = msg;
    const session = this._sessionManager.getSession(sessionId);
    if (!session || session.userId !== state.user.id) {
      return this._send(ws, { type: 'error', message: 'Session not found' });
    }
    session.terminal.resize(parseInt(cols, 10) || 80, parseInt(rows, 10) || 24);
    session.cols = parseInt(cols, 10) || 80;
    session.rows = parseInt(rows, 10) || 24;
  }

  _handleCreateSession(ws, state, msg) {
    const { name, cols, rows, shell } = msg;
    try {
      const session = this._sessionManager.createSession(state.user.id, {
        name,
        cols: parseInt(cols, 10) || 80,
        rows: parseInt(rows, 10) || 24,
        shell,
      });
      const serialized = this._sessionManager.serializeSession(session);
      this._send(ws, { type: 'session_created', session: serialized });
      // Auto-subscribe
      this._handleSubscribe(ws, state, { sessionId: session.id });
    } catch (err) {
      this._send(ws, { type: 'error', message: err.message });
    }
  }

  _handleCloseSession(ws, state, msg) {
    const { sessionId } = msg;
    const session = this._sessionManager.getSession(sessionId);
    if (!session || session.userId !== state.user.id) {
      return this._send(ws, { type: 'error', message: 'Session not found' });
    }
    const handlers = state.sessionSubscriptions.get(sessionId);
    if (handlers) {
      try {
        handlers.terminal.offData(handlers.dataHandler);
        handlers.terminal.offExit(handlers.exitHandler);
      } catch (_) {}
      state.sessionSubscriptions.delete(sessionId);
    }
    this._sessionManager.closeSession(sessionId);
    this._send(ws, { type: 'session_closed', sessionId });
  }

  _cleanupClient(ws, state) {
    // Remove all terminal data/exit listeners attached by this WS client
    for (const [sessionId, handlers] of state.sessionSubscriptions) {
      try {
        handlers.terminal.offData(handlers.dataHandler);
        handlers.terminal.offExit(handlers.exitHandler);
      } catch (_) {}
    }
    state.sessionSubscriptions.clear();
  }

  _send(ws, obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }
}

module.exports = WSHandler;
