import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import PouchDBAuth from '@nilock2/pouchdb-authentication';
import process from 'process';

// PouchDB expects a global `process` in browsers (#18). Set here, beside the
// plugin registration, so every path to PouchDB gets it. (This module is in
// package.json's "sideEffects".)
if (typeof window !== 'undefined') {
  (window as unknown as { process: unknown }).process = process;
}

// Register plugins
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAuth);

// Disable PouchDB debug logging to prevent interference with CLI prompts
// Debug logging (like DerivedLogger.emit) will still go to the TUI log file
// if initializeTuiLogging() has been called, but won't clutter terminal output
if (typeof PouchDB.debug !== 'undefined') {
  PouchDB.debug.disable();
}

// Configure PouchDB globally
PouchDB.defaults({
  // ajax: {
  //   timeout: 60000,
  // },
});

export default PouchDB;
