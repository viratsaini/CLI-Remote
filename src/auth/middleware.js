'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

// In-memory token blacklist (for logout)
const tokenBlacklist = new Set();

function addToBlacklist(token) {
  tokenBlacklist.add(token);
  // Parse expiration from JWT payload to clean up at the right time
  let ttl = 8 * 60 * 60 * 1000; // safe default
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (payload.exp) {
      ttl = Math.max(0, payload.exp * 1000 - Date.now()) + 60000; // +1 min buffer
    }
  } catch (_) {}
  setTimeout(() => tokenBlacklist.delete(token), ttl);
}

function isBlacklisted(token) {
  return tokenBlacklist.has(token);
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

function authenticateToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  if (isBlacklisted(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }
  if (isBlacklisted(token)) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    req.token = token;
  } catch (_) {
    // ignore invalid token in optional auth
  }
  next();
}

module.exports = { authenticateToken, optionalAuth, addToBlacklist, isBlacklisted };
