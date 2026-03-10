'use strict';

const express = require('express');
const os = require('os');
const { authenticateToken } = require('../auth/middleware');
const sessionManager = require('../services/sessionManager');
const { detectCopilot } = require('../services/copilot');
const { version } = require('../../package.json');

const router = express.Router();

// GET /api/status
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// GET /api/status/detailed
router.get('/detailed', authenticateToken, async (req, res) => {
  const copilotInfo = await detectCopilot();
  res.json({
    status: 'ok',
    version,
    activeSessions: sessionManager.activeSessions,
    systemInfo: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
    },
    copilotAvailable: copilotInfo.installed,
    copilot: copilotInfo,
  });
});

module.exports = router;
