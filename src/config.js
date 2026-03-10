'use strict';

const { v4: uuidv4 } = require('uuid');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';
    if (!secret || secret === 'your-secret-here-change-in-production') {
      if (isProduction) {
        throw new Error('FATAL: JWT_SECRET must be explicitly set in production. Refusing to start.');
      }
      const generated = uuidv4();
      console.warn(
        '[config] WARNING: JWT_SECRET not set. Using auto-generated secret (sessions will be lost on restart). ' +
        'Set the JWT_SECRET environment variable to a long random string.'
      );
      return generated;
    }
    return secret;
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim()),
  maxSessions: parseInt(process.env.MAX_SESSIONS, 10) || 10,
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 1800000,
  copilotCommand: process.env.COPILOT_COMMAND || 'gh copilot',
  nodeEnv: process.env.NODE_ENV || 'development',
  get isProduction() {
    return this.nodeEnv === 'production';
  },
  cleanupIntervalMs: parseInt(process.env.SESSION_CLEANUP_INTERVAL, 10) || 5 * 60 * 1000,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme',
};

module.exports = config;
