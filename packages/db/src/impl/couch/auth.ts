import { ENV } from '@db/factory';
import { GuestUsername } from '../../core/types/types-legacy';
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
    const url = `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}_session`;
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
    logger.error(`Session check error: ${error}`);
    throw new Error(`Session check failed: ${error}`);
  }
}

export async function getLoggedInUsername(): Promise<string> {
  try {
    const session = await getCurrentSession();
    if (session.userCtx.name && session.userCtx.name !== '') {
      return session.userCtx.name;
    }
  } catch (error) {
    logger.error('Failed to get session:', error);
  }
  return GuestUsername;
}
