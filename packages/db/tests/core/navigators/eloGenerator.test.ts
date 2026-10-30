import { describe, it, expect, vi } from 'vitest';
import ELONavigator from '../../../src/core/navigators/generators/elo';
import type { CourseDBInterface } from '../../../src/core/interfaces/courseDB';
import type { UserDBInterface } from '../../../src/core/interfaces/userDB';

// The generator's retrieval window must be centred on the ELO of the user it
// runs for, passed explicitly, never resolved by the course DB from its own
// notion of the current user (`elo: 'user'`).

function setup() {
  const getCardsCenteredAtELO = vi.fn().mockResolvedValue([]);
  const course = {
    getCourseID: () => 'c1',
    getCardsCenteredAtELO,
  } as unknown as CourseDBInterface;
  const user = {
    getCourseRegDoc: vi.fn().mockResolvedValue({ courseID: 'c1', elo: 1234 }),
    getActiveCards: vi.fn().mockResolvedValue([]),
    getSeenCards: vi.fn().mockResolvedValue([]),
  } as unknown as UserDBInterface;
  return { gen: new ELONavigator(user, course), getCardsCenteredAtELO };
}

describe('ELONavigator retrieval', () => {
  it("centres on the pipeline context's user ELO", async () => {
    const { gen, getCardsCenteredAtELO } = setup();
    await gen.getWeightedCards(5, { userElo: 987 } as never);
    expect(getCardsCenteredAtELO.mock.calls[0][0]).toEqual({ limit: 5, elo: 987 });
  });

  it("falls back to its own user's registration, not the course DB's current user", async () => {
    const { gen, getCardsCenteredAtELO } = setup();
    await gen.getWeightedCards(5);
    expect(getCardsCenteredAtELO.mock.calls[0][0]).toEqual({ limit: 5, elo: 1234 });
  });
});
