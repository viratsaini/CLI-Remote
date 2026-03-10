/* public/js/auth.js */
(function () {
  'use strict';

  const TOKEN_KEY = 'copilot_remote_token';
  const USER_KEY = 'copilot_remote_user';

  function decodeJwtPayload(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
      return JSON.parse(atob(padded));
    } catch (_) {
      return null;
    }
  }

  class AuthManager {
    constructor() {
      this._token = localStorage.getItem(TOKEN_KEY) || null;
      this._user = null;
      if (this._token) {
        this._user = decodeJwtPayload(this._token);
      }
    }

    async login(username, password) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      this._token = data.token;
      this._user = decodeJwtPayload(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data;
    }

    async logout() {
      if (this._token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this._token}` },
          });
        } catch (_) {}
      }
      this._token = null;
      this._user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    isAuthenticated() {
      if (!this._token) return false;
      const payload = decodeJwtPayload(this._token);
      if (!payload || !payload.exp) return false;
      return Date.now() / 1000 < payload.exp;
    }

    getToken() {
      return this._token;
    }

    getUser() {
      if (this._user) return this._user;
      if (this._token) {
        this._user = decodeJwtPayload(this._token);
        return this._user;
      }
      return null;
    }

    requireAuth() {
      if (!this.isAuthenticated()) {
        window.location.replace('/login.html');
        return false;
      }
      return true;
    }

    async refresh() {
      if (!this._token) throw new Error('No token to refresh');
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this._token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');
      this._token = data.token;
      this._user = decodeJwtPayload(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      return data;
    }
  }

  window.AuthManager = AuthManager;
  window.auth = new AuthManager();
})();
