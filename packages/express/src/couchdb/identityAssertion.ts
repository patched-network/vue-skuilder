import type { CouchDbUserDoc } from '@vue-skuilder/db';
import { getCouchDB } from './index.js';
import {
  findUserByUsername,
  findUsernamesByEmail,
  findVerifiedUserByEmail,
  updateUserDoc,
} from './userLookup.js';
import { generateSecureToken } from '../utils/tokens.js';
import { normalizeEmail } from '../utils/email.js';
import { isNanoError } from '../utils/types.js';
import logger from '../logger.js';

/**
 * Identity assertion: "a trusted caller vouches that this person controls this
 * email" → the account that email belongs to, created if need be.
 *
 * The provider-agnostic core of third-party sign-in (Google, Apple, SSO, magic
 * links). Provider token verification lives with the caller; this module owns
 * the `_users` rules, which must stay in one place alongside /verify,
 * /resolve-login and reset:
 *
 * Resolution order (mirrors /resolve-login's candidates):
 *   1. the account that has *verified* this email;
 *   2. the account whose username IS the email (unless its recovery address
 *      has since been changed to something else — then the name is just an
 *      opaque id and the address is no longer the owner's);
 *   3. accounts with this email saved but unverified (first by name, so the
 *      pick is deterministic);
 *   4. none: create a verified account named after the email.
 *
 * Rules:
 *   - Accounts with any role are never resolved. App users carry `roles: []`;
 *     a role means a privileged account, which must stay password-only, or it
 *     is only as secure as the third-party account sharing its address.
 *   - Linking an existing account (1–3) requires `authoritative: true`: the
 *     asserter must be authoritative for the address, not merely have checked
 *     it once. Otherwise a lapsed-then-reregistered address would open someone
 *     else's account. Creating a *new* account needs no such guarantee.
 *   - Linking an unverified account (2–3) marks it verified and rotates its
 *     password to a random one. The rotation regenerates the salt CouchDB signs
 *     session cookies with, killing any squatter's sessions; the legitimate
 *     owner can get a password back through reset.
 *   - Linking a verified account (1) mutates nothing.
 */

export interface IdentityAssertion {
  email: string;
  /** Free-form provider tag, for logs and the `_users` doc. */
  provider: string;
  /** Whether the asserter is authoritative for this address right now. */
  authoritative: boolean;
}

export type IdentityResolution =
  | { ok: true; username: string; outcome: 'existing' | 'linked' | 'created' }
  | {
      ok: false;
      code: 'privileged_account' | 'link_requires_authoritative' | 'username_conflict';
    };

type UserDoc = CouchDbUserDoc & {
  roles?: string[];
  linkedProviders?: string[];
  /** Plaintext on write only; CouchDB hashes it (new salt) on save. */
  password?: string;
};

function isPrivileged(doc: UserDoc): boolean {
  return Array.isArray(doc.roles) && doc.roles.length > 0;
}

function withProvider(doc: UserDoc, provider: string): string[] {
  const existing = Array.isArray(doc.linkedProviders) ? doc.linkedProviders : [];
  return existing.includes(provider) ? existing : [...existing, provider];
}

export async function resolveAssertedIdentity(
  assertion: IdentityAssertion
): Promise<IdentityResolution> {
  const email = normalizeEmail(assertion.email);
  const { provider, authoritative } = assertion;

  // 1. Verified owner of the address.
  const verified = (await findVerifiedUserByEmail(email)) as UserDoc | null;
  if (verified) {
    if (isPrivileged(verified)) return refuse('privileged_account', verified.name, provider);
    if (!authoritative) return refuse('link_requires_authoritative', verified.name, provider);
    return { ok: true, username: verified.name, outcome: 'existing' };
  }

  // 2 + 3. Unverified claims on the address.
  const byName = (await findUserByUsername(email)) as UserDoc | null;
  const nameCandidate = byName && (!byName.email || byName.email === email) ? byName : null;

  let target: UserDoc | null = nameCandidate;
  if (!target) {
    const names = (await findUsernamesByEmail(email, 10)).sort();
    if (names.length > 1) {
      logger.warn(
        `[identity] ${names.length} unverified accounts claim ${email}; linking ${names[0]}`
      );
    }
    if (names.length > 0) target = (await findUserByUsername(names[0])) as UserDoc | null;
  }

  if (target) {
    if (isPrivileged(target)) return refuse('privileged_account', target.name, provider);
    if (!authoritative) return refuse('link_requires_authoritative', target.name, provider);

    // Already verified for this address: step 1 should have found it, but the
    // by_verified_email lookup fails open while its view is missing. Never
    // rotate a verified owner's password.
    if (target.status === 'verified' && target.email === email) {
      return { ok: true, username: target.name, outcome: 'existing' };
    }

    target.email = email;
    target.status = 'verified';
    target.verificationToken = null;
    target.verificationTokenExpiresAt = null;
    target.password = generateSecureToken();
    target.linkedProviders = withProvider(target, provider);
    await updateUserDoc(target);
    logger.info(`[identity] linked ${target.name} via ${provider} (verified, password rotated)`);
    return { ok: true, username: target.name, outcome: 'linked' };
  }

  // 4. New account. The name is taken only if an account named after this
  // address moved its recovery email elsewhere (skipped in step 2).
  if (byName) return refuse('username_conflict', byName.name, provider);

  const newDoc = {
    _id: `org.couchdb.user:${email}`,
    name: email,
    type: 'user',
    roles: [] as string[],
    password: generateSecureToken(),
    email,
    status: 'verified',
    linkedProviders: [provider],
  };
  try {
    await getCouchDB().use('_users').insert(newDoc);
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 409) {
      // Raced a concurrent signup for the same address.
      return refuse('username_conflict', email, provider);
    }
    throw error;
  }
  logger.info(`[identity] created ${email} via ${provider}`);
  return { ok: true, username: email, outcome: 'created' };
}

function refuse(
  code: 'privileged_account' | 'link_requires_authoritative' | 'username_conflict',
  username: string,
  provider: string
): IdentityResolution {
  logger.warn(`[identity] refused ${provider} assertion for ${username}: ${code}`);
  return { ok: false, code };
}
