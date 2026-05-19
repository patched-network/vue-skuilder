// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Capture browser console output and forward it to the Cypress runner
// terminal (via the `log` task in cypress.config.js). Critical for CI
// debugging where browser console is otherwise invisible.
const browserLogs = [];

const stringify = (a) => {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
};

Cypress.on('window:before:load', (win) => {
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const original = win.console[level];
    win.console[level] = (...args) => {
      browserLogs.push({ level, text: args.map(stringify).join(' ') });
      original.apply(win.console, args);
    };
  });
  win.addEventListener('error', (e) => {
    browserLogs.push({ level: 'error', text: `window error: ${e.message} @ ${e.filename}:${e.lineno}` });
  });
  win.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    browserLogs.push({
      level: 'error',
      text: `unhandledrejection: ${(r && (r.stack || r.message)) || String(r)}`,
    });
  });
});

afterEach(() => {
  if (browserLogs.length) {
    cy.task('log', browserLogs.splice(0), { log: false });
  }
});
