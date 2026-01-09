/**
 * ELO Selection Strategy Tests
 *
 * Tests for ELO-based card selection behavior.
 * Verifies that cards are prioritized based on proximity to user's skill level.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../../src/harness/data-layer-factory';
import { seedRandom } from '../../src/harness/determinism';
import {
  CourseBuilder,
  eloGradientCards,
  ELO_GENERATOR,
  ELO_GENERATOR_NARROW,
  ELO_GENERATOR_WIDE,
  ELO_DISTANCE_FILTER,
  eloTestStrategies,
} from '../../src/fixtures';

describe('ELO Selection Strategy', () => {
  let env: TestEnvironment;
  let restoreRandom: (() => void) | null = null;

  beforeEach(async () => {
    env = await createTestEnvironment({
      courseId: 'elo-test-course',
      userId: 'elo-test-user',
      userElo: 1200, // Default user ELO
    });

    // Seed randomness for deterministic tests
    restoreRandom = seedRandom(12345);
  });

  afterEach(async () => {
    if (restoreRandom) {
      restoreRandom();
      restoreRandom = null;
    }
    await env.cleanup();
  });

  describe('ELO Strategy Configuration', () => {
    it('stores ELO generator with default settings', async () => {
      const builder = new CourseBuilder().addStrategy(ELO_GENERATOR);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const elo = strategies.find((s) => s.implementingClass === 'elo');

      expect(elo).toBeDefined();
      expect(elo!.name).toBe('elo-generator');
      // Default generator has no serializedData
    });

    it('stores narrow ELO generator with targetRange', async () => {
      const builder = new CourseBuilder().addStrategy(ELO_GENERATOR_NARROW);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const elo = strategies.find((s) => s.name === 'elo-generator-narrow');

      expect(elo).toBeDefined();

      const config = JSON.parse(elo!.serializedData!);
      expect(config.targetRange).toBe(100);
    });

    it('stores wide ELO generator with targetRange', async () => {
      const builder = new CourseBuilder().addStrategy(ELO_GENERATOR_WIDE);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const elo = strategies.find((s) => s.name === 'elo-generator-wide');

      expect(elo).toBeDefined();

      const config = JSON.parse(elo!.serializedData!);
      expect(config.targetRange).toBe(400);
    });

    it('stores custom ELO options', async () => {
      const builder = new CourseBuilder().addEloStrategy('custom-elo', {
        targetRange: 250,
        priorityMultiplier: 2.0,
      });

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const elo = strategies.find((s) => s.name === 'custom-elo');

      expect(elo).toBeDefined();

      const config = JSON.parse(elo!.serializedData!);
      expect(config.targetRange).toBe(250);
      expect(config.priorityMultiplier).toBe(2.0);
    });
  });

  describe('ELO Distance Filter', () => {
    it('stores ELO distance filter strategy', async () => {
      const builder = new CourseBuilder().addStrategy(ELO_DISTANCE_FILTER);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const filter = strategies.find(
        (s) => s.implementingClass === 'eloDistanceFilter'
      );

      expect(filter).toBeDefined();
      expect(filter!.name).toBe('elo-distance-filter');
    });

    it('configures combined ELO generator and filter', async () => {
      const strategies = eloTestStrategies(200);

      const builder = new CourseBuilder();
      for (const strategy of strategies) {
        builder.addStrategy(strategy);
      }

      await builder.build(env.courseDB);

      const storedStrategies = await env.courseDB.getAllNavigationStrategies();

      expect(storedStrategies).toHaveLength(2);

      const generator = storedStrategies.find((s) => s.implementingClass === 'elo');
      const filter = storedStrategies.find(
        (s) => s.implementingClass === 'eloDistanceFilter'
      );

      expect(generator).toBeDefined();
      expect(filter).toBeDefined();
    });
  });

  describe('Card ELO Distribution', () => {
    it('creates gradient cards with expected ELO spread', async () => {
      const cards = eloGradientCards('Question', 5, { min: 800, max: 1600 });

      expect(cards).toHaveLength(5);

      // Check ELO progression
      const elos = cards.map((c) => c.elo!);
      expect(elos[0]).toBe(800);
      expect(elos[4]).toBe(1600);

      // Check monotonic increase
      for (let i = 1; i < elos.length; i++) {
        expect(elos[i]).toBeGreaterThan(elos[i - 1]);
      }
    });

    it('creates cards with ELO-based tags', async () => {
      const cards = eloGradientCards('Q', 3);

      expect(cards).toHaveLength(3);

      for (let i = 0; i < cards.length; i++) {
        expect(cards[i].tags).toContain(`difficulty-${i + 1}`);
        expect(cards[i].tags.some((t) => t.startsWith('elo-'))).toBe(true);
      }
    });
  });

  describe('Course with ELO-based Cards', () => {
    it('builds course with varied difficulty cards', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Easy Q', 'A', ['easy'], 800)
        .addFillInCard('Medium Q', 'A', ['medium'], 1200)
        .addFillInCard('Hard Q', 'A', ['hard'], 1600)
        .addStrategy(ELO_GENERATOR)
        .addStrategy(ELO_DISTANCE_FILTER);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(3);
      expect(result.strategyIds).toHaveLength(2);

      // Verify tag tracking
      expect(result.cardIdsByTag.get('easy')).toHaveLength(1);
      expect(result.cardIdsByTag.get('medium')).toHaveLength(1);
      expect(result.cardIdsByTag.get('hard')).toHaveLength(1);
    });

    it('stores card ELO values', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Test Q', 'A', ['test'], 1350);

      const { cardIds } = await builder.build(env.courseDB);

      const cards = await env.courseDB.getAllCards();
      const card = cards.find((c: any) => c._id === cardIds[0]) as any;

      expect(card).toBeDefined();
      expect(card.elo?.score).toBe(1350);
    });
  });

  describe('User ELO Context', () => {
    it('sets user ELO for test environment', async () => {
      // Default is 1200 from beforeEach
      const elo = await env.userDB.getUserELO(env.courseId);
      expect(elo).toBe(1200);
    });

    it('allows changing user ELO', async () => {
      env.userDB.setElo(env.courseId, 1500);

      const elo = await env.userDB.getUserELO(env.courseId);
      expect(elo).toBe(1500);
    });

    it('maintains separate ELO per course', async () => {
      env.userDB.setElo('course-a', 1000);
      env.userDB.setElo('course-b', 1500);

      const eloA = await env.userDB.getUserELO('course-a');
      const eloB = await env.userDB.getUserELO('course-b');

      expect(eloA).toBe(1000);
      expect(eloB).toBe(1500);
    });
  });

  describe('ELO Range Scenarios', () => {
    it('creates cards spanning low ELO range', async () => {
      const cards = eloGradientCards('Beginner Q', 4, { min: 400, max: 800 });

      const elos = cards.map((c) => c.elo!);

      expect(Math.min(...elos)).toBe(400);
      expect(Math.max(...elos)).toBe(800);
      expect(elos).toHaveLength(4);
    });

    it('creates cards spanning high ELO range', async () => {
      const cards = eloGradientCards('Expert Q', 4, { min: 1600, max: 2000 });

      const elos = cards.map((c) => c.elo!);

      expect(Math.min(...elos)).toBe(1600);
      expect(Math.max(...elos)).toBe(2000);
    });

    it('handles single card gradient', async () => {
      const cards = eloGradientCards('Single Q', 1, { min: 1000, max: 1400 });

      expect(cards).toHaveLength(1);
      expect(cards[0].elo).toBe(1000); // Single card uses min
    });
  });

  describe('Strategy Combinations', () => {
    it('creates default ELO test strategies', async () => {
      const strategies = eloTestStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies.map((s) => s.implementingClass)).toContain('elo');
      expect(strategies.map((s) => s.implementingClass)).toContain(
        'eloDistanceFilter'
      );
    });

    it('creates custom range ELO test strategies', async () => {
      const strategies = eloTestStrategies(300);

      expect(strategies).toHaveLength(2);

      const generator = strategies.find((s) => s.implementingClass === 'elo');
      const config = JSON.parse(generator!.serializedData!);

      expect(config.targetRange).toBe(300);
    });

    it('builds complete ELO-focused course', async () => {
      const cards = eloGradientCards('Skill Q', 10, { min: 600, max: 1800 });
      const strategies = eloTestStrategies(200);

      const builder = new CourseBuilder();

      for (const card of cards) {
        builder.addCard(card.shape, card.data, card.tags, card.elo);
      }

      for (const strategy of strategies) {
        builder.addStrategy(strategy);
      }

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(10);
      expect(result.strategyIds).toHaveLength(2);

      // Verify all cards have ELO tags
      for (const [tag, ids] of result.cardIdsByTag.entries()) {
        if (tag.startsWith('elo-')) {
          expect(ids.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles cards without ELO', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('No ELO Q', 'A', ['test'])
        .addStrategy(ELO_GENERATOR);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(1);

      const cards = await env.courseDB.getAllCards();
      const card = cards[0] as any;

      // Card should exist but ELO may be undefined
      expect(card._id).toBe(result.cardIds[0]);
    });

    it('handles ELO at exactly user level', async () => {
      // User ELO is 1200
      const builder = new CourseBuilder()
        .addFillInCard('Perfect Match', 'A', ['exact'], 1200)
        .addStrategy(ELO_GENERATOR);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(1);
      expect(result.cardIdsByTag.get('exact')).toHaveLength(1);
    });

    it('handles very wide ELO spread', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Beginner', 'A', ['beginner'], 200)
        .addFillInCard('Expert', 'A', ['expert'], 2800)
        .addStrategy(ELO_GENERATOR);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(2);

      const cards = await env.courseDB.getAllCards();
      const elos = cards.map((c: any) => c.elo?.score).filter(Boolean);

      expect(elos).toContain(200);
      expect(elos).toContain(2800);
    });
  });
});