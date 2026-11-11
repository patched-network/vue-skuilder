import { Loggable } from '../../util/Loggable';
import { logger } from '../../util/logger';

export type Update<T> = Partial<T> | ((x: T) => T);

type Applied<T> = T & PouchDB.Core.GetMeta & PouchDB.Core.RevisionIdMeta;

/** A queued update and the caller waiting on it. */
interface Pending {
  update: Update<unknown>;
  resolve: (doc: unknown) => void;
  reject: (e: unknown) => void;
}

/**
 * Serialises updates per document. Updates queued while a write is in flight
 * go out together in the next write; each one settles exactly once, with the
 * outcome of the write that carried it, and is never applied again.
 */
export default class UpdateQueue extends Loggable {
  _className: string = 'UpdateQueue';
  /** Updates not yet taken by a write, per doc. */
  private pending: Map<string, Pending[]> = new Map();
  /** Docs with a drain loop running. */
  private draining: Set<string> = new Set();

  private readDB: PouchDB.Database; // Database for read operations
  private writeDB: PouchDB.Database; // Database for write operations (local-first)

  /**
   * Queues an update for a document and applies it with conflict resolution.
   *
   * @param id - Document ID to update
   * @param update - Partial object or function that transforms the document
   * @returns Promise resolving to the updated document
   *
   * @throws {PouchError} with status 404 if document doesn't exist
   *
   * @remarks
   * **Error Handling Pattern:**
   * - This method does NOT create documents if they don't exist
   * - Callers are responsible for handling 404 errors and creating documents
   * - A rejected update is dropped from the queue: a caller that creates the
   *   doc after a 404 has already applied its change and must not see it
   *   re-applied by a later update to the same doc
   * - This design maintains separation of concerns (UpdateQueue handles conflicts, callers handle lifecycle)
   *
   * @example
   * ```typescript
   * try {
   *   await updateQueue.update(docId, (doc) => ({ ...doc, field: newValue }));
   * } catch (e) {
   *   if ((e as PouchError).status === 404) {
   *     // Create the document with initial values
   *     await db.put({ _id: docId, field: newValue, ...initialFields });
   *   }
   * }
   * ```
   */
  public update<T extends PouchDB.Core.Document<object>>(
    id: PouchDB.Core.DocumentId,
    update: Update<T>
  ): Promise<Applied<T>> {
    logger.debug(`Update requested on doc: ${id}`);
    return new Promise<Applied<T>>((resolve, reject) => {
      const queue = this.pending.get(id) ?? [];
      queue.push({
        update: update as Update<unknown>,
        resolve: resolve as (doc: unknown) => void,
        reject,
      });
      this.pending.set(id, queue);
      if (!this.draining.has(id)) void this.drain(id);
    });
  }

  constructor(readDB: PouchDB.Database, writeDB?: PouchDB.Database) {
    super();
    // PouchDB.debug.enable('*');
    this.readDB = readDB;
    this.writeDB = writeDB || readDB; // Default to readDB if writeDB not provided
    logger.debug(`UpdateQ initialized...`);
    void this.readDB.info().then((i) => {
      logger.debug(`db info: ${JSON.stringify(i)}`);
    });
  }

  /** Writes the doc's queued updates, batch by batch, until none are left. */
  private async drain(id: string): Promise<void> {
    this.draining.add(id);
    try {
      let batch: Pending[] | undefined;
      while ((batch = this.pending.get(id)) && batch.length > 0) {
        // Take the batch: anything queued from here on goes in the next write.
        this.pending.delete(id);
        try {
          const doc = await this.write(
            id,
            batch.map((p) => p.update)
          );
          batch.forEach((p) => p.resolve(doc));
        } catch (e) {
          batch.forEach((p) => p.reject(e));
        }
      }
    } finally {
      this.draining.delete(id);
    }
  }

  /** One read-apply-put of `updates`, retried on conflict against a fresh read. */
  private async write(id: string, updates: Update<unknown>[]): Promise<unknown> {
    logger.debug(`Applying ${updates.length} update(s) on doc: ${id}`);
    const MAX_RETRIES = 5;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const doc = await this.readDB.get<object>(id);

        // Applied to a fresh copy each attempt, so function updates see the
        // doc as read on this attempt.
        let updatedDoc: PouchDB.Core.Document<object> & Partial<PouchDB.Core.RevisionIdMeta> = {
          ...doc,
        };
        for (const update of updates) {
          updatedDoc =
            typeof update === 'function'
              ? { ...updatedDoc, ...(update as (x: unknown) => object)(updatedDoc) }
              : { ...updatedDoc, ...(update as object) };
        }

        const res = await this.writeDB.put(updatedDoc);
        return { ...updatedDoc, _rev: res.rev };
      } catch (e: any) {
        if (e.name === 'conflict' && i < MAX_RETRIES - 1) {
          logger.warn(`Conflict on update for doc ${id}, retry #${i + 1}`);
          await new Promise((res) => setTimeout(res, 50 * Math.random()));
        } else if (e.name === 'not_found' && i === 0) {
          // Document not present - throw to caller for initialization
          logger.warn(`Update failed for ${id} - does not exist. Throwing to caller.`);
          throw e;
        } else {
          logger.error(`Error on attemped update (retry ${i}): ${JSON.stringify(e)}`);
          throw e;
        }
      }
    }
    // Unreachable: the last attempt returns or throws.
    throw new Error(`UpdateQueue failed for doc ${id} after ${MAX_RETRIES} retries.`);
  }
}
