import { describe, it, expect } from 'vitest';
import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';
import UpdateQueue from '@db/impl/couch/updateQueue';

PouchDB.plugin(memoryAdapter);

interface Doc {
  _id: string;
  _rev?: string;
  records: number[];
}

let n = 0;
const freshDB = () => new PouchDB(`updatequeue-test-${n++}`, { adapter: 'memory' });
const push = (r: number) => (d: Doc) => ({ ...d, records: [...d.records, r] });

describe('UpdateQueue', () => {
  it('drops an update rejected with 404: the caller creating the doc does not see it re-applied', async () => {
    const db = freshDB();
    const q = new UpdateQueue(db);

    // putCardRecord's first-ever record: update → 404 → create holding the record.
    await expect(q.update<Doc>('d', push(1))).rejects.toMatchObject({ status: 404 });
    await db.put({ _id: 'd', records: [1] });

    // The retry's record.
    await q.update<Doc>('d', push(2));
    expect((await db.get<Doc>('d')).records).toEqual([1, 2]);
  });

  it('settles every update queued while a write is in flight', async () => {
    const db = freshDB();
    await db.put({ _id: 'd', records: [] });
    const q = new UpdateQueue(db);

    const first = q.update<Doc>('d', push(1));
    await Promise.resolve(); // the first write is under way
    const rest = [2, 3, 4].map((r) => q.update<Doc>('d', push(r)));

    const done = await Promise.race([
      Promise.all([first, ...rest]).then(() => 'settled'),
      new Promise((res) => setTimeout(() => res('hung'), 2000)),
    ]);
    expect(done).toBe('settled');
    expect((await db.get<Doc>('d')).records).toEqual([1, 2, 3, 4]);
  });

  it('resolves with the written revision', async () => {
    const db = freshDB();
    await db.put({ _id: 'd', records: [] });
    const q = new UpdateQueue(db);

    const doc = await q.update<Doc>('d', push(1));
    expect(doc._rev).toBe((await db.get<Doc>('d'))._rev);
  });
});
