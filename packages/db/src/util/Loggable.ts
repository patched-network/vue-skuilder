export abstract class Loggable {
  protected abstract readonly _className: string;
  protected log(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(`LOG-${this._className}@${new Date()}:`, ...args);
  }
  protected error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(`ERROR-${this._className}@${new Date()}:`, ...args);
  }
}
