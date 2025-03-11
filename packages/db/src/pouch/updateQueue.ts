import { Loggable } from '../core/Loggable';

export type Update<T> = Partial<T> | ((x: T) => T);

export default class UpdateQueue extends Loggable {
  _className: string = 'UpdateQueue';
  private pendingUpdates: {
    [index: string]: Update<unknown>[];
  } = {};
  private inprogressUpdates: {
    [index: string]: boolean;
  } = {};

  private db: PouchDB.Database;

  public update<T extends PouchDB.Core.Document<object>>(
    id: PouchDB.Core.DocumentId,
    update: Update<T>
  ) {
    console.log(`Update requested on doc: ${id}`);
    if (this.pendingUpdates[id]) {
      this.pendingUpdates[id].push(update);
    } else {
      this.pendingUpdates[id] = [update];
    }
    return this.applyUpdates<T>(id);
  }

  constructor(db: PouchDB.Database) {
    super();
    // PouchDB.debug.enable('*');
    this.db = db;
    console.log(`UpdateQ initialized...`);
    this.db.info().then((i) => {
      console.log(`db info: ${JSON.stringify(i)}`);
    });
  }

  private async applyUpdates<T extends PouchDB.Core.Document<object>>(id: string): Promise<T> {
    console.log(`Applying updates on doc: ${id}`);
    if (this.inprogressUpdates[id]) {
      // console.log(`Updates in progress...`);
      await this.db.info(); // stall for a round trip
      // console.log(`Retrying...`);
      return this.applyUpdates<T>(id);
    } else {
      if (this.pendingUpdates[id] && this.pendingUpdates[id].length > 0) {
        this.inprogressUpdates[id] = true;

        try {
          let doc = await this.db.get<T>(id);
          console.log(`Retrieved doc: ${id}`);
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
          await this.db.put<T>(doc);
          console.log(`Put doc: ${id}`);

          if (this.pendingUpdates[id].length === 0) {
            this.inprogressUpdates[id] = false;
            delete this.inprogressUpdates[id];
          } else {
            return this.applyUpdates<T>(id);
          }
          return doc;
        } catch (e) {
          delete this.inprogressUpdates[id];
          console.log(`Error on attemped update: ${JSON.stringify(e)}`);
          throw e;
        }
      } else {
        throw new Error(`Empty Updates Queue Triggered`);
      }
    }
  }
}
