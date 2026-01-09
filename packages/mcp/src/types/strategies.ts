import { z } from 'zod';

// ============================================================================
// LEARNABLE WEIGHT SCHEMA
// ============================================================================

export const LearnableWeightSchema = z.object({
  /** The current best estimate of optimal weight (multiplier) */
  weight: z.number().positive(),
  /** Confidence in this weight (0-1). Higher = narrower exploration spread. */
  confidence: z.number().min(0).max(1),
  /** Number of outcome observations that contributed to this weight */
  sampleSize: z.number().int().nonnegative(),
});

export type LearnableWeightInput = z.infer<typeof LearnableWeightSchema>;

// ============================================================================
// CREATE STRATEGY INPUT SCHEMA
// ============================================================================

/**
 * MCP-compatible plain object schema for the create_strategy tool.
 * Used by the MCP SDK for tool registration.
 */
export const CreateStrategyInputMCPSchema = {
  name: z.string().min(1).describe('Human-readable name for the strategy'),
  description: z.string().describe('Description explaining the strategy\'s purpose'),
  implementingClass: z.string().describe('Valid NavigatorRoles key (e.g., "elo", "srs", "hierarchyDefinition")'),
  serializedData: z.string().optional().describe('Optional JSON configuration for the strategy'),
  learnable: LearnableWeightSchema.optional().describe('Optional evolutionary tuning configuration'),
  staticWeight: z.boolean().optional().describe('If true, weight is applied exactly without per-user deviation'),
};

/**
 * Zod schema for runtime validation of create_strategy input.
 */
export const CreateStrategyInputSchema = z.object(CreateStrategyInputMCPSchema);

export type CreateStrategyInput = z.infer<typeof CreateStrategyInputSchema>;

// ============================================================================
// CREATE STRATEGY OUTPUT
// ============================================================================

export interface CreateStrategyOutput {
  success: boolean;
  strategyId: string;
  message: string;
}