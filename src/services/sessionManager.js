'use strict';

const { v4: uuidv4 } = require('uuid');
const { Terminal } = require('./terminal');
const config = require('../config');

class SessionManager {
  constructor() {
    this._sessions = new Map();
    // Cleanup expired sessions on a configurable interval
    this._cleanupInterval = setInterval(() => this.cleanupExpired(), config.cleanupIntervalMs);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  createSession(userId, options = {}) {
    if (this._sessions.size >= config.maxSessions) {
      throw new Error(`Maximum session limit (${config.maxSessions}) reached`);
    }
    const id = uuidv4();
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const terminal = new Terminal(id, cols, rows, options.shell || null, options.env || {});

    const session = {
      id,
      userId,
      terminal,
      createdAt: new Date(),
      lastActivity: new Date(),
      name: options.name || `Session ${this._sessions.size + 1}`,
      cols,
      rows,
    };

    terminal.onExit(() => {
      const s = this._sessions.get(id);
      if (s) s.exitedAt = new Date();
    });

    this._sessions.set(id, session);
    return session;
  }

  getSession(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  getUserSessions(userId) {
    const result = [];
    for (const session of this._sessions.values()) {
      if (session.userId === userId) result.push(session);
    }
    return result;
  }

  closeSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return false;
    try { session.terminal.kill(); } catch (_) {}
    this._sessions.delete(sessionId);
    return true;
  }

  closeAllSessions() {
    for (const session of this._sessions.values()) {
      try { session.terminal.kill(); } catch (_) {}
    }
    this._sessions.clear();
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of this._sessions.entries()) {
      const idle = now - session.lastActivity.getTime();
      if (idle > config.sessionTimeout || !session.terminal.isAlive) {
        try { session.terminal.kill(); } catch (_) {}
        this._sessions.delete(id);
      }
    }
  }

  get activeSessions() {
    return this._sessions.size;
  }

  serializeSession(session) {
    return {
      id: session.id,
      userId: session.userId,
      name: session.name,
      cols: session.cols,
      rows: session.rows,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      alive: session.terminal.isAlive,
      pid: session.terminal.pid,
    };
  }
}

module.exports = new SessionManager();
