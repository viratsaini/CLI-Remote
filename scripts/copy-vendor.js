'use strict';

/**
 * Copies pre-built xterm.js library files from node_modules into public/vendor
 * so they can be served locally (no CDN dependency required at runtime).
 *
 * This script runs automatically as an npm postinstall hook.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'public', 'vendor');

const files = [
  { src: path.join('xterm', 'lib', 'xterm.js'), dest: 'xterm.js' },
  { src: path.join('xterm', 'css', 'xterm.css'), dest: 'xterm.css' },
  { src: path.join('xterm-addon-fit', 'lib', 'xterm-addon-fit.js'), dest: 'xterm-addon-fit.js' },
  { src: path.join('xterm-addon-web-links', 'lib', 'xterm-addon-web-links.js'), dest: 'xterm-addon-web-links.js' },
];

try {
  if (!fs.existsSync(vendorDir)) {
    fs.mkdirSync(vendorDir, { recursive: true });
  }

  for (const { src, dest } of files) {
    const srcPath = path.join(root, 'node_modules', src);
    const destPath = path.join(vendorDir, dest);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      console.warn(`[copy-vendor] Warning: source not found: ${srcPath}`);
    }
  }

  console.log('[copy-vendor] xterm vendor files copied to public/vendor/');
} catch (err) {
  console.error('[copy-vendor] Failed to copy vendor files:', err.message);
  // Non-fatal – server will still start; browser may fall back to CDN if configured
}
