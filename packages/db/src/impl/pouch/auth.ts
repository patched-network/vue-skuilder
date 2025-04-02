import { ENV } from '@vue-skuilder/common';
import { GuestUsername } from '../../core/types/types-legacy';

interface SessionResponse {
  info: unknown;
  ok: boolean;
  userCtx: {
    name: string;
    roles: string[];
  };
}

export async function getCurrentSession(): Promise<SessionResponse> {
  return new Promise((resolve, reject) => {
    const authXML = new XMLHttpRequest();
    authXML.withCredentials = true;

    authXML.onerror = (e) => {
      reject(new Error('Session check failed'));
    };

    authXML.addEventListener('load', () => {
      try {
        const resp: SessionResponse = JSON.parse(authXML.responseText);
        resolve(resp);
      } catch (e) {
        reject(e);
      }
    });

    const url = `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}_session`;
    authXML.open('GET', url);
    authXML.send();
  });
}

export async function getLoggedInUsername(): Promise<string> {
  try {
    const session = await getCurrentSession();
    if (session.userCtx.name && session.userCtx.name !== '') {
      return session.userCtx.name;
    }
  } catch (error) {
    console.error('Failed to get session:', error);
  }
  return GuestUsername;
}
