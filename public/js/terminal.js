/* public/js/terminal.js */
(function () {
  'use strict';

  const XTERM_THEME = {
    background: '#0d1117',
    foreground: '#e6edf3',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    black: '#484f58',
    red: '#f85149',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ff7b72',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc',
    selectionBackground: 'rgba(88,166,255,0.3)',
  };

  class TerminalManager {
    constructor() {
      this._terminals = new Map(); // sessionId -> { term, fitAddon, container, wsClient }
    }

    createTerminal(sessionId, container, sessionName, wsClient) {
      if (this._terminals.has(sessionId)) {
        return this._terminals.get(sessionId);
      }
      const term = new Terminal({
        theme: XTERM_THEME,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace",
        fontSize: 13,
        lineHeight: 1.3,
        letterSpacing: 0,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        allowTransparency: false,
        convertEol: false,
        disableStdin: false,
        macOptionIsMeta: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon.FitAddon();
      const webLinksAddon = new WebLinksAddon.WebLinksAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      term.open(container);

      // Fit after a short delay to allow layout
      setTimeout(() => {
        try { fitAddon.fit(); } catch (_) {}
      }, 50);

      // Handle terminal input
      term.onData((data) => {
        if (wsClient) wsClient.sendInput(sessionId, data);
      });

      // Handle resize
      term.onResize(({ cols, rows }) => {
        if (wsClient) wsClient.resize(sessionId, cols, rows);
      });

      const entry = { term, fitAddon, container, sessionName };
      this._terminals.set(sessionId, entry);
      return entry;
    }

    writeToTerminal(sessionId, data) {
      const entry = this._terminals.get(sessionId);
      if (entry) entry.term.write(data);
    }

    focusTerminal(sessionId) {
      const entry = this._terminals.get(sessionId);
      if (entry) {
        setTimeout(() => {
          try { entry.fitAddon.fit(); } catch (_) {}
          entry.term.focus();
        }, 50);
      }
    }

    closeTerminal(sessionId) {
      const entry = this._terminals.get(sessionId);
      if (entry) {
        try { entry.term.dispose(); } catch (_) {}
        this._terminals.delete(sessionId);
      }
    }

    resizeTerminal(sessionId) {
      const entry = this._terminals.get(sessionId);
      if (entry) {
        try { entry.fitAddon.fit(); } catch (_) {}
      }
    }

    resizeAll() {
      for (const [, entry] of this._terminals) {
        try { entry.fitAddon.fit(); } catch (_) {}
      }
    }

    getTerminal(sessionId) {
      return this._terminals.get(sessionId) || null;
    }

    get size() { return this._terminals.size; }
  }

  window.TerminalManager = TerminalManager;
  window.terminalManager = new TerminalManager();
})();
