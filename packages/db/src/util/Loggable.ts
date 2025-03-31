export abstract class Loggable {
  protected abstract readonly _className: string;
  protected log(...args: unknown[]) {
    console.log(`LOG-${this._className}@${new Date()}:`, ...args);
  }
  protected error(...args: unknown[]) {
    console.error(`ERROR-${this._className}@${new Date()}:`, ...args);
  }
}
