'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { authenticateToken, addToBlacklist } = require('./middleware');

const router = express.Router();

// Hash admin password on startup
let hashedAdminPassword = null;
(async () => {
  hashedAdminPassword = await bcrypt.hash(config.adminPassword, config.bcryptRounds);
})();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username !== config.adminUsername) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Wait for hash to be ready
  if (!hashedAdminPassword) {
    hashedAdminPassword = await bcrypt.hash(config.adminPassword, config.bcryptRounds);
  }
  const valid = await bcrypt.compare(password, hashedAdminPassword);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = { id: uuidv4(), username };
  const token = generateToken(user);
  res.json({
    token,
    user: { username: user.username, id: user.id },
    expiresIn: config.jwtExpiresIn,
  });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  addToBlacklist(req.token);
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', authenticateToken, (req, res) => {
  addToBlacklist(req.token);
  const user = { id: req.user.id, username: req.user.username };
  const token = generateToken(user);
  res.json({
    token,
    user: { username: user.username, id: user.id },
    expiresIn: config.jwtExpiresIn,
  });
});

// GET /api/auth/verify
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: { username: req.user.username, id: req.user.id } });
});

module.exports = router;
