/**
 * Tag filter configuration for scoped study sessions.
 *
 * Allows users to focus on specific topics within a course by
 * filtering cards based on their tags.
 */
export interface TagFilter {
  /**
   * Cards must have at least one of these tags to be included.
   * An empty array means no inclusion filter (all cards eligible).
   */
  include: string[];

  /**
   * Cards with any of these tags will be excluded.
   * Applied after inclusion filter.
   */
  exclude: string[];
}

/**
 * Creates an empty TagFilter with no constraints.
 */
export function emptyTagFilter(): TagFilter {
  return {
    include: [],
    exclude: [],
  };
}

/**
 * Checks if a TagFilter has any active constraints.
 */
export function hasActiveFilter(filter: TagFilter | undefined): boolean {
  if (!filter) return false;
  return filter.include.length > 0 || filter.exclude.length > 0;
}
