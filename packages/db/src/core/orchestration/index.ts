import type { UserDBInterface } from '../interfaces/userDB';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { LearnableWeight } from '../types/contentNavigationStrategy';
import type { CourseOrchestrationConfig } from '@vue-skuilder/common';
import { logger } from '../../util/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context for orchestration decisions during a session.
 * 
 * Provides access to user/course data and helper methods for determining
 * effective strategy weights based on the user's cohort assignment.
 */
export interface OrchestrationContext {
  user: UserDBInterface;
  course: CourseDBInterface;
  userId: string;
  courseConfig: { orchestration?: CourseOrchestrationConfig };
  
  /**
   * Calculate the effective weight for a strategy for this user.
   * 
   * Applies deviation based on the user's cohort assignment (derived from
   * userId, strategyId, and course salt).
   * 
   * @param strategyId - Unique ID of the strategy
   * @param learnable - The strategy's learning configuration
   * @returns Effective weight multiplier (typically 0.1 - 3.0)
   */
  getEffectiveWeight(strategyId: string, learnable: LearnableWeight): number;

  /**
   * Get the deviation factor for this user/strategy.
   * Range [-1.0, 1.0].
   */
  getDeviation(strategyId: string): number;
}

// ============================================================================
// DEVIATION LOGIC
// ============================================================================

const MIN_SPREAD = 0.1;
const MAX_SPREAD = 0.5;
const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 3.0;

/**
 * FNV-1a hash implementation for deterministic distribution.
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Compute a user's deviation for a specific strategy.
 * 
 * Returns a value in [-1, 1] that is:
 * 1. Deterministic for the same (user, strategy, salt) tuple
 * 2. Uniformly distributed across users
 * 3. Uncorrelated between different strategies (due to strategyId in hash)
 * 4. Rotatable by changing the salt
 * 
 * @param userId - ID of the user
 * @param strategyId - ID of the strategy
 * @param salt - Random seed from course config
 * @returns Deviation factor between -1.0 and 1.0
 */
export function computeDeviation(userId: string, strategyId: string, salt: string): number {
  const input = `${userId}:${strategyId}:${salt}`;
  const hash = fnv1a(input);
  
  // Normalize 32-bit unsigned integer to [0, 1]
  const normalized = hash / 4294967296;
  
  // Map [0, 1] to [-1, 1]
  return (normalized * 2) - 1;
}

/**
 * Compute the exploration spread based on confidence.
 * 
 * - Low confidence (0.0) -> Max spread (Explore broadly)
 * - High confidence (1.0) -> Min spread (Exploit known good weight)
 * 
 * @param confidence - Confidence level 0-1
 * @returns Spread magnitude (half-width of the distribution)
 */
export function computeSpread(confidence: number): number {
  // Linear interpolation: confidence 0 -> MAX_SPREAD, confidence 1 -> MIN_SPREAD
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  return MAX_SPREAD - (clampedConfidence * (MAX_SPREAD - MIN_SPREAD));
}

/**
 * Calculate the effective weight for a strategy instance.
 * 
 * Combines the learnable weight (peak) with the user's deviation and the
 * allowed spread (based on confidence).
 * 
 * @param learnable - Strategy learning config
 * @param userId - User ID
 * @param strategyId - Strategy ID
 * @param salt - Course salt
 * @returns Effective weight multiplier
 */
export function computeEffectiveWeight(
  learnable: LearnableWeight,
  userId: string,
  strategyId: string,
  salt: string
): number {
  const deviation = computeDeviation(userId, strategyId, salt);
  const spread = computeSpread(learnable.confidence);
  
  // Apply deviation: effective = weight + (deviation * spread * weight)
  // We scale the spread relative to the weight itself so it's proportional.
  // e.g. weight 2.0, deviation -0.5, spread 0.2 -> 2.0 + (-0.5 * 0.2 * 2.0) = 1.8
  const adjustment = deviation * spread * learnable.weight;
  
  const effective = learnable.weight + adjustment;
  
  // Clamp to sane bounds to prevent runaway weights or negative multipliers
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, effective));
}

// ============================================================================
// CONTEXT FACTORY
// ============================================================================

/**
 * Create an orchestration context for a study session.
 * 
 * Fetches necessary configuration to enable deterministic weight calculation.
 * 
 * @param user - User DB interface
 * @param course - Course DB interface
 * @returns Initialized orchestration context
 */
export async function createOrchestrationContext(
  user: UserDBInterface,
  course: CourseDBInterface
): Promise<OrchestrationContext> {
  let courseConfig;
  try {
    courseConfig = await course.getCourseConfig();
  } catch (e) {
    logger.error(`[Orchestration] Failed to load course config: ${e}`);
    // Fallback stub if config load fails
    courseConfig = { name: 'Unknown', orchestration: { salt: 'default' } };
  }

  const userId = user.getUsername(); // Or user ID if available on interface
  const salt = courseConfig.orchestration?.salt || 'default_salt';

  return {
    user,
    course,
    userId,
    courseConfig,
    
    getEffectiveWeight(strategyId: string, learnable: LearnableWeight): number {
      return computeEffectiveWeight(learnable, userId, strategyId, salt);
    },

    getDeviation(strategyId: string): number {
      return computeDeviation(userId, strategyId, salt);
    }
  };
}