import crypto from 'crypto';
import { getCouchDB } from './index.js';
import { findUserByUsername } from './userLookup.js';
import { isNanoError } from '../utils/types.js';

/**
 * Server-side minting of CouchDB `AuthSession` cookies.
 *
 * Lets express establish a session for a user whose identity was proven some
 * other way (see identityAssertion.ts) — there is no password to hand to
 * `_session`. The cookie is byte-for-byte what CouchDB itself issues:
 *
 *   base64url( "<name>:<TIMESTAMP_HEX>:" ++ HMAC(alg, secret ++ salt, "<name>:<TIMESTAMP_HEX>") )
 *
 * - alg: the FIRST entry of `[chttpd_auth] hash_algorithms` (3.3+, default
 *   "sha256, sha"); CouchDB 2.x has no such key and always uses SHA1.
 * - secret: `[chttpd_auth] secret`, falling back to the legacy
 *   `[couch_httpd_auth]` section, as CouchDB itself does.
 * - salt: the user's `_users` doc `salt`. Changing a user's password
 *   regenerates it, which invalidates every outstanding cookie for them.
 *
 * Config is read from the server's `_node/_local/_config` on every mint (admin
 * creds), so the secret never lives in env files and a rotation takes effect
 * immediately.
 *
 * Tied to CouchDB's cookie format: test/identityAssertion.test.ts compares minted
 * cookies byte for byte with CouchDB-issued ones; run it against the production
 * CouchDB version after any upgrade.
 */

/** CouchDB's defaults for the keys we read. */
const DEFAULT_TIMEOUT_SECONDS = 600;

export interface MintedSessionCookie {
  name: 'AuthSession';
  value: string;
  /** Seconds, when CouchDB issues persistent cookies; null = session cookie. */
  maxAge: number | null;
}

async function readConfig(section: string, key: string): Promise<string | null> {
  try {
    const value = await getCouchDB().request({
      path: `_node/_local/_config/${section}/${key}`,
    });
    return typeof value === 'string' ? value : null;
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 404) return null;
    throw error;
  }
}

/** chttpd_auth first, then the legacy couch_httpd_auth section. */
async function readAuthConfig(key: string): Promise<string | null> {
  return (await readConfig('chttpd_auth', key)) ?? (await readConfig('couch_httpd_auth', key));
}

/** Map a CouchDB (Erlang) hash name to a Node crypto one. */
function nodeHashName(couchName: string): string {
  const name = couchName.trim().toLowerCase();
  if (name === 'sha') return 'sha1';
  if (['sha224', 'sha256', 'sha384', 'sha512'].includes(name)) return name;
  throw new Error(`Unsupported CouchDB cookie hash algorithm: ${couchName}`);
}

export interface CookieParams {
  username: string;
  secret: string;
  salt: string;
  /** Node crypto hash name, e.g. 'sha256'. */
  hash: string;
  /** Seconds since the epoch. */
  timestamp: number;
}

/** Pure cookie-value computation (exported for tests). */
export function computeAuthSessionValue(p: CookieParams): string {
  const sessionData = `${p.username}:${p.timestamp.toString(16).toUpperCase()}`;
  const mac = crypto
    .createHmac(p.hash, p.secret + p.salt) // string keys are UTF-8
    .update(sessionData, 'utf8')
    .digest();
  // Spread to bytes: Buffer.concat trips this package's Buffer/Uint8Array typings.
  return Buffer.from([...Buffer.from(sessionData + ':', 'utf8'), ...mac]).toString('base64url');
}

export interface CookieConfig {
  secret: string;
  /** Node crypto hash name used to sign new cookies. */
  hash: string;
  timeout: number;
  persistent: boolean;
}

/** The server's cookie-signing config, resolved the way CouchDB resolves it. */
export async function readCookieConfig(): Promise<CookieConfig> {
  const secret = await readAuthConfig('secret');
  if (!secret) {
    throw new Error('Cannot mint session: CouchDB auth secret is not configured');
  }

  const algorithms = await readConfig('chttpd_auth', 'hash_algorithms');
  const hash = algorithms ? nodeHashName(algorithms.split(',')[0]) : 'sha1';

  const timeoutRaw = await readAuthConfig('timeout');
  const timeout = timeoutRaw ? parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_SECONDS;

  // Default true since CouchDB 3.0.
  const persistentRaw = await readAuthConfig('allow_persistent_cookies');
  const persistent = persistentRaw === null ? true : persistentRaw === 'true';

  return { secret, hash, timeout, persistent };
}

export async function mintAuthSessionCookie(username: string): Promise<MintedSessionCookie> {
  const userDoc = await findUserByUsername(username);
  const salt = (userDoc as { salt?: unknown } | null)?.salt;
  if (!userDoc || typeof salt !== 'string' || !salt) {
    throw new Error(`Cannot mint session for ${username}: no user or no salt`);
  }

  const { secret, hash, timeout, persistent } = await readCookieConfig();

  return {
    name: 'AuthSession',
    value: computeAuthSessionValue({
      username,
      secret,
      salt,
      hash,
      timestamp: Math.floor(Date.now() / 1000),
    }),
    maxAge: persistent ? timeout : null,
  };
}
