// ============================================================================
// USER GOAL NAVIGATOR — STUB
// ============================================================================
//
// STATUS: NOT IMPLEMENTED — This file documents architectural intent only.
//
// ============================================================================
//
// ## Purpose
//
// Goals define WHAT the user wants to learn, as opposed to preferences which
// define HOW they want to learn. Goals affect:
//
// 1. **Content scoping**: Which tags/content are relevant to this user
// 2. **Progress tracking**: ELO is measured against goal-relevant content
// 3. **Completion criteria**: User is "done" when goal mastery is achieved
// 4. **Curriculum composition**: Goals enable cross-curriculum dependencies
//
// ## Goals vs Preferences
//
// | Aspect        | Goal                          | Preference                    |
// |---------------|-------------------------------|-------------------------------|
// | Defines       | Destination (what to learn)   | Path (how to learn)           |
// | Example       | "Master ear-training"         | "Skip text-heavy cards"       |
// | Affects ELO   | Yes — scopes what's tracked   | No — just filters cards       |
// | Completion    | Yes — defines "done"          | No — persists indefinitely    |
// | Filter impl   | UserGoalNavigator             | UserTagPreferenceFilter       |
//
// ## Curriculum Composition
//
// Goals enable software-style composition for curricula. A physics course
// can teach classical mechanics without owning the calculus prerequisites.
//
// Instead, it declares a dependency:
//
// ```typescript
// interface CurriculumDependency {
//   // NPM-style package resolution
//   curriculumId: string;        // e.g., "@skuilder/calculus"
//   version: string;             // e.g., "^2.0.0" (semver)
//
//   // Goal within that curriculum
//   goal: string;                // e.g., "differential-calculus"
//
//   // How this maps to local prerequisites
//   satisfiesLocalTags: string[]; // e.g., ["calculus-prereq"]
// }
// ```
//
// When a physics card requires "calculus-prereq", the system:
// 1. Checks if user has achieved the "differential-calculus" goal in @skuilder/calculus
// 2. If not, defers to that curriculum to teach the prerequisite
// 3. Returns to physics once the goal is satisfied
//
// This allows:
// - Specialized curricula (calculus experts author calculus content)
// - Reusable prerequisites across multiple courses
// - User can bring their own "calculus credential" from prior learning
//
// ## User Goal State (Proposed)
//
// ```typescript
// interface UserGoalState {
//   // Primary goals — what the user wants to achieve
//   targetTags: string[];
//
//   // Excluded goals — content the user explicitly doesn't care about
//   excludedTags: string[];
//
//   // Cross-curriculum goals (for composition)
//   externalGoals?: {
//     curriculumId: string;
//     goal: string;
//     status: 'not-started' | 'in-progress' | 'achieved';
//   }[];
//
//   // When this goal configuration was set
//   updatedAt: string;
// }
// ```
//
// ## Implementation Considerations
//
// 1. **ELO Scoping**: When goals are set, user ELO tracking should focus on
//    goal-relevant tags. This may require changes to ELO update logic.
//
// 2. **Progress Reporting**: UI should show progress toward goals, not just
//    overall course completion.
//
// 3. **Goal Achievement**: Need to define when a goal is "achieved" —
//    probably ELO threshold + mastery percentage on goal-tagged content.
//
// 4. **Curriculum Registry**: For cross-curriculum composition, need a
//    registry/resolver for curriculum packages (similar to npm registry).
//
// 5. **Interaction with HierarchyDefinition**: Goals should work with
//    prerequisite chains — user can't skip prerequisites just because
//    they're not part of their goal.
//
// ## Related Files
//
// - `filters/userTagPreference.ts` — Preferences (path constraints)
// - `hierarchyDefinition.ts` — Prerequisites (enforced regardless of goals)
// - `../types/strategyState.ts` — Storage mechanism for user state
//
// ## Next Steps
//
// 1. Design goal state schema in detail
// 2. Define goal achievement criteria
// 3. Implement goal-scoped ELO tracking
// 4. Build UI for goal configuration
// 5. Design curriculum dependency resolution
//
// ============================================================================

// Placeholder export to make this a valid module
export const USER_GOAL_NAVIGATOR_STUB = true;

/**
 * @stub UserGoalNavigator
 *
 * A navigator that scopes learning to user-defined goals.
 * See module-level documentation for architectural intent.
 *
 * NOT IMPLEMENTED — This is a design placeholder.
 */
export interface UserGoalState {
  /** Tags the user wants to master (defines "success") */
  targetTags: string[];

  /** Tags the user explicitly doesn't care about */
  excludedTags: string[];

  /** ISO timestamp of last update */
  updatedAt: string;
}
