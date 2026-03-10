'use strict';

let pty = null;
let PTY_AVAILABLE = false;

try {
  pty = require('node-pty');
  PTY_AVAILABLE = true;
} catch (_) {
  console.warn('[terminal] node-pty not available, falling back to child_process.spawn');
}

const { spawn } = require('child_process');
const os = require('os');

class Terminal {
  constructor(id, cols = 80, rows = 24, shell = null, env = {}) {
    this._id = id;
    this._cols = cols;
    this._rows = rows;
    this._dataCallbacks = [];
    this._exitCallbacks = [];
    this._alive = false;
    this._pid = null;

    const defaultShell = shell || (os.platform() === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/bash'));
    const mergedEnv = Object.assign({}, process.env, env, { TERM: 'xterm-256color', COLORTERM: 'truecolor' });

    if (PTY_AVAILABLE) {
      this._pty = pty.spawn(defaultShell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME || process.cwd(),
        env: mergedEnv,
      });
      this._alive = true;
      this._pid = this._pty.pid;
      this._pty.onData((data) => {
        this._dataCallbacks.forEach(cb => cb(data));
      });
      this._pty.onExit(({ exitCode }) => {
        this._alive = false;
        this._exitCallbacks.forEach(cb => cb(exitCode));
      });
    } else {
      // Fallback: spawn without PTY
      this._proc = spawn(defaultShell, [], {
        cwd: process.env.HOME || process.cwd(),
        env: mergedEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this._alive = true;
      this._pid = this._proc.pid;
      this._proc.stdout.on('data', (data) => {
        this._dataCallbacks.forEach(cb => cb(data.toString()));
      });
      this._proc.stderr.on('data', (data) => {
        this._dataCallbacks.forEach(cb => cb(data.toString()));
      });
      this._proc.on('exit', (code) => {
        this._alive = false;
        this._exitCallbacks.forEach(cb => cb(code));
      });
    }
  }

  write(data) {
    if (!this._alive) return;
    if (PTY_AVAILABLE) {
      this._pty.write(data);
    } else {
      try {
        this._proc.stdin.write(data);
      } catch (_) {}
    }
  }

  resize(cols, rows) {
    this._cols = cols;
    this._rows = rows;
    if (PTY_AVAILABLE && this._alive) {
      this._pty.resize(cols, rows);
    }
  }

  kill() {
    this._alive = false;
    if (PTY_AVAILABLE) {
      try { this._pty.kill(); } catch (_) {}
    } else {
      try { this._proc.kill(); } catch (_) {}
    }
  }

  onData(callback) {
    this._dataCallbacks.push(callback);
  }

  onExit(callback) {
    this._exitCallbacks.push(callback);
  }

  get id() { return this._id; }
  get pid() { return this._pid; }
  get isAlive() { return this._alive; }
  get cols() { return this._cols; }
  get rows() { return this._rows; }
}

module.exports = { Terminal, PTY_AVAILABLE };
