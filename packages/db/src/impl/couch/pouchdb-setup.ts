import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import PouchDBAuth from '@nilock2/pouchdb-authentication';

// Register plugins
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAuth);

// Configure PouchDB globally
PouchDB.defaults({
  // ajax: {
  //   timeout: 60000,
  // },
});

export default PouchDB;
