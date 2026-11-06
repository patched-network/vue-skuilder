import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';

PouchDB.plugin(memoryAdapter);

// Local replicas: in-memory PouchDB. The memory adapter keys stores by name,
// so a new handle with the same name (a "page load") sees the same data, as an
// IndexedDB replica would.
vi.mock('@db/impl/couch/pouchdb-setup', async () => {
  const Pouch = (await import('pouchdb')).default;
  const memory = (await import('pouchdb-adapter-memory')).default;
  Pouch.plugin(memory);
  return { default: Pouch.defaults({ adapter: 'memory' }) };
});

const { CourseSyncService } = await import('@db/impl/couch/CourseSyncService');

// A course ID per test, so each test has its own local replica (no teardown).
let COURSE = '';
const MARKER = '_local/sk-course-sync-complete';

let remote: PouchDB.Database;
let n = 0;

/** A fresh service instance, i.e. a new page load, with `remote` as the server. */
function pageLoad() {
  // Abandon the previous instance, as a reload does. (resetInstance() would
  // start closing its handles, and a new handle on the same store waits on that.)
  (CourseSyncService as any).instance = null;
  const service = CourseSyncService.getInstance();
  vi.spyOn(service as any, 'getRemoteDB').mockImplementation(() => remote);
  return service;
}

function local() {
  return new PouchDB(`coursedb-local-${COURSE}`, { adapter: 'memory' });
}

async function hasMarker(): Promise<boolean> {
  try {
    await local().get(MARKER);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  COURSE = `course-sync-test-${n}`;
  remote = new PouchDB(`remote-${COURSE}-${n++}`, { adapter: 'memory' });
  await remote.bulkDocs([
    { _id: 'db-epoch', epoch: 1 },
    { _id: 'c-1', docType: 'CARD' },
    { _id: 'c-2', docType: 'CARD' },
  ]);
});

afterEach(() => {
  (CourseSyncService as any).instance = null;
  vi.restoreAllMocks();
});

describe('CourseSyncService: replica ready from the marker', () => {
  it('first sync replicates everything and writes the marker', async () => {
    const service = pageLoad();
    await service.ensureSynced(COURSE, true);

    expect(service.isReady(COURSE)).toBe(true);
    expect(await hasMarker()).toBe(true);
    await expect(service.getLocalDB(COURSE)!.get('c-2')).resolves.toBeTruthy();
  });

  it('next page load: ready immediately, refreshed in the background', async () => {
    await pageLoad().ensureSynced(COURSE, true);
    await remote.put({ _id: 'c-3', docType: 'CARD' });

    const service = pageLoad();
    const replicate = vi.spyOn(service as any, 'replicate');
    await service.ensureSynced(COURSE, true);

    // Ready before the refresh pulls the new doc (handed out from the marker).
    expect(service.isReady(COURSE)).toBe(true);
    const db = service.getLocalDB(COURSE)!;

    await vi.waitFor(async () => {
      expect(service.getStatus(COURSE)?.docsReplicated).toBe(1);
    });
    expect(replicate).toHaveBeenCalledTimes(1);
    await expect(db.get('c-3')).resolves.toBeTruthy();
    // Same DB throughout: readers keep their handle.
    expect(service.getLocalDB(COURSE)).toBe(db);
  });

  it('remote recreated: keeps the outdated replica this page, rebuilds on the next', async () => {
    await pageLoad().ensureSynced(COURSE, true);

    // "Recreate" the remote: new epoch, different content.
    remote = new PouchDB(`remote-${COURSE}-${n++}`, { adapter: 'memory' });
    await remote.bulkDocs([
      { _id: 'db-epoch', epoch: 2 },
      { _id: 'c-new', docType: 'CARD' },
    ]);

    const service = pageLoad();
    await service.ensureSynced(COURSE, true);
    const db = service.getLocalDB(COURSE)!;

    await vi.waitFor(async () => {
      expect(await hasMarker()).toBe(false);
    });
    // Not destroyed under readers: still ready, still the old content.
    expect(service.isReady(COURSE)).toBe(true);
    await expect(db.get('c-1')).resolves.toBeTruthy();

    // Next page load: no marker, so the full path rebuilds from the new remote.
    const next = pageLoad();
    await next.ensureSynced(COURSE, true);
    const rebuilt = next.getLocalDB(COURSE)!;
    await expect(rebuilt.get('c-new')).resolves.toBeTruthy();
    await expect(rebuilt.get('c-1')).rejects.toBeTruthy();
    expect(await hasMarker()).toBe(true);
  });

  it('a failed background refresh leaves the replica ready', async () => {
    await pageLoad().ensureSynced(COURSE, true);

    const service = pageLoad();
    vi.spyOn(service as any, 'isLocalEpochStale').mockResolvedValue(false);
    const replicate = vi
      .spyOn(service as any, 'replicate')
      .mockRejectedValue(new Error('network down'));
    await service.ensureSynced(COURSE, true);

    await vi.waitFor(() => expect(replicate).toHaveBeenCalled());
    expect(service.isReady(COURSE)).toBe(true);
    await expect(service.getLocalDB(COURSE)!.get('c-1')).resolves.toBeTruthy();
  });
});
