import type { CourseDBInterface, ContentNavigationStrategyData } from '@vue-skuilder/db';
import {
  NavigatorRoles,
  NavigatorRole,
  Navigators,
} from '@vue-skuilder/db';

// ============================================================================
// TYPES
// ============================================================================

export interface StrategySummary {
  _id: string;
  name: string;
  description: string;
  implementingClass: string;
  role: 'generator' | 'filter' | 'unknown';
  hasLearnableWeight: boolean;
  staticWeight: boolean;
}

export interface StrategiesAllResponse {
  strategies: StrategySummary[];
  total: number;
}

export interface StrategyDetailResponse {
  strategy: ContentNavigationStrategyData;
  role: 'generator' | 'filter' | 'unknown';
  parsedConfig?: object;
}

export interface StrategiesByRoleResponse {
  role: 'generator' | 'filter';
  strategies: StrategySummary[];
  total: number;
}

export interface NavigatorRoleInfo {
  implementingClass: string;
  role: 'generator' | 'filter';
  description: string;
}

export interface AvailableRolesResponse {
  roles: NavigatorRoleInfo[];
  total: number;
}

export interface StrategySchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
}

export interface StrategySchemaResponse {
  implementingClass: string;
  role: 'generator' | 'filter';
  description: string;
  schema?: object;
  example?: object;
  fields?: StrategySchemaField[];
  available: boolean;
}

// ============================================================================
// ROLE LOOKUP HELPERS
// ============================================================================

/**
 * Get the role for an implementing class.
 * Returns 'unknown' if the class is not in the NavigatorRoles registry.
 */
function getRoleForImplementingClass(implementingClass: string): 'generator' | 'filter' | 'unknown' {
  const role = NavigatorRoles[implementingClass as Navigators];
  if (role === NavigatorRole.GENERATOR) return 'generator';
  if (role === NavigatorRole.FILTER) return 'filter';
  return 'unknown';
}

/**
 * Convert a ContentNavigationStrategyData to a StrategySummary
 */
function toStrategySummary(strategy: ContentNavigationStrategyData): StrategySummary {
  return {
    _id: strategy._id,
    name: strategy.name,
    description: strategy.description,
    implementingClass: strategy.implementingClass,
    role: getRoleForImplementingClass(strategy.implementingClass),
    hasLearnableWeight: !!strategy.learnable,
    staticWeight: !!strategy.staticWeight,
  };
}

// ============================================================================
// NAVIGATOR DESCRIPTIONS
// ============================================================================

const NAVIGATOR_DESCRIPTIONS: Record<string, string> = {
  [Navigators.ELO]: 'ELO-based card selection. Selects new cards near the user\'s estimated skill level for optimal challenge.',
  [Navigators.SRS]: 'Spaced Repetition System. Schedules reviews of previously-seen cards based on memory decay models.',
  [Navigators.HIERARCHY]: 'Prerequisite enforcement. Filters cards based on tag prerequisites and mastery thresholds.',
  [Navigators.INTERFERENCE]: 'Interference mitigation. Reduces confusion by avoiding similar-looking or similar-sounding cards when one is not yet mastered.',
  [Navigators.RELATIVE_PRIORITY]: 'Tag priority weighting. Boosts or penalizes cards based on course author priority weights assigned to tags.',
  [Navigators.USER_TAG_PREFERENCE]: 'User preference filtering. Adjusts card weights based on user-expressed tag preferences.',
};

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Schema definitions for each implementing class.
 * These describe the expected structure of serializedData.
 */
const STRATEGY_SCHEMAS: Record<string, Omit<StrategySchemaResponse, 'implementingClass' | 'role' | 'available'>> = {
  [Navigators.ELO]: {
    description: 'ELO navigator configuration. Controls new card selection based on skill matching.',
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    example: {},
    fields: [],
  },
  [Navigators.SRS]: {
    description: 'Spaced Repetition System configuration. Controls review scheduling.',
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    example: {},
    fields: [],
  },
  [Navigators.HIERARCHY]: {
    description: 'Hierarchy definition for prerequisite-based filtering.',
    schema: {
      type: 'object',
      properties: {
        prerequisites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'The tag that has prerequisites' },
              requires: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tag: { type: 'string', description: 'Required prerequisite tag' },
                    threshold: { type: 'number', description: 'Mastery threshold (0-1)' },
                  },
                  required: ['tag', 'threshold'],
                },
              },
            },
            required: ['tag', 'requires'],
          },
        },
      },
      required: ['prerequisites'],
    },
    example: {
      prerequisites: [
        {
          tag: 'advanced-topic',
          requires: [
            { tag: 'basic-topic', threshold: 0.7 },
          ],
        },
      ],
    },
    fields: [
      {
        name: 'prerequisites',
        type: 'array',
        required: true,
        description: 'Array of tag prerequisite definitions',
      },
    ],
  },
  [Navigators.INTERFERENCE]: {
    description: 'Interference mitigation configuration. Prevents confusion between similar items.',
    schema: {
      type: 'object',
      properties: {
        confusionGroups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags that can interfere with each other',
              },
              decayRate: {
                type: 'number',
                description: 'How quickly interference penalty decays (0-1)',
              },
            },
            required: ['tags'],
          },
        },
      },
      required: ['confusionGroups'],
    },
    example: {
      confusionGroups: [
        { tags: ['letter-b', 'letter-d', 'letter-p'], decayRate: 0.8 },
      ],
    },
    fields: [
      {
        name: 'confusionGroups',
        type: 'array',
        required: true,
        description: 'Groups of tags that can interfere with each other during learning',
      },
    ],
  },
  [Navigators.RELATIVE_PRIORITY]: {
    description: 'Relative priority configuration. Weights cards by tag importance.',
    schema: {
      type: 'object',
      properties: {
        priorities: {
          type: 'object',
          additionalProperties: { type: 'number' },
          description: 'Map of tag names to priority weights (0-1)',
        },
      },
      required: ['priorities'],
    },
    example: {
      priorities: {
        'high-frequency': 0.95,
        'common-words': 0.8,
        'rare-words': 0.3,
      },
    },
    fields: [
      {
        name: 'priorities',
        type: 'object',
        required: true,
        description: 'Map of tag names to priority weights (0-1, higher = more important)',
      },
    ],
  },
  [Navigators.USER_TAG_PREFERENCE]: {
    description: 'User tag preference configuration. Adjusts weights based on user preferences.',
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    example: {},
    fields: [],
  },
};

