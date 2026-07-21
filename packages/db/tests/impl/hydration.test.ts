import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';
import { buildStrategyStateId, DocType } from '@db/core';
import type { SyncStrategy } from '@db/impl/common/SyncStrategy';

PouchDB.plugin(memoryAdapter);

// Swap the local-DB factory for in-memory databases. Everything else — the
// replication, the marker read/write, BaseUser itself — stays real.
//
// The memory adapter keys stores by name, so repeated calls hand back distinct
// handles onto the same store. That matches production (getLocalUserDB does not
// cache) and keeps the localDB/remoteDB name comparison meaningful.
vi.mock('@db/impl/common/userDBHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@db/impl/common/userDBHelpers')>();
  const Pouch = (await import('pouchdb')).default;
  const memory = (await import('pouchdb-adapter-memory')).default;
  Pouch.plugin(memory);

  return {
    ...actual,
    getLocalUserDB: (username: string) => new Pouch(`local-${username}`, { adapter: 'memory' }),
  };
});

const { BaseUser } = await import('@db/impl/common/BaseUserDB');

const COURSE_ID = 'course-abc';
const STATE_KEY = 'letterProgression';

function localDB(username: string) {
  return new PouchDB(`local-${username}`, { adapter: 'memory' });
}

function remoteDB(username: string) {
  return new PouchDB(`remote-${username}`, { adapter: 'memory' });
}

/**
 * A strategy whose remote is a separate in-memory DB, i.e. a logged-in user.
 * hydrate() performs a genuine one-shot replication.
 */
function authedStrategy(username: string, overrides: Partial<SyncStrategy> = {}): SyncStrategy {
  return {
    setupRemoteDB: () => remoteDB(username),
    getWriteDB: () => remoteDB(username),
    startSync: vi.fn(),
    stopSync: vi.fn(),
    canCreateAccount: () => true,
    canAuthenticate: () => true,
    getCurrentUsername: async () => username,
    hydrate: vi.fn(async (local: PouchDB.Database, remote: PouchDB.Database) => {
      const info = await new Promise<any>((resolve, reject) => {
        void PouchDB.replicate(remote, local, {}).on('complete', resolve).on('error', reject);
      });
      return { docsWritten: info.docs_written };
    }),
    ...overrides,
  } as SyncStrategy;
}

/** Guest: setupRemoteDB hands back the local database itself. */
function guestStrategy(username: string): SyncStrategy {
  return {
    setupRemoteDB: (u: string) => localDB(u),
    getWriteDB: (u: string) => localDB(u),
    startSync: vi.fn(),
    stopSync: vi.fn(),
    canCreateAccount: () => false,
    canAuthenticate: () => false,
    getCurrentUsername: async () => username,
    hydrate: vi.fn(),
  } as unknown as SyncStrategy;
}

/** Seed a remote DB with the state an established account would have. */
async function seedRemote(username: string) {
  const remote = remoteDB(username);
  await remote.put({
    _id: 'CONFIG',
    darkMode: true,
    likesConfetti: true,
    sessionTimeLimit: 42,
  });
  await remote.put({
    _id: 'CourseRegistrations',
    courses: [
      {
        courseID: COURSE_ID,
        status: 'active',
        user: true,
        admin: false,
        moderator: false,
        elo: { global: { score: 1600, count: 90 }, tags: {}, misc: {} },
      },
    ],
    studyWeight: { [COURSE_ID]: 1 },
  });
  await remote.put({
    _id: buildStrategyStateId(COURSE_ID, STATE_KEY),
    docType: DocType.STRATEGY_STATE,
    courseId: COURSE_ID,
    strategyKey: STATE_KEY,
    data: { unlockedLetters: ['a', 't', 's', 'm'] },
    updatedAt: new Date().toISOString(),
  });
  return remote;
}

let counter = 0;
/** Unique username per test so each gets a pristine pair of stores. */
function freshUsername() {
  return `hydration-user-${counter++}`;
}

