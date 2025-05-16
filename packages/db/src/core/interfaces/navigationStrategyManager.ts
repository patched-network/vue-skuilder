import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';

/**
 * A NavigationStrategyManager is an entity which may contain multiple strategies.
 *
 * This interface defines strategy CRUD.
 */
export interface NavigationStrategyManager {
  /**
   * Get the navigation strategy for a given course
   * @returns The navigation strategy for the course
   */
  getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData>;

  /**
   * Get all available navigation strategies
   * @returns An array of all available navigation strategies
   */
  getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]>;

  /**
   * Add a new navigation strategy
   * @param data The data for the new navigation strategy
   * @returns A promise that resolves when the strategy has been added
   */
  addNavigationStrategy(data: ContentNavigationStrategyData): Promise<void>;

  /**
   * Update an existing navigation strategy
   * @param id The ID of the navigation strategy to update
   * @param data The new data for the navigation strategy
   * @returns A promise that resolves when the update is complete
   */
  updateNavigationStrategy(id: string, data: ContentNavigationStrategyData): Promise<void>;

  /**
   * @returns A content navigation strategy suitable to the current context.
   */
  surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData>;

  // [ ] addons here like:
  //     - determining Navigation Strategy from context of current user
  //     - determining weighted averages of navigation strategies
  //     - expressing A/B testing results of 'ecosystem of strategies'
  //     - etc etc
}
