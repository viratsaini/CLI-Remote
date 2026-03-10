/* public/js/ws.js */
(function () {
  'use strict';

  const MAX_RECONNECT_DELAY = 30000;

  class WSClient extends EventTarget {
    constructor() {
      super();
      this._ws = null;
      this._authenticated = false;
      this._reconnectDelay = 1000;
      this._reconnectTimer = null;
      this._shouldReconnect = true;
      this._connectingManually = false;
    }

    get isConnected() {
      return this._ws !== null && this._ws.readyState === WebSocket.OPEN && this._authenticated;
    }

    connect() {
      this._shouldReconnect = true;
      this._connectingManually = true;
      this._doConnect();
    }

    disconnect() {
      this._shouldReconnect = false;
      clearTimeout(this._reconnectTimer);
      if (this._ws) {
        this._ws.close();
        this._ws = null;
      }
      this._authenticated = false;
    }

    _doConnect() {
      if (this._ws && this._ws.readyState < WebSocket.CLOSING) {
        this._ws.close();
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      this._ws = new WebSocket(url);

      this._ws.addEventListener('open', () => {
        this._reconnectDelay = 1000;
        // Authenticate immediately
        const token = window.auth ? window.auth.getToken() : null;
        if (token) {
          this._ws.send(JSON.stringify({ type: 'auth', token }));
        }
        this.dispatchEvent(new CustomEvent('connecting'));
      });

      this._ws.addEventListener('message', (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch (_) { return; }
        this._handleMessage(msg);
      });

      this._ws.addEventListener('close', () => {
        const wasAuth = this._authenticated;
        this._authenticated = false;
        this.dispatchEvent(new CustomEvent('disconnected'));
        if (this._shouldReconnect) {
          this._reconnect();
        }
      });

      this._ws.addEventListener('error', () => {
        this.dispatchEvent(new CustomEvent('error', { detail: { message: 'WebSocket error' } }));
      });
    }

    _handleMessage(msg) {
      switch (msg.type) {
        case 'connected':
          // server connected, wait for auth_success
          break;
        case 'auth_success':
          this._authenticated = true;
          this.dispatchEvent(new CustomEvent('connected', { detail: { user: msg.user } }));
          break;
        case 'output':
          this.dispatchEvent(new CustomEvent('output', { detail: { sessionId: msg.sessionId, data: msg.data } }));
          break;
        case 'session_created':
          this.dispatchEvent(new CustomEvent('session_created', { detail: { session: msg.session } }));
          break;
        case 'session_closed':
          this.dispatchEvent(new CustomEvent('session_closed', { detail: { sessionId: msg.sessionId, exitCode: msg.exitCode } }));
          break;
        case 'subscribed':
          this.dispatchEvent(new CustomEvent('subscribed', { detail: { sessionId: msg.sessionId } }));
          break;
        case 'error':
          this.dispatchEvent(new CustomEvent('ws_error', { detail: { message: msg.message } }));
          break;
      }
    }

    _reconnect() {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => {
        this._doConnect();
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, MAX_RECONNECT_DELAY);
      }, this._reconnectDelay);
    }

    _send(obj) {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify(obj));
        return true;
      }
      return false;
    }

    subscribe(sessionId) { return this._send({ type: 'subscribe', sessionId }); }
    sendInput(sessionId, data) { return this._send({ type: 'input', sessionId, data }); }
    resize(sessionId, cols, rows) { return this._send({ type: 'resize', sessionId, cols, rows }); }
    createSession(name, cols, rows, shell) { return this._send({ type: 'create_session', name, cols, rows, shell }); }
    closeSession(sessionId) { return this._send({ type: 'close_session', sessionId }); }
  }

  window.WSClient = WSClient;
  window.wsClient = new WSClient();
})();
