// Resource registry and exports
export * from './course.js';
export * from './cards.js';
export * from './shapes.js';
export * from './tags.js';

// Resource URI patterns
export const RESOURCE_PATTERNS = {
  COURSE_CONFIG: 'course://config',
  CARDS_ALL: 'cards://all',
  CARDS_TAG: 'cards://tag/{tagName}',
  CARDS_SHAPE: 'cards://shape/{shapeName}',
  CARDS_ELO: 'cards://elo/{eloRange}',
  SHAPES_ALL: 'shapes://all',
  SHAPES_SPECIFIC: 'shapes://{shapeName}',
  TAGS_ALL: 'tags://all',
  TAGS_STATS: 'tags://stats',
  TAGS_SPECIFIC: 'tags://{tagName}',
  TAGS_UNION: 'tags://union/{tags}',
  TAGS_INTERSECT: 'tags://intersect/{tags}',
  TAGS_EXCLUSIVE: 'tags://exclusive/{tags}',
  TAGS_DISTRIBUTION: 'tags://distribution',
} as const;