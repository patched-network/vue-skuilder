import Nano from 'nano';
import { getCouchURLWithProtocol } from './index.js';
import { VueClientRequest } from '../app-factory.js';
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

/**
 * Result of authentication check.
 * - If authenticated: { authenticated: true, username: string, isAdmin: boolean }
 * - If not authenticated: { authenticated: false }
 */
export type AuthResult =
  | { authenticated: true; username: string; isAdmin: boolean }
  | { authenticated: false };

/**
 * Get the authenticated user from the request's session cookie or authorization header.
 * Returns the username from the session - does NOT trust req.body.user.
 *
 * This is the secure way to get the authenticated username - callers should use
 * the returned username rather than trusting user-supplied data.
 */
export async function getAuthenticatedUser(
  req: VueClientRequest
): Promise<AuthResult> {
  logRequest(req);

  // Studio mode bypass: skip authentication for local development
  if (process.env.NODE_ENV === 'studio') {
    logger.info('Studio mode: bypassing authentication for local development');
    // In studio mode, trust the body.user since this is local development only
    const studioUser = req.body.user || 'studio-user';
    return { authenticated: true, username: studioUser, isAdmin: true };
  }

  // Check for Basic auth header first
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Basic ')) {
      const auth = Buffer.from(authHeader.split(' ')[1], 'base64')
        .toString('ascii')
        .split(':');
      const username = auth[0];
      const password = auth[1];

      try {
        const authResult = await Nano({
          url: getCouchURLWithProtocol(),
        }).auth(username, password);

        if (authResult.ok) {
          // Check if user has admin role by getting session
          const nano = Nano({
            url: getCouchURLWithProtocol(),
          });
          await nano.auth(username, password);
          const session = (await nano.session()) as CouchSession;
          const isAdmin = session.userCtx.roles.includes('_admin');
          return { authenticated: true, username, isAdmin };
        }
      } catch (err) {
        logger.warn('Basic auth failed:', err);
      }
    }
    return { authenticated: false };
  }

  // Check for session cookie
  const authCookie: string = req.cookies.AuthSession
    ? req.cookies.AuthSession
    : 'null';

  if (authCookie === 'null') {
    return { authenticated: false };
  }

  try {
    const session = (await Nano({
      cookie: 'AuthSession=' + authCookie,
      url: getCouchURLWithProtocol(),
    }).session()) as CouchSession;

    logger.info(`AuthUser: ${JSON.stringify(session)}`);

    if (session.ok && session.userCtx.name) {
      const isAdmin = session.userCtx.roles.includes('_admin');
      return {
        authenticated: true,
        username: session.userCtx.name,
        isAdmin,
      };
    }

    return { authenticated: false };
  } catch (err) {
    logger.warn('Session validation failed:', err);
    return { authenticated: false };
  }
}

/**
 * Check if the request is authenticated (any valid user).
 * Returns true if authenticated, false otherwise.
 *
 * @deprecated Use getAuthenticatedUser() instead to get the actual username
 */
export async function requestIsAuthenticated(
  req: VueClientRequest
): Promise<boolean> {
  const result = await getAuthenticatedUser(req);
  return result.authenticated;
}

/**
 * Check if the request is authenticated as an admin user.
 * Returns true only if the session has _admin role.
 *
 * SECURITY FIX: No longer trusts req.body.user - only checks session role.
 *
 * @deprecated Use getAuthenticatedUser() and check isAdmin instead
 */
export async function requestIsAdminAuthenticated(
  req: VueClientRequest
): Promise<boolean> {
  const result = await getAuthenticatedUser(req);
  return result.authenticated && result.isAdmin;
}

function logRequest(req: VueClientRequest) {
  // Log the claimed user for debugging, but note this is NOT trusted
  logger.info(`${req.body.type} request (claimed user: ${req.body.user})...`);
}
