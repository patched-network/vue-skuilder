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
      // console.log(`Updates in progress...`);
      await this.readDB.info(); // stall for a round trip
      // console.log(`Retrying...`);
      return this.applyUpdates<T>(id);
    } else {
      if (this.pendingUpdates[id] && this.pendingUpdates[id].length > 0) {
        this.inprogressUpdates[id] = true;

        try {
          let doc = await this.readDB.get<T>(id);
          logger.debug(`Retrieved doc: ${id}`);
          while (this.pendingUpdates[id].length !== 0) {
            const update = this.pendingUpdates[id].splice(0, 1)[0];
            if (typeof update === 'function') {
              doc = { ...doc, ...update(doc) };
            } else {
              doc = {
                ...doc,
                ...update,
              };
            }
          }
          // for (const k in doc) {
          //   console.log(`${k}: ${typeof k}`);
          // }
          // console.log(`Applied updates to doc: ${JSON.stringify(doc)}`);
          await this.writeDB.put<T>(doc);
          logger.debug(`Put doc: ${id}`);

          if (this.pendingUpdates[id].length === 0) {
            this.inprogressUpdates[id] = false;
            delete this.inprogressUpdates[id];
          } else {
            return this.applyUpdates<T>(id);
          }
          return doc;
        } catch (e) {
          // Clean up queue state before re-throwing
          delete this.inprogressUpdates[id];
          if (this.pendingUpdates[id]) {
            delete this.pendingUpdates[id];
          }
          logger.error(`Error on attemped update: ${JSON.stringify(e)}`);
          throw e; // Let caller handle (e.g., putCardRecord's 404 handling)
        }
      } else {
        throw new Error(`Empty Updates Queue Triggered`);
      }
    }
  }
}
