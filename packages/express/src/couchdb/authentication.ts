import Nano from 'nano';
import { COUCH_URL_WITH_PROTOCOL } from './index.js';
import { VueClientRequest } from '../app.js';
import logger from '../logger.js';

interface CouchSession {
  info: {
    authenticated: string;
    authentication_db: string;
    authentication_handlers: string[];
  };
  ok: boolean;
  userCtx: {
    name: string;
    roles: string[];
  };
}

export async function requestIsAdminAuthenticated(req: VueClientRequest) {
  logRequest(req);

  const username = req.body.user;
  const authCookie: string = req.cookies.AuthSession ? req.cookies.AuthSession : 'null';

  if (authCookie === 'null') {
    return false;
  } else {
    return await Nano({
      cookie: 'AuthSession=' + authCookie,
      url: COUCH_URL_WITH_PROTOCOL,
    })
      .session()
      .then((s: CouchSession) => {
        logger.info(`AuthUser: ${JSON.stringify(s)}`);
        const isAdmin = s.userCtx.roles.indexOf('_admin') !== -1;
        const isLoggedInUser = s.userCtx.name === username;
        return isAdmin && isLoggedInUser;
      })
      .catch((_err) => {
        return false;
      });
  }
}

function logRequest(req: VueClientRequest) {
  logger.info(`${req.body.type} request from ${req.body.user}...`);
}

export async function requestIsAuthenticated(req: VueClientRequest) {
  logRequest(req);

  // Studio mode bypass: skip authentication for local development
  if (process.env.NODE_ENV === 'studio') {
    logger.info('Studio mode: bypassing authentication for local development');
    return true;
  }

  if (req.headers.authorization) {
    const auth = Buffer.from(req.headers.authorization.split(' ')[1], 'base64')
      .toString('ascii')
      .split(':');
    const username = auth[0];
    const password = auth[1];

    const authResult = await Nano({
      url: COUCH_URL_WITH_PROTOCOL,
    }).auth(username, password);

    return authResult.ok;
  }

  const username = req.body.user;
  const authCookie: string = req.cookies.AuthSession ? req.cookies.AuthSession : 'null';

  if (authCookie === 'null') {
    return false;
  } else {
    return await Nano({
      cookie: 'AuthSession=' + authCookie,
      url: COUCH_URL_WITH_PROTOCOL,
    })
      .session()
      .then((s: CouchSession) => {
        logger.info(`AuthUser: ${JSON.stringify(s)}`);
        return s.userCtx.name === username;
      })
      .catch((_err) => {
        return false;
      });
  }
}
