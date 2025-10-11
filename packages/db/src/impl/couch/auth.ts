import { ENV, NOT_SET } from '@db/factory';
import { logger } from '@db/util/logger';
import fetch from 'cross-fetch';

interface SessionResponse {
  info: unknown;
  ok: boolean;
  userCtx: {
    name: string;
    roles: string[];
  };
}

export async function getCurrentSession(): Promise<SessionResponse> {
  // Legacy XMLHttpRequest implementation
  // return new Promise((resolve, reject) => {
  //   const authXML = new XMLHttpRequest();
  //   authXML.withCredentials = true;
  //
  //   authXML.onerror = (e): void => {
  //     reject(new Error('Session check failed:', e));
  //   };
  //
  //   authXML.addEventListener('load', () => {
  //     try {
  //       const resp: SessionResponse = JSON.parse(authXML.responseText);
  //       resolve(resp);
  //     } catch (e) {
  //       reject(e);
  //     }
  //   });
  //
  //   const url = `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}_session`;
  //   authXML.open('GET', url);
  //   authXML.send();
  // });
  
  try {
    // Handle case where ENV variables might not be properly set
    if (ENV.COUCHDB_SERVER_URL === NOT_SET || ENV.COUCHDB_SERVER_PROTOCOL === NOT_SET) {
      throw new Error(`CouchDB server configuration not properly initialized. Protocol: "${ENV.COUCHDB_SERVER_PROTOCOL}", URL: "${ENV.COUCHDB_SERVER_URL}"`);
    }
    
    // Ensure URL has proper slash before _session endpoint
    const baseUrl = ENV.COUCHDB_SERVER_URL.endsWith('/') 
      ? ENV.COUCHDB_SERVER_URL.slice(0, -1) 
      : ENV.COUCHDB_SERVER_URL;
    const url = `${ENV.COUCHDB_SERVER_PROTOCOL}://${baseUrl}/_session`;
    logger.debug(`Attempting session check at: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Session check failed: ${response.status}`);
    }
    
    const resp: SessionResponse = await response.json();
    return resp;
  } catch (error) {
    // Use same URL construction logic for error reporting
    const baseUrl = ENV.COUCHDB_SERVER_URL.endsWith('/') 
      ? ENV.COUCHDB_SERVER_URL.slice(0, -1) 
      : ENV.COUCHDB_SERVER_URL;
    const url = `${ENV.COUCHDB_SERVER_PROTOCOL}://${baseUrl}/_session`;
    logger.error(`Session check error attempting to connect to: ${url} - ${error}`);
    throw new Error(`Session check failed connecting to ${url}: ${error}`);
  }
}

export async function getLoggedInUsername(): Promise<string> {
  const session = await getCurrentSession();
  if (session.userCtx.name && session.userCtx.name !== '') {
    return session.userCtx.name;
  }
  // Not logged in - throw so caller can handle guest account
  throw new Error('No logged in user');
}
