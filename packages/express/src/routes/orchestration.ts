import { Router, Request, Response } from 'express';
import Nano from 'nano';
import { requestIsAuthenticated } from '../couchdb/authentication.js';
import { useOrCreateCourseDB, getCouchDB } from '../couchdb/index.js';
import logger from '../logger.js';
import {
  aggregateOutcomesForGradient,
  computeStrategyGradient,
  runPeriodUpdate,
  getDefaultLearnableWeight,
} from '@vue-skuilder/db';
import type {
  UserOutcomeRecord,
  StrategyLearningState,
  PeriodUpdateInput,
} from '@vue-skuilder/db';
import type { ContentNavigationStrategyData } from '@vue-skuilder/db/core';

const router = Router();

/**
 * POST /orchestration/:courseId/update
 *
 * Trigger a period update for all strategies in a course.
 * This aggregates user outcomes and adjusts strategy weights based on gradients.
 *
 * Requires authentication.
 *
 * Query params:
 * - periodStart: ISO timestamp (optional, defaults to 7 days ago)
 * - periodEnd: ISO timestamp (optional, defaults to now)
 */
router.post('/:courseId/update', (req: Request, res: Response) => {
  void (async () => {
    try {
      const auth = await requestIsAuthenticated(req);
      if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { courseId } = req.params;
      const periodEnd = (req.query.periodEnd as string) || new Date().toISOString();
      const periodStart =
        (req.query.periodStart as string) ||
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      logger.info(
        `[Orchestration] Period update requested for course ${courseId} ` +
          `(${periodStart} to ${periodEnd})`
      );

      // 1. Get course DB and strategies
      const courseDB = await useOrCreateCourseDB(courseId);
      const strategiesResp = await courseDB.find({
        selector: { docType: 'NAVIGATION_STRATEGY' },
      });
      const strategies = strategiesResp.docs as unknown as ContentNavigationStrategyData[];

      if (strategies.length === 0) {
        res.json({ message: 'No strategies found', updated: 0 });
        return;
      }

      // 2. Aggregate user outcomes for this course
      // Note: This queries across user DBs - requires admin access
      const outcomes = await aggregateUserOutcomes(courseId, periodStart, periodEnd);

      if (outcomes.length === 0) {
        res.json({ message: 'No outcome records found', updated: 0 });
        return;
      }

      logger.info(`[Orchestration] Found ${outcomes.length} outcome records for ${courseId}`);

      // 3. Process each strategy
      const results = [];

      for (const strategy of strategies) {
        const strategyId = strategy._id;

        // Skip static weight strategies
        if (strategy.staticWeight) {
          logger.debug(`[Orchestration] Skipping static strategy ${strategyId}`);
          continue;
        }

        // Get or create learning state
        let existingState: StrategyLearningState | undefined;
        try {
          existingState = (await courseDB.get(
            `STRATEGY_LEARNING_STATE::${courseId}::${strategyId}`
          )) as unknown as StrategyLearningState;
        } catch {
          // No existing state, that's fine
        }

        // Aggregate observations for this strategy
        const observations = aggregateOutcomesForGradient(outcomes, strategyId);

        if (observations.length < 3) {
          logger.debug(
            `[Orchestration] Insufficient observations for ${strategyId} (${observations.length})`
          );
          continue;
        }

        // Compute gradient
        const gradient = computeStrategyGradient(observations);
        if (!gradient) {
          continue;
        }

        // Get current weight
        const currentWeight = strategy.learnable || getDefaultLearnableWeight();

        // Run update
        const input: PeriodUpdateInput = {
          courseId,
          strategyId,
          currentWeight,
          gradient,
          existingState,
        };

        const result = runPeriodUpdate(input);

        // Persist updated strategy
        if (result.updated) {
          const updatedStrategy = {
            ...strategy,
            learnable: result.newWeight,
          };
          await courseDB.insert(updatedStrategy as unknown as Nano.MaybeDocument);
        }

        // Persist learning state
        await courseDB.insert(result.learningState as unknown as Nano.MaybeDocument);

        results.push({
          strategyId,
          previousWeight: result.previousWeight.weight,
          newWeight: result.newWeight.weight,
          gradient: gradient.gradient,
          rSquared: gradient.rSquared,
          observations: observations.length,
        });
      }

      res.json({
        message: 'Period update complete',
        courseId,
        periodStart,
        periodEnd,
        outcomesProcessed: outcomes.length,
        strategiesUpdated: results.filter((r) => r.previousWeight !== r.newWeight).length,
        results,
      });
    } catch (error) {
      logger.error(`[Orchestration] Period update error: ${error}`);
      res.status(500).json({ error: 'Period update failed', details: String(error) });
    }
  })();
});

