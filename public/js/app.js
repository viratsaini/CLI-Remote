/* public/js/app.js */
(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let activeSessionId = null;
  const sessionMeta = new Map(); // sessionId -> { name, alive }

  // ─── DOM refs ─────────────────────────────────────────────────────────────
  const els = {};
  function q(id) { return document.getElementById(id); }

  // ─── Toast system ─────────────────────────────────────────────────────────
  function toast(msg, type = 'info', durationMs = 3000) {
    const container = q('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-fade');
      el.addEventListener('animationend', () => el.remove());
    }, durationMs);
  }

  // ─── Status dot ───────────────────────────────────────────────────────────
  function setStatus(state) {
    const dot = q('status-dot');
    if (!dot) return;
    dot.className = 'status-dot ' + state;
    const map = { connected: 'Connected', disconnected: 'Disconnected', connecting: 'Connecting…', error: 'Error' };
    dot.title = map[state] || state;
  }

  // ─── Session list (sidebar) ────────────────────────────────────────────────
  function renderSessionList() {
    const list = q('session-list');
    const emptyEl = q('session-empty');
    if (!list) return;

    // Remove old items (keep empty placeholder)
    list.querySelectorAll('.session-item').forEach(el => el.remove());

    if (sessionMeta.size === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    for (const [id, meta] of sessionMeta) {
      const item = document.createElement('div');
      item.className = 'session-item' + (id === activeSessionId ? ' active' : '') + (!meta.alive ? ' session-dead' : '');
      item.dataset.sessionId = id;

      item.innerHTML = `
        <span class="session-item-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
        </span>
        <span class="session-item-name">${escHtml(meta.name)}</span>
        <button class="session-item-close" title="Close session" data-session-id="${id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.session-item-close')) return;
        activateSession(id);
        closeSidebar();
      });
      item.querySelector('.session-item-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeSession(id);
      });
      list.appendChild(item);
    }
  }

  // ─── Tab bar ──────────────────────────────────────────────────────────────
  function renderTabs() {
    const bar = q('tab-bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const [id, meta] of sessionMeta) {
      const tab = document.createElement('div');
      tab.className = 'tab' + (id === activeSessionId ? ' active' : '') + (!meta.alive ? ' dead' : '');
      tab.dataset.sessionId = id;
      tab.innerHTML = `
        <span class="tab-name">${escHtml(meta.name)}</span>
        <button class="tab-close" title="Close" data-session-id="${id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close')) return;
        activateSession(id);
      });
      tab.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeSession(id);
      });
      bar.appendChild(tab);
    }
  }

  // ─── Terminal wrappers ────────────────────────────────────────────────────
  function ensureTerminalWrapper(sessionId, sessionName) {
    const area = q('terminal-area');
    let wrapper = area.querySelector(`[data-session-id="${sessionId}"]`);
    if (!wrapper) {
      const welcome = q('terminal-welcome');
      if (welcome) welcome.style.display = 'none';

      wrapper = document.createElement('div');
      wrapper.className = 'terminal-wrapper';
      wrapper.dataset.sessionId = sessionId;
      area.appendChild(wrapper);

      window.terminalManager.createTerminal(sessionId, wrapper, sessionName, window.wsClient);
      window.wsClient.subscribe(sessionId);
    }
    return wrapper;
  }

  function activateSession(sessionId) {
    activeSessionId = sessionId;

    // Hide all wrappers
    document.querySelectorAll('.terminal-wrapper').forEach(w => w.classList.remove('active'));
    // Show target
    const wrapper = document.querySelector(`.terminal-wrapper[data-session-id="${sessionId}"]`);
    if (wrapper) wrapper.classList.add('active');

    renderTabs();
    renderSessionList();
    window.terminalManager.focusTerminal(sessionId);
  }

  function addSession(session) {
    sessionMeta.set(session.id, { name: session.name, alive: session.alive !== false });
    ensureTerminalWrapper(session.id, session.name);
    activateSession(session.id);
    renderTabs();
    renderSessionList();
  }

  function closeSession(sessionId) {
    // Ask server to close
    window.wsClient.closeSession(sessionId);
    window.api.closeSession(sessionId).catch(() => {});
    _removeSession(sessionId);
  }

  function _removeSession(sessionId) {
    sessionMeta.delete(sessionId);
    window.terminalManager.closeTerminal(sessionId);
    const wrapper = document.querySelector(`.terminal-wrapper[data-session-id="${sessionId}"]`);
    if (wrapper) wrapper.remove();

    if (activeSessionId === sessionId) {
      activeSessionId = null;
      const remaining = [...sessionMeta.keys()];
      if (remaining.length > 0) {
        activateSession(remaining[remaining.length - 1]);
      } else {
        const welcome = q('terminal-welcome');
        if (welcome) welcome.style.display = 'flex';
      }
    }
    renderTabs();
    renderSessionList();
  }

  // ─── Sidebar toggle ───────────────────────────────────────────────────────
  function openSidebar() {
    const sb = q('sidebar');
    const ov = q('sidebar-overlay');
    if (sb) sb.classList.add('open');
    if (ov) ov.classList.add('visible');
  }
  function closeSidebar() {
    const sb = q('sidebar');
    const ov = q('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('visible');
  }

  // ─── New session modal ────────────────────────────────────────────────────
  function openNewSessionModal() {
    const modal = q('new-session-modal');
    if (modal) modal.style.display = 'flex';
    setTimeout(() => { const n = q('session-name'); if (n) n.focus(); }, 100);
  }
  function closeNewSessionModal() {
    const modal = q('new-session-modal');
    if (modal) modal.style.display = 'none';
  }

  async function createNewSession() {
    const name = (q('session-name').value || '').trim() || undefined;
    const cols = parseInt(q('session-cols').value, 10) || 80;
    const rows = parseInt(q('session-rows').value, 10) || 24;
    const shell = (q('session-shell').value || '').trim() || undefined;
    closeNewSessionModal();
    try {
      // Use WS to create session (auto-subscribes)
      window.wsClient.createSession(name || 'Terminal', cols, rows, shell);
    } catch (err) {
      toast('Failed to create session: ' + err.message, 'error');
    }
  }

  // ─── Suggestions panel ────────────────────────────────────────────────────
  function openSuggestions() {
    const panel = q('suggestions-panel');
    if (panel) panel.classList.add('open');
    setTimeout(() => { const i = q('suggestions-input'); if (i) i.focus(); }, 100);
  }
  function closeSuggestions() {
    const panel = q('suggestions-panel');
    if (panel) panel.classList.remove('open');
  }

  async function fetchSuggestions() {
    const input = q('suggestions-input');
    const resultEl = q('suggestions-result');
    const query = input ? input.value.trim() : '';
    if (!query) return;
    if (resultEl) resultEl.innerHTML = '<p class="suggestions-hint">Asking Copilot…</p>';
    try {
      const data = await window.api.suggestCommand(query);
      if (resultEl) {
        const text = data.suggestion || 'No suggestion available';
        resultEl.innerHTML = `
          <div class="suggestion-block">
            <pre>${escHtml(text)}</pre>
            <button class="btn btn-sm btn-primary suggestion-use-btn" data-cmd="${escAttr(text)}">Use in terminal</button>
          </div>`;
        resultEl.querySelector('.suggestion-use-btn').addEventListener('click', (e) => {
          const cmd = e.currentTarget.dataset.cmd;
          if (activeSessionId) {
            window.wsClient.sendInput(activeSessionId, cmd);
          }
          closeSuggestions();
        });
      }
    } catch (err) {
      if (resultEl) resultEl.innerHTML = `<p class="suggestions-hint" style="color:var(--danger)">${escHtml(err.message)}</p>`;
    }
  }

  // ─── Fullscreen ───────────────────────────────────────────────────────────
  let isFullscreen = false;
  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    document.body.classList.toggle('fullscreen', isFullscreen);
    setTimeout(() => window.terminalManager.resizeAll(), 100);
    const btn = q('fullscreen-btn');
    if (btn) btn.classList.toggle('active', isFullscreen);
  }

  // ─── Quick input / send ───────────────────────────────────────────────────
  function sendQuickInput() {
    const input = q('quick-input');
    if (!input || !activeSessionId) return;
    const val = input.value;
    if (!val) return;
    window.wsClient.sendInput(activeSessionId, val + '\n');
    input.value = '';
  }

  // ─── User menu ────────────────────────────────────────────────────────────
  function toggleUserMenu() {
    const dropdown = q('user-dropdown');
    if (!dropdown) return;
    const visible = dropdown.style.display !== 'none';
    dropdown.style.display = visible ? 'none' : 'block';
  }

  // ─── Helper functions ─────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(str) { return escHtml(str); }

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard
    if (!window.auth.requireAuth()) return;

    // Set user info
    const user = window.auth.getUser();
    const userInfoEl = q('user-info-text');
    if (userInfoEl && user) userInfoEl.textContent = `Signed in as ${user.username}`;

    // Wire up UI
    q('sidebar-toggle').addEventListener('click', openSidebar);
    q('sidebar-overlay').addEventListener('click', closeSidebar);
    q('new-session-btn').addEventListener('click', () => { openNewSessionModal(); closeSidebar(); });
    q('modal-close-btn').addEventListener('click', closeNewSessionModal);
    q('modal-cancel-btn').addEventListener('click', closeNewSessionModal);
    q('modal-create-btn').addEventListener('click', createNewSession);
    q('new-session-modal').addEventListener('click', (e) => { if (e.target === q('new-session-modal')) closeNewSessionModal(); });

    // New session modal: Enter key
    q('new-session-modal').querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') createNewSession(); });
    });

    q('logout-btn').addEventListener('click', async () => {
      await window.auth.logout();
      window.location.replace('/login.html');
    });
    q('user-menu-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleUserMenu(); });
    document.addEventListener('click', (e) => {
      const dd = q('user-dropdown');
      if (dd && !dd.contains(e.target) && e.target !== q('user-menu-btn')) {
        dd.style.display = 'none';
      }
    });

    q('suggestions-btn').addEventListener('click', openSuggestions);
    q('suggestions-close').addEventListener('click', closeSuggestions);
    q('suggestions-search-btn').addEventListener('click', fetchSuggestions);
    q('suggestions-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchSuggestions(); });

    q('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isFullscreen) toggleFullscreen(); });

    q('send-btn').addEventListener('click', sendQuickInput);
    q('quick-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendQuickInput(); });

    q('keyboard-toggle-btn').addEventListener('click', () => {
      // Focus the active terminal to trigger mobile keyboard
      if (activeSessionId) {
        const entry = window.terminalManager.getTerminal(activeSessionId);
        if (entry) entry.term.focus();
      }
    });

    // Window resize → fit all terminals
    window.addEventListener('resize', () => {
      clearTimeout(window._resizeTimer);
      window._resizeTimer = setTimeout(() => window.terminalManager.resizeAll(), 150);
    });

    // WebSocket events
    window.wsClient.addEventListener('connected', (e) => {
      setStatus('connected');
      toast('Connected', 'success', 2000);
      // Re-subscribe to all existing sessions after reconnect
      for (const [id] of sessionMeta) {
        window.wsClient.subscribe(id);
      }
    });

    window.wsClient.addEventListener('disconnected', () => {
      setStatus('disconnected');
    });

    window.wsClient.addEventListener('connecting', () => {
      setStatus('connecting');
    });

    window.wsClient.addEventListener('output', (e) => {
      const { sessionId, data } = e.detail;
      window.terminalManager.writeToTerminal(sessionId, data);
    });

    window.wsClient.addEventListener('session_created', (e) => {
      const session = e.detail.session;
      addSession(session);
      toast(`Session "${session.name}" created`, 'success', 2000);
    });

    window.wsClient.addEventListener('session_closed', (e) => {
      const { sessionId } = e.detail;
      const meta = sessionMeta.get(sessionId);
      if (meta) {
        meta.alive = false;
        renderTabs();
        renderSessionList();
        // Write exit notice to terminal
        window.terminalManager.writeToTerminal(sessionId, '\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
      }
    });

    window.wsClient.addEventListener('ws_error', (e) => {
      console.warn('[ws] Error:', e.detail.message);
    });

    // Connect WebSocket
    setStatus('connecting');
    window.wsClient.connect();

    // Load existing sessions from API
    await loadExistingSessions();
  });

  async function loadExistingSessions() {
    try {
      const sessions = await window.api.getSessions();
      for (const session of sessions) {
        if (!sessionMeta.has(session.id) && session.alive) {
          sessionMeta.set(session.id, { name: session.name, alive: session.alive });
          ensureTerminalWrapper(session.id, session.name);
        }
      }
      if (sessionMeta.size > 0 && !activeSessionId) {
        const firstId = [...sessionMeta.keys()][0];
        activateSession(firstId);
      }
      renderTabs();
      renderSessionList();
    } catch (err) {
      console.warn('[app] Failed to load sessions:', err.message);
    }
  }

})();
