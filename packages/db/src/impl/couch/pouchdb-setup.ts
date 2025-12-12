import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import PouchDBAuth from '@nilock2/pouchdb-authentication';

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
