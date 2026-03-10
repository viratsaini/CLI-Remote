'use strict';

const express = require('express');
const { authenticateToken } = require('../auth/middleware');
const sessionManager = require('../services/sessionManager');
const { explainCommand, suggestCommand } = require('../services/copilot');

const router = express.Router();
router.use(authenticateToken);

// In-memory command history per user
const commandHistory = new Map();

function addToHistory(userId, command) {
  if (!commandHistory.has(userId)) commandHistory.set(userId, []);
  const history = commandHistory.get(userId);
  history.unshift({ command, timestamp: new Date() });
  if (history.length > 100) history.pop();
}

// POST /api/commands/execute
router.post('/execute', (req, res) => {
  const { sessionId, command } = req.body || {};
  if (!sessionId || !command) {
    return res.status(400).json({ error: 'sessionId and command required' });
  }
  const session = sessionManager.getSession(sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  session.terminal.write(command + '\n');
  session.lastActivity = new Date();
  addToHistory(req.user.id, command);
  res.json({ message: 'Command sent' });
});

// GET /api/commands/history
router.get('/history', (req, res) => {
  const history = commandHistory.get(req.user.id) || [];
  res.json({ history, note: 'In-memory history, cleared on server restart' });
});

// GET /api/commands/suggestions?q=description
router.get('/suggestions', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  const result = await suggestCommand(q);
  res.json({ suggestion: result });
});

// POST /api/commands/explain
router.post('/explain', async (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command is required' });
  const result = await explainCommand(command);
  res.json({ explanation: result });
});

module.exports = router;
