'use strict';

const express = require('express');
const { authenticateToken } = require('../auth/middleware');
const sessionManager = require('../services/sessionManager');

const router = express.Router();
router.use(authenticateToken);

// GET /api/sessions
router.get('/', (req, res) => {
  const sessions = sessionManager.getUserSessions(req.user.id);
  res.json(sessions.map(s => sessionManager.serializeSession(s)));
});

// POST /api/sessions
router.post('/', (req, res) => {
  const { name, cols, rows, shell } = req.body || {};
  try {
    const session = sessionManager.createSession(req.user.id, {
      name,
      cols: cols ? parseInt(cols, 10) : 80,
      rows: rows ? parseInt(rows, 10) : 24,
      shell,
    });
    res.status(201).json(sessionManager.serializeSession(session));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(sessionManager.serializeSession(session));
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  sessionManager.closeSession(req.params.id);
  res.json({ message: 'Session closed' });
});

// POST /api/sessions/:id/resize
router.post('/:id/resize', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const cols = parseInt(req.body.cols, 10) || 80;
  const rows = parseInt(req.body.rows, 10) || 24;
  session.terminal.resize(cols, rows);
  session.cols = cols;
  session.rows = rows;
  session.lastActivity = new Date();
  res.json({ message: 'Resized', cols, rows });
});

// POST /api/sessions/:id/input
router.post('/:id/input', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No data provided' });
  session.terminal.write(data);
  session.lastActivity = new Date();
  res.json({ message: 'Input sent' });
});

module.exports = router;
