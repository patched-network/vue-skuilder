import { describe, it, expect } from 'vitest';
import { ItemQueue } from './ItemQueue';

type Item = { cardID: string };
const id = (i: Item) => i.cardID;
const item = (cardID: string): Item => ({ cardID });
const ids = (q: ItemQueue<Item>): string[] =>
  Array.from({ length: q.length }, (_, i) => q.peek(i).cardID);

describe('ItemQueue.mergeToFront', () => {
  it('adds new items to the front, preserving batch order', () => {
    const q = new ItemQueue<Item>();
    q.addAll([item('a'), item('b')], id);

    const added = q.mergeToFront([item('x'), item('y')], id);

    expect(added).toBe(2);
    expect(ids(q)).toEqual(['x', 'y', 'a', 'b']);
  });

  it('skips an ordinary duplicate, leaving it in place', () => {
    const q = new ItemQueue<Item>();
    q.addAll([item('a'), item('b'), item('c')], id);

    // 'b' already queued and not mandatory → left where it is; 'x' fronted.
    const added = q.mergeToFront([item('x'), item('b')], id);

    expect(added).toBe(1);
    expect(ids(q)).toEqual(['x', 'a', 'b', 'c']);
  });

  it('re-fronts an already-queued mandatory card instead of burying it', () => {
    // Repro of the require-card burial: 'req' was fronted by a prior burst
    // replan, then an additive merge brings fresh non-required cards. Without
    // the mandatory re-front, 'x'/'y' would leapfrog 'req' and sink it.
    const q = new ItemQueue<Item>();
    q.addAll([item('req'), item('a'), item('b')], id);

    const added = q.mergeToFront(
      [item('req'), item('x'), item('y')],
      id,
      new Set(['req'])
    );

    // 'req' is not a *new* add, so it isn't counted...
    expect(added).toBe(2);
    // ...but it leads the queue (ahead of the freshly merged 'x'/'y').
    expect(ids(q)).toEqual(['req', 'x', 'y', 'a', 'b']);
    // and isn't duplicated.
    expect(ids(q).filter((c) => c === 'req')).toHaveLength(1);
  });

  it('keeps a mandatory card already at the front at the front', () => {
    const q = new ItemQueue<Item>();
    q.addAll([item('req'), item('a')], id);

    q.mergeToFront([item('req'), item('x')], id, new Set(['req']));

    expect(ids(q)).toEqual(['req', 'x', 'a']);
  });

  it('without forceFrontIds, preserves the legacy skip-duplicate behavior', () => {
    const q = new ItemQueue<Item>();
    q.addAll([item('req'), item('a')], id);

    // No mandatory set → 'req' stays put and is buried behind the merged 'x'.
    q.mergeToFront([item('req'), item('x')], id);

    expect(ids(q)).toEqual(['x', 'req', 'a']);
  });
});
