/* public/js/api.js */
(function () {
  'use strict';

  class APIClient {
    constructor() {
      this._base = '';
    }

    async request(method, path, body) {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const token = window.auth ? window.auth.getToken() : null;
      if (token) opts.headers['Authorization'] = `Bearer ${token}`;
      if (body !== undefined) opts.body = JSON.stringify(body);

      const res = await fetch(this._base + path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
      return data;
    }

    // Sessions
    getSessions() { return this.request('GET', '/api/sessions'); }
    createSession(opts) { return this.request('POST', '/api/sessions', opts || {}); }
    closeSession(id) { return this.request('DELETE', `/api/sessions/${id}`); }
    resizeSession(id, cols, rows) { return this.request('POST', `/api/sessions/${id}/resize`, { cols, rows }); }
    sendInput(id, data) { return this.request('POST', `/api/sessions/${id}/input`, { data }); }
    getSession(id) { return this.request('GET', `/api/sessions/${id}`); }

    // Status
    getStatus() { return this.request('GET', '/api/status'); }
    getDetailedStatus() { return this.request('GET', '/api/status/detailed'); }

    // Commands
    executeCommand(sessionId, command) { return this.request('POST', '/api/commands/execute', { sessionId, command }); }
    explainCommand(command) { return this.request('POST', '/api/commands/explain', { command }); }
    suggestCommand(description) { return this.request('GET', `/api/commands/suggestions?q=${encodeURIComponent(description)}`); }
    getHistory() { return this.request('GET', '/api/commands/history'); }
  }

  window.APIClient = APIClient;
  window.api = new APIClient();
})();