describe('user DB hydration', () => {
  let username: string;

  beforeEach(() => {
    username = freshUsername();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pulls an existing account onto a fresh device before handing out the user', async () => {
    // The reported bug: logging in on a new device showed the canned new-user
    // state, because reads hit an empty local mirror.
    await seedRemote(username);
    const strategy = authedStrategy(username);

    const user = await BaseUser.instance(strategy, username);

    expect(user.hydrationStatus().state).toBe('hydrated');
    expect(user.hydrationStatus().docsWritten).toBeGreaterThan(0);

    // The state that drives the study hub must be the real one, not null.
    const progression = await user.getStrategyState<{ unlockedLetters: string[] }>(
      COURSE_ID,
      STATE_KEY
    );
    expect(progression).toEqual({ unlockedLetters: ['a', 't', 's', 'm'] });

    // And the registration doc must carry real ELO rather than a fresh default.
    const reg = await user.getCourseRegDoc(COURSE_ID);
    expect(reg.elo).toMatchObject({ global: { score: 1600, count: 90 } });
  });

  it('does not re-pull on a device that has hydrated before', async () => {
    await seedRemote(username);

    const first = authedStrategy(username);
    const firstUser = await BaseUser.instance(first, username);
    expect(firstUser.hydrationStatus().state).toBe('hydrated');
    expect(first.hydrate).toHaveBeenCalledTimes(1);

    // Second startup on the same device: the _local marker survives, so this
    // must proceed on local data rather than blocking on the network.
    const second = authedStrategy(username);
    const secondUser = await BaseUser.instance(second, username);

    expect(secondUser.hydrationStatus().state).toBe('stale');
    expect(second.hydrate).not.toHaveBeenCalled();
  });

  it('reports failure rather than presenting an empty account', async () => {
    await seedRemote(username);
    const strategy = authedStrategy(username, {
      hydrate: vi.fn(async () => {
        throw new Error('network down');
      }),
    });

    const user = await BaseUser.instance(strategy, username);

    expect(user.hydrationStatus().state).toBe('failed');
    expect(user.hydrationStatus().error).toContain('network down');
  });

  it('refuses to materialize defaults over data it could not read', async () => {
    await seedRemote(username);
    const strategy = authedStrategy(username, {
      hydrate: vi.fn(async () => {
        throw new Error('network down');
      }),
    });

    const user = await BaseUser.instance(strategy, username);

    // Both of these would otherwise 404 against the empty mirror and write a
    // default doc — which then loses to the real remote doc at replication,
    // silently discarding whatever the user did in the meantime.
    await expect(user.getConfig()).rejects.toThrow(/hydration state 'failed'/);
    await expect(user.getCourseRegistrationsDoc()).rejects.toThrow(/hydration state 'failed'/);

    // And the read that caused the reported bug must not answer "no state",
    // which consumers act on as "first run".
    await expect(user.getStrategyState(COURSE_ID, STATE_KEY)).rejects.toThrow(
      /hydration state 'failed'/
    );
  });

  it('still materializes defaults for a genuinely new account', async () => {
    // Nothing seeded: hydration succeeds with zero documents, so a 404 really
    // does mean "no such data" and the defaults are correct.
    const strategy = authedStrategy(username);

    const user = await BaseUser.instance(strategy, username);

    expect(user.hydrationStatus().state).toBe('hydrated');
    const config = await user.getConfig();
    expect(config.sessionTimeLimit).toBe(5);
    const reg = await user.getCourseRegistrationsDoc();
    expect(reg.courses).toEqual([]);
  });

  it('skips hydration for guests, who have no remote', async () => {
    const strategy = guestStrategy(username);

    const user = await BaseUser.instance(strategy, username);

    expect(user.hydrationStatus().state).toBe('not-required');
    expect(strategy.hydrate).not.toHaveBeenCalled();
  });

  it('hydrates before starting live sync', async () => {
    await seedRemote(username);
    const order: string[] = [];
    const strategy = authedStrategy(username, {
      startSync: vi.fn(() => {
        order.push('startSync');
      }),
    });
    const originalHydrate = strategy.hydrate!;
    strategy.hydrate = vi.fn(async (l, r) => {
      order.push('hydrate');
      return originalHydrate(l, r);
    });

    await BaseUser.instance(strategy, username);

    // Live sync pushes local state upward; it must not run while the mirror is
    // still empty.
    expect(order).toEqual(['hydrate', 'startSync']);
  });

  it('awaitHydration resolves to the settled status, never "hydrating"', async () => {
    // The race this closes: a route guard sampling status while a login is
    // still pulling. It would see 'hydrating', fall through, and render an
    // established learner as brand new — the original bug, via a side door.
    const realName = freshUsername();
    await seedRemote(realName);

    let releaseHydrate: (v: { docsWritten: number }) => void = () => {};
    const hydrate = vi.fn(
      () =>
        new Promise<{ docsWritten: number }>((resolve) => {
          releaseHydrate = resolve;
        })
    );

    const guestName = 'sk-guest-mid-login';
    const strategy = {
      ...authedStrategy(realName, { hydrate }),
      // Guest before login, real remote after — mirroring setupRemoteDB.
      setupRemoteDB: (u: string) => (u.startsWith('sk-guest-') ? localDB(u) : remoteDB(realName)),
      getWriteDB: (u: string) => (u.startsWith('sk-guest-') ? localDB(u) : remoteDB(realName)),
      authenticate: async () => ({ ok: true }),
    } as SyncStrategy;

    // Starts as a guest: nothing to hydrate.
    const user = await BaseUser.instance(strategy, guestName);
    expect(user.hydrationStatus().state).toBe('not-required');

    // Log in, but do NOT await it — this is the window a stray navigation
    // lands in.
    const loginPromise = user.login(realName, 'password');

    while (hydrate.mock.calls.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // Mid-flight: the snapshot is honest about being unsettled...
    expect(user.hydrationStatus().state).toBe('hydrating');

    // ...and a caller that needs an answer waits for the real one.
    const settled = user.awaitHydration();
    releaseHydrate({ docsWritten: 3 });

    expect((await settled).state).toBe('hydrated');
    expect(user.hydrationStatus().state).toBe('hydrated');

    await loginPromise;
  });

  it('gives up on a pull that hangs', async () => {
    await seedRemote(username);
    // Fake setTimeout only — PouchDB's internals rely on the other async
    // primitives, and faking those wedges the marker read before hydration is
    // even reached. runAllTimersAsync (rather than advancing a fixed window)
    // because the timeout timer is scheduled partway through init, after the
    // clock would already have moved past a fixed advance.
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const strategy = authedStrategy(username, {
      hydrate: vi.fn(() => new Promise<{ docsWritten: number }>(() => {})), // never settles
    });

    const pending = BaseUser.instance(strategy, username);

    // init() first awaits the marker read (a real PouchDB op, not timer-driven),
    // so the timeout is not armed yet — running timers now would find none
    // pending and return immediately, leaving the test hanging. Yield real
    // macrotasks until hydrate() has been entered; withTimeout arms the timer
    // in that same synchronous step.
    while ((strategy.hydrate as ReturnType<typeof vi.fn>).mock.calls.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    await vi.runAllTimersAsync();
    const user = await pending;

    expect(user.hydrationStatus().state).toBe('failed');
    expect(user.hydrationStatus().error).toMatch(/timed out/);
    // The abandoned pull is cancelled so it cannot race the live sync.
    expect(strategy.stopSync).toHaveBeenCalled();
  });
});
