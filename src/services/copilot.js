'use strict';

const { execFile } = require('child_process');
const config = require('../config');

function runCommand(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parts = cmd.split(' ');
    const bin = parts[0];
    const baseArgs = parts.slice(1).concat(args);
    execFile(bin, baseArgs, { timeout: timeoutMs, env: process.env }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function detectCopilot() {
  try {
    const { stdout } = await runCommand('gh', ['copilot', '--version'], 5000);
    return { installed: true, version: stdout.trim(), command: config.copilotCommand };
  } catch (_) {
    try {
      await runCommand('gh', ['--version'], 3000);
      return { installed: false, version: null, command: config.copilotCommand, note: 'gh CLI found but copilot extension not installed' };
    } catch (__) {
      return { installed: false, version: null, command: config.copilotCommand, note: 'gh CLI not found' };
    }
  }
}

async function explainCommand(command) {
  if (!command || typeof command !== 'string') {
    return 'No command provided';
  }
  try {
    const { stdout, stderr } = await runCommand('gh', ['copilot', 'explain', command], 20000);
    return (stdout + stderr).trim() || 'No explanation available';
  } catch (err) {
    if (err.code === 'ENOENT') return 'gh CLI not found. Please install GitHub CLI.';
    return `Error: ${err.message || 'Failed to get explanation'}`;
  }
}

async function suggestCommand(description) {
  if (!description || typeof description !== 'string') {
    return 'No description provided';
  }
  try {
    const { stdout, stderr } = await runCommand('gh', ['copilot', 'suggest', description], 20000);
    return (stdout + stderr).trim() || 'No suggestion available';
  } catch (err) {
    if (err.code === 'ENOENT') return 'gh CLI not found. Please install GitHub CLI.';
    return `Error: ${err.message || 'Failed to get suggestion'}`;
  }
}

module.exports = { detectCopilot, explainCommand, suggestCommand };
