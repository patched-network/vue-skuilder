// ============================================================================
// INFERRED PREFERENCE NAVIGATOR — STUB
// ============================================================================
//
// STATUS: NOT IMPLEMENTED — This file documents architectural intent only.
//
// ============================================================================
//
// ## Purpose
//
// Inferred preferences are learned from user behavior, as opposed to explicit
// preferences which are configured via UI. The system observes patterns in
// user interactions and adjusts card selection accordingly.
//
// ## Inference Signals
//
// Potential signals to learn from:
//
// 1. **Card dismissal patterns**: User consistently skips certain card types
// 2. **Time-on-card**: User spends less time on certain content (boredom?)
// 3. **Error patterns**: User struggles with certain presentation styles
// 4. **Session timing**: User performs better at certain times of day
// 5. **Tag success rates**: User masters some tags faster than others
//
// ## Inferred State (Proposed)
//
// ```typescript
// interface InferredPreferenceState {
//   // Learned tag affinities (positive = user does well, negative = struggles)
//   tagAffinities: Record<string, number>;
//
//   // Presentation style preferences
//   preferredStyles: {
//     visualVsText: number;     // -1 to 1 (negative = text, positive = visual)
//     shortVsLong: number;      // -1 to 1 (negative = long, positive = short)
//   };
//
//   // Temporal patterns
//   optimalSessionLength: number;  // minutes
//   optimalTimeOfDay: number;      // hour (0-23)
//
//   // Confidence in inferences
//   sampleSize: number;
//   lastUpdated: string;
// }
// ```
//
// ## Relationship to Explicit Preferences
//
// - Explicit preferences (UserTagPreferenceFilter) always take precedence
// - Inferred preferences act as soft suggestions when no explicit pref exists
// - User can "lock in" an inference as an explicit preference via UI
// - User can dismiss/override an inference ("I actually like text cards")
//
// ## Transparency Requirements
//
// Inferred preferences must be:
//
// 1. **Visible**: User can see what the system has inferred
// 2. **Explainable**: "We noticed you master visual cards faster"
// 3. **Overridable**: User can disable or invert any inference
// 4. **Forgettable**: User can reset inferences and start fresh
//
// ## Implementation Considerations
//
// 1. **Cold start**: Need minimum sample size before inferring
// 2. **Drift**: Preferences may change over time; use decay/recency weighting
// 3. **Privacy**: Inference data is personal; handle with care
// 4. **Bias**: Avoid reinforcing accidental patterns as permanent preferences
//
// ## Related Files
//
// - `filters/userTagPreference.ts` — Explicit preferences (takes precedence)
// - `userGoal.ts` — Goals (destination, not path)
// - `../types/strategyState.ts` — Storage mechanism
//
// ## Next Steps
//
// 1. Define minimum viable inference signals
// 2. Design inference algorithms (simple heuristics vs ML)
// 3. Build transparency UI ("Here's what we learned about you")
// 4. Implement override/dismiss mechanism
// 5. Add to card record collection for inference input
//
// ============================================================================

// Placeholder export to make this a valid module
export const INFERRED_PREFERENCE_NAVIGATOR_STUB = true;

/**
 * @stub InferredPreferenceNavigator
 *
 * A navigator that learns user preferences from behavior patterns.
 * See module-level documentation for architectural intent.
 *
 * NOT IMPLEMENTED — This is a design placeholder.
 */
export interface InferredPreferenceState {
  /** Learned affinity scores per tag (-1 to 1) */
  tagAffinities: Record<string, number>;

  /** Number of card interactions used to build inferences */
  sampleSize: number;

  /** ISO timestamp of last inference update */
  updatedAt: string;
}