/**
 * GET /orchestration/:courseId/state
 *
 * Get current learning state for all strategies in a course.
 */
router.get('/:courseId/state', (req: Request, res: Response) => {
  void (async () => {
    try {
      const { courseId } = req.params;
      const courseDB = await useOrCreateCourseDB(courseId);

      const statesResp = await courseDB.find({
        selector: { docType: 'STRATEGY_LEARNING_STATE' },
      });

      res.json({
        courseId,
        states: statesResp.docs,
      });
    } catch (error) {
      logger.error(`[Orchestration] Get state error: ${error}`);
      res.status(500).json({ error: 'Failed to get state', details: String(error) });
    }
  })();
});

/**
 * GET /orchestration/:courseId/strategy/:strategyId/history
 *
 * Get weight history for a specific strategy.
 */
router.get('/:courseId/strategy/:strategyId/history', (req: Request, res: Response) => {
  void (async () => {
    try {
      const { courseId, strategyId } = req.params;
      const courseDB = await useOrCreateCourseDB(courseId);

      const stateId = `STRATEGY_LEARNING_STATE::${courseId}::${strategyId}`;

      try {
        const state = (await courseDB.get(stateId)) as StrategyLearningState;
        res.json({
          courseId,
          strategyId,
          currentWeight: state.currentWeight,
          regression: state.regression,
          history: state.history,
        });
      } catch {
        res.status(404).json({ error: 'No learning state found for this strategy' });
      }
    } catch (error) {
      logger.error(`[Orchestration] Get history error: ${error}`);
      res.status(500).json({ error: 'Failed to get history', details: String(error) });
    }
  })();
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Aggregate user outcome records across all user databases.
 *
 * This is a server-side operation that requires admin access to query
 * across user databases.
 *
 * TODO: Consider adding a view/index for more efficient querying.
 */
async function aggregateUserOutcomes(
  courseId: string,
  periodStart: string,
  periodEnd: string
): Promise<UserOutcomeRecord[]> {
  const couch = getCouchDB();
  const outcomes: UserOutcomeRecord[] = [];

  try {
    // Get list of all user databases
    const allDbs = await couch.db.list();
    const userDbs = allDbs.filter((db) => db.startsWith('userdb-'));

    logger.debug(`[Orchestration] Scanning ${userDbs.length} user databases for outcomes`);

    for (const dbName of userDbs) {
      try {
        const userDb = couch.use(dbName);

        // Query for outcome records for this course in the time range
        const result = await userDb.find({
          selector: {
            docType: 'USER_OUTCOME',
            courseId,
            periodEnd: {
              $gte: periodStart,
              $lte: periodEnd,
            },
          },
          limit: 1000,
        });

        for (const doc of result.docs) {
          outcomes.push(doc as unknown as UserOutcomeRecord);
        }
      } catch (e) {
        // Skip databases that don't have the index or fail
        logger.debug(`[Orchestration] Skipping ${dbName}: ${e}`);
      }
    }

    return outcomes;
  } catch (error) {
    logger.error(`[Orchestration] Error aggregating outcomes: ${error}`);
    return [];
  }
}

export default router;
