import { Loggable } from '../../util/Loggable';
import { logger } from '../../util/logger';

export type Update<T> = Partial<T> | ((x: T) => T);

export default class UpdateQueue extends Loggable {
  _className: string = 'UpdateQueue';
  private pendingUpdates: {
    [index: string]: Update<unknown>[];
  } = {};
  private inprogressUpdates: {
    [index: string]: boolean;
  } = {};

  private readDB: PouchDB.Database; // Database for read operations
  private writeDB: PouchDB.Database; // Database for write operations (local-first)

  public update<T extends PouchDB.Core.Document<object>>(
    id: PouchDB.Core.DocumentId,
    update: Update<T>
  ) {
    logger.debug(`Update requested on doc: ${id}`);
    if (this.pendingUpdates[id]) {
      this.pendingUpdates[id].push(update);
    } else {
      this.pendingUpdates[id] = [update];
    }
    return this.applyUpdates<T>(id);
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

  private async applyUpdates<T extends PouchDB.Core.Document<object>>(
    id: string
  ): Promise<T & PouchDB.Core.GetMeta & PouchDB.Core.RevisionIdMeta> {
    logger.debug(`Applying updates on doc: ${id}`);
    if (this.inprogressUpdates[id]) {
      // Poll instead of recursing to avoid infinite recursion
      while (this.inprogressUpdates[id]) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      }
      return this.applyUpdates<T>(id);
    } else {
      if (this.pendingUpdates[id] && this.pendingUpdates[id].length > 0) {
        this.inprogressUpdates[id] = true;

        const MAX_RETRIES = 5;
        for (let i = 0; i < MAX_RETRIES; i++) {
          try {
            const doc = await this.readDB.get<T>(id);
            logger.debug(`Retrieved doc: ${id}`);

            // Create a new doc object to apply updates to for this attempt
            let updatedDoc = { ...doc };

            // Note: This loop is not fully safe if updates are functions that depend on a specific doc state
            // that might change between retries. But for simple object merges, it's okay.
            const updatesToApply = [...this.pendingUpdates[id]];
            for (const update of updatesToApply) {
              if (typeof update === 'function') {
                updatedDoc = { ...updatedDoc, ...update(updatedDoc) };
              } else {
                updatedDoc = {
                  ...updatedDoc,
                  ...update,
                };
              }
            }

            await this.writeDB.put<T>(updatedDoc);
            logger.debug(`Put doc: ${id}`);

            // Success! Remove the updates we just applied.
            this.pendingUpdates[id].splice(0, updatesToApply.length);

            if (this.pendingUpdates[id].length === 0) {
              this.inprogressUpdates[id] = false;
              delete this.inprogressUpdates[id];
            } else {
              // More updates came in, run again.
              return this.applyUpdates<T>(id);
            }
            return updatedDoc as any; // success, exit loop and function
          } catch (e: any) {
            if (e.name === 'conflict' && i < MAX_RETRIES - 1) {
              logger.warn(`Conflict on update for doc ${id}, retry #${i + 1}`);
              await new Promise((res) => setTimeout(res, 50 * Math.random()));
              // continue to next iteration of the loop
            } else if (e.name === 'not_found' && i === 0) {
              // Document not present - throw to caller for initialization
              logger.warn(`Update failed for ${id} - does not exist. Throwing to caller.`);
              throw e; // Let caller handle
            } else {
              // Max retries reached or a non-conflict error
              delete this.inprogressUpdates[id];
              if (this.pendingUpdates[id]) {
                delete this.pendingUpdates[id];
              }
              logger.error(`Error on attemped update (retry ${i}): ${JSON.stringify(e)}`);
              throw e; // Let caller handle
            }
          }
        }
        // This should be unreachable, but it satisfies the compiler that a value is always returned or an error thrown.
        throw new Error(`UpdateQueue failed for doc ${id} after ${MAX_RETRIES} retries.`);
      } else {
        throw new Error(`Empty Updates Queue Triggered`);
      }
    }
  }
}
