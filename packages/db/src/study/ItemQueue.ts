export class ItemQueue<T> {
  private q: T[] = [];
  private seenCardIds: string[] = [];
  private _dequeueCount: number = 0;
  public get dequeueCount(): number {
    return this._dequeueCount;
  }

  public add(item: T, cardId: string) {
    if (this.seenCardIds.find((d) => d === cardId)) {
      return; // do not re-add a card to the same queue
    }

    this.seenCardIds.push(cardId);
    this.q.push(item);
  }

  public addAll(items: T[], cardIdExtractor: (item: T) => string) {
    items.forEach((i) => this.add(i, cardIdExtractor(i)));
  }

  public get length() {
    return this.q.length;
  }

  public peek(index: number): T {
    return this.q[index];
  }

  public dequeue(cardIdExtractor?: (item: T) => string): T | null {
    if (this.q.length !== 0) {
      this._dequeueCount++;
      const item = this.q.splice(0, 1)[0];

      // Remove cardId from seenCardIds when dequeuing to allow re-queueing
      if (cardIdExtractor) {
        const cardId = cardIdExtractor(item);
        const index = this.seenCardIds.indexOf(cardId);
        if (index > -1) {
          this.seenCardIds.splice(index, 1);
        }
      }

      return item;
    } else {
      return null;
    }
  }

  public get toString(): string {
    return (
      `${typeof this.q[0]}:\n` +
      this.q
        .map((i) => `\t${(i as any).courseID}+${(i as any).cardID}: ${(i as any).status}`)
        .join('\n')
    );
  }
}