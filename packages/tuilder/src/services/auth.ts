import { getDataLayer, initializeDataLayer } from '@vue-skuilder/db';


export async function clearSession() {
  const db = getDataLayer();
  await db.getUserDB().logout();
}

export async function isLoggedIn(): Promise<boolean> {
  const db = getDataLayer();
  return db.getUserDB().isLoggedIn();
}

export async function initialize() {
    // TODO: get these from a config file
  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_SERVER_URL: 'localhost:5984',
      COUCHDB_SERVER_PROTOCOL: 'http',
    },
  });
}

export async function login(username: string, password: string): Promise<boolean> {
  const db = getDataLayer();
  const response = await db.getUserDB().login(username, password);
  return response.ok;
}

export async function signup(username: string, password: string): Promise<boolean> {
  const db = getDataLayer();
  const response = await db.getUserDB().createAccount(username, password);
  return response.status === 'ok';
}
