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

  /**
   * Atomically replace all queue contents with new items.
   *
   * Used by mid-session replanning to swap the queue without a window where
   * it's empty (avoiding dead-air if nextCard() is called concurrently).
   *
   * Preserves dequeueCount (cumulative across the session).
   * Resets seenCardIds to match the new contents — cards from the old queue
   * that don't appear in the new set can be re-added in future replans.
   */
  public replaceAll(items: T[], cardIdExtractor: (item: T) => string): void {
    this.q = [];
    this.seenCardIds = [];
    for (const item of items) {
      const cardId = cardIdExtractor(item);
      if (!this.seenCardIds.includes(cardId)) {
        this.seenCardIds.push(cardId);
        this.q.push(item);
      }
    }
  }

  /**
   * Merge new items into the front of the queue, skipping duplicates.
   * Used by additive replans to inject high-quality candidates without
   * discarding the existing queue contents.
   */
  public mergeToFront(items: T[], cardIdExtractor: (item: T) => string): number {
    let added = 0;
    const toInsert: T[] = [];
    for (const item of items) {
      const cardId = cardIdExtractor(item);
      if (!this.seenCardIds.includes(cardId)) {
        this.seenCardIds.push(cardId);
        toInsert.push(item);
        added++;
      }
    }
    this.q.unshift(...toInsert);
    return added;
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