// ============================================================================
// RESOURCE HANDLERS
// ============================================================================

/**
 * Handle strategies://all resource - List all navigation strategies
 */
export async function handleStrategiesAllResource(
  courseDB: CourseDBInterface
): Promise<StrategiesAllResponse> {
  try {
    const strategies = await courseDB.getAllNavigationStrategies();
    const summaries = strategies.map(toStrategySummary);

    return {
      strategies: summaries,
      total: summaries.length,
    };
  } catch (error) {
    console.error('[Strategies] Error fetching all strategies:', error);
    throw new Error(
      `Failed to fetch strategies: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle strategies://{strategyId} resource - Get specific strategy details
 */
export async function handleStrategySpecificResource(
  courseDB: CourseDBInterface,
  strategyId: string
): Promise<StrategyDetailResponse> {
  try {
    const strategy = await courseDB.getNavigationStrategy(strategyId);

    // Attempt to parse serializedData as JSON
    let parsedConfig: object | undefined;
    if (strategy.serializedData) {
      try {
        parsedConfig = JSON.parse(strategy.serializedData);
      } catch {
        // serializedData is not valid JSON, leave parsedConfig undefined
      }
    }

    return {
      strategy,
      role: getRoleForImplementingClass(strategy.implementingClass),
      parsedConfig,
    };
  } catch (error) {
    console.error(`[Strategies] Error fetching strategy ${strategyId}:`, error);
    throw new Error(
      `Failed to fetch strategy ${strategyId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle strategies://role/{roleType} resource - Filter strategies by role
 */
export async function handleStrategiesByRoleResource(
  courseDB: CourseDBInterface,
  roleType: 'generator' | 'filter'
): Promise<StrategiesByRoleResponse> {
  try {
    const strategies = await courseDB.getAllNavigationStrategies();
    const summaries = strategies
      .map(toStrategySummary)
      .filter((s) => s.role === roleType);

    return {
      role: roleType,
      strategies: summaries,
      total: summaries.length,
    };
  } catch (error) {
    console.error(`[Strategies] Error fetching strategies by role ${roleType}:`, error);
    throw new Error(
      `Failed to fetch strategies by role: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle strategies://roles resource - List available strategy types
 */
export async function handleAvailableRolesResource(): Promise<AvailableRolesResponse> {
  const roles: NavigatorRoleInfo[] = Object.entries(NavigatorRoles).map(([impl, role]) => ({
    implementingClass: impl,
    role: role === NavigatorRole.GENERATOR ? 'generator' : 'filter',
    description: NAVIGATOR_DESCRIPTIONS[impl] || `Navigator: ${impl}`,
  }));

  return {
    roles,
    total: roles.length,
  };
}

/**
 * Handle strategies://schema/{implementingClass} resource - Get config schema for a strategy type
 */
export async function handleStrategySchemaResource(
  implementingClass: string
): Promise<StrategySchemaResponse> {
  const role = getRoleForImplementingClass(implementingClass);

  if (role === 'unknown') {
    return {
      implementingClass,
      role: 'filter', // Default, though it's unknown
      description: `Unknown implementing class: ${implementingClass}`,
      available: false,
    };
  }

  const schemaInfo = STRATEGY_SCHEMAS[implementingClass];

  if (!schemaInfo) {
    return {
      implementingClass,
      role,
      description: NAVIGATOR_DESCRIPTIONS[implementingClass] || `Navigator: ${implementingClass}`,
      available: false,
    };
  }

  return {
    implementingClass,
    role,
    available: true,
    ...schemaInfo,
  };
}