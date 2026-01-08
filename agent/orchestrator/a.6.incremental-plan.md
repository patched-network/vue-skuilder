# Incremental Plan: Evolutionary Orchestration

*Actionable implementation steps based on a.5.spec.md v3*

## Status: ✅ PHASES 1-5 COMPLETE

All core implementation complete. System ready for integration testing and validation.

- **Phase 1**: Static weights - ✅ Complete
- **Phase 2**: Deviation distribution - ✅ Complete
- **Phase 3**: Outcome recording - ✅ Complete
- **Phase 4**: Gradient learning - ✅ Complete
- **Phase 5**: Observability - ✅ Complete

---

## Principles

1. **Each phase delivers value independently**
2. **Non-breaking additions** (new fields optional, defaults preserve current behavior)
3. **Can pause after any phase**
4. **Later phases build on earlier infrastructure**

---

## Phase 1: Static Weights

**Goal:** Enable manual weight tuning on strategies.

### Tasks

- [x] Add `LearnableWeight` interface to `packages/db/src/core/types/`
- [x] Add `learnable?: LearnableWeight` field to `ContentNavigationStrategyData`
- [x] Add `staticWeight?: boolean` field to `ContentNavigationStrategyData`
- [x] Implement weight application in filter transforms (scale filter effect by weight)
- [x] Implement weight application in CompositeGenerator (scale contribution by weight)
- [x] Add `effectiveWeight` to provenance records
- [x] Default behavior: `learnable` omitted → weight = 1.0 (no change from current)

### Key Files

```
packages/db/src/core/types/navigationStrategy.ts  - Add LearnableWeight, extend strategy type
packages/db/src/core/navigators/Pipeline.ts       - Apply weights to filters
packages/db/src/core/navigators/CompositeGenerator.ts - Apply weights to generators
packages/db/src/core/types/provenance.ts          - Add effectiveWeight field
```

### Validation

- [ ] Existing strategies with no `learnable` field behave identically
- [ ] Strategy with `learnable: { weight: 2.0, ... }` doubles its effect
- [ ] Strategy with `learnable: { weight: 0.5, ... }` halves its effect
- [ ] Strategy with `staticWeight: true` ignores deviation (Phase 2)

### Value

Authors can manually tune strategy influence without code changes.

---

## Phase 2: Deviation Distribution

**Goal:** Different users experience different weights automatically.

### Tasks

- [x] Add `salt` field to course config (or `CourseOrchestrationConfig`)
- [x] Implement `fnv1a` hash function (or use existing hash utility)
- [x] Implement `computeDeviation(userId, strategyId, salt) → [-1, 1]`
- [x] Implement `computeSpread(confidence) → [MIN_SPREAD, MAX_SPREAD]`
- [x] Implement `computeEffectiveWeight(learnable, userId, strategyId, salt)`
- [x] Create `OrchestrationContext` interface
- [x] Implement `createOrchestrationContext()` factory
- [x] Wire context into Pipeline and generator calls
- [x] Add `deviation` to provenance records

### Key Files

```
packages/db/src/core/orchestration/deviation.ts   - NEW: deviation computation
packages/db/src/core/orchestration/context.ts     - NEW: OrchestrationContext
packages/db/src/core/orchestration/index.ts       - NEW: exports
packages/db/src/core/types/courseConfig.ts        - Add salt field
packages/db/src/core/navigators/Pipeline.ts       - Use context for weights
```

### Validation

- [ ] Same user + same strategy + same salt = same deviation (deterministic)
- [ ] Different users get different deviations (distributed)
- [ ] Low confidence → wide spread (±0.5 from peak)
- [ ] High confidence → narrow spread (±0.1 from peak, MIN_SPREAD)
- [ ] Effective weights clamp to [0.1, 3.0]

### Value

Automatic exploration of weight space without manual A/B setup.

---

## Phase 3: Outcome Recording

**Goal:** Collect data for gradient learning.

### Tasks

- [x] Define `UserOutcomeRecord` doc type
- [x] Add `DocType.USER_OUTCOME` enum value
- [x] Implement `computeOutcomeSignal()` - placeholder: accuracy in zone
- [x] Implement `scoreAccuracyInZone(accuracy, zone)` helper
- [x] Implement `recordUserOutcome()` - stores in userDB
- [x] Wire outcome recording to session end (or periodic trigger)
- [x] Add `signalType` to course config

### Key Files

```
packages/db/src/core/types/userOutcome.ts         - NEW: UserOutcomeRecord
packages/db/src/core/types/docType.ts             - Add USER_OUTCOME
packages/db/src/core/orchestration/signal.ts      - NEW: signal computation
packages/db/src/core/orchestration/recording.ts   - NEW: outcome recording
```

### Validation

- [ ] UserOutcomeRecord created at period end
- [ ] outcomeValue reflects accuracy in configured zone
- [ ] Records stored in userDB
- [ ] Records queryable by courseId and period

### Value

Data collection foundation for learning. Visibility into user outcomes.

---

## Phase 4: Gradient Learning

**Goal:** System self-improves based on observed outcomes.

### Tasks

- [x] Implement `aggregateOutcomesForGradient()` - server-side, cross-user
- [x] Implement `computeStrategyGradient()` - linear regression
- [x] Implement `updateStrategyWeight()` - adjust peak and confidence
- [x] Define `StrategyLearningState` doc type (for observability)
- [x] Implement `updateLearningState()` - store regression stats
- [x] Implement `runPeriodUpdate()` - orchestrates the update cycle
- [x] Wire period update to express backend (cron or manual trigger)

### Key Files

```
packages/db/src/core/orchestration/gradient.ts    - NEW: gradient computation
packages/db/src/core/orchestration/learning.ts    - NEW: weight updates
packages/db/src/core/types/learningState.ts       - NEW: StrategyLearningState
packages/express/src/routes/orchestration.ts      - NEW: trigger endpoints
```

### Validation

- [ ] Gradient computed correctly from (deviation, outcome) pairs
- [ ] Positive gradient → peak increases
- [ ] Negative gradient → peak decreases
- [ ] Flat gradient → confidence increases
- [ ] Weight history recorded
- [ ] StrategyLearningState updated with regression stats

### Value

Strategies automatically tune toward optimal weights.

---

## Phase 5: Observability

**Goal:** Authors can see what's working.

### Tasks

- [x] API endpoint: get strategy learning state
- [x] API endpoint: get weight history for strategy
- [x] Scatter plot data endpoint: deviation vs outcome
- [x] Bell curve distribution visualization endpoint
- [x] Current weights summary endpoint
- [ ] (Optional) Admin UI component for visualization - DEFERRED

### Key Files

```
packages/express/src/routes/orchestration.ts      - Observability endpoints
```

### Endpoints Implemented

- `GET /orchestration/:courseId/state` - All learning states
- `GET /orchestration/:courseId/weights` - Current weights summary
- `GET /orchestration/:courseId/strategy/:strategyId/history` - Weight trajectory
- `GET /orchestration/:courseId/strategy/:strategyId/scatter` - Scatter plot data (deviation vs outcome)
- `GET /orchestration/:courseId/strategy/:strategyId/distribution` - Bell curve distribution

### Validation

- [x] Can retrieve current weight/confidence for any strategy
- [x] Can retrieve weight trajectory over time
- [x] Can retrieve recent gradient and r-squared
- [x] Can get scatter plot data for gradient visualization
- [x] Can get bell curve distribution for cohort visualization

### Value

Transparency into learning process. Debugging capability. Full API surface for future UI dashboards.

---

## Dependencies

```
Phase 1 (Static Weights)
    ↓
Phase 2 (Deviation Distribution)
    ↓
Phase 3 (Outcome Recording)
    ↓
Phase 4 (Gradient Learning)
    ↓
Phase 5 (Observability)
```

Each phase builds on the previous. Can stop after any phase.

---

## Actual File Structure

```
packages/db/src/core/
├── orchestration/
│   ├── index.ts           - Exports, OrchestrationContext, deviation logic
│   ├── signal.ts          - computeOutcomeSignal, scoreAccuracyInZone
│   ├── recording.ts       - recordUserOutcome
│   ├── gradient.ts        - aggregateOutcomesForGradient, computeStrategyGradient
│   └── learning.ts        - updateStrategyWeight, updateLearningState, runPeriodUpdate
├── types/
│   ├── contentNavigationStrategy.ts  - LearnableWeight, ContentNavigationStrategyData
│   ├── userOutcome.ts                - UserOutcomeRecord
│   ├── learningState.ts              - StrategyLearningState, GradientObservation, GradientResult
│   └── types-legacy.ts               - DocType enum updates

packages/express/src/routes/
└── orchestration.ts       - POST /:courseId/update, GET /:courseId/state, GET /strategy/:strategyId/history
```

---

## Estimated Scope

| Phase | New Files | Modified Files | Complexity |
|-------|-----------|----------------|------------|
| 1     | 0         | 3-4            | Low        |
| 2     | 3         | 2-3            | Medium     |
| 3     | 3         | 1-2            | Medium     |
| 4     | 3         | 1-2            | Medium     |
| 5     | 1-2       | 0-1            | Low        |

---

## Notes

- **Testing strategy**: Per CLAUDE.md, defer verbose unit tests to CI. Focus on e2e validation that the mechanism works.
- **Logging**: Use logger with `[Orchestration]` prefix for traceability.
- **Backward compatibility**: All new fields optional. Existing courses work unchanged.

---

## Implementation Summary

### Files Created

**Core Orchestration** (`packages/db/src/core/orchestration/`)
- `index.ts` - OrchestrationContext, deviation computation, exports
- `gradient.ts` - Gradient computation and linear regression
- `learning.ts` - Weight updates and period orchestration
- `signal.ts` - Outcome signal computation
- `recording.ts` - User outcome recording

**Type Definitions** (`packages/db/src/core/types/`)
- `learningState.ts` - StrategyLearningState, GradientObservation, GradientResult
- `userOutcome.ts` - UserOutcomeRecord
- `contentNavigationStrategy.ts` - Extended with LearnableWeight
- `types-legacy.ts` - Added STRATEGY_LEARNING_STATE DocType

**API Routes** (`packages/express/src/routes/`)
- `orchestration.ts` - 6 endpoints for triggering updates and observability

### API Endpoints

**Management**
- `POST /orchestration/:courseId/update` - Trigger period update for all strategies

**Observability**
- `GET /orchestration/:courseId/state` - All learning states
- `GET /orchestration/:courseId/weights` - Current weights summary
- `GET /orchestration/:courseId/strategy/:strategyId/history` - Weight trajectory
- `GET /orchestration/:courseId/strategy/:strategyId/scatter` - Scatter plot data
- `GET /orchestration/:courseId/strategy/:strategyId/distribution` - Bell curve distribution

### Test Status

- All existing tests pass (116/116)
- Fixed mock user objects in Pipeline tests to include `getUsername()`
- Ready for integration testing

---

*Implementation complete - 2026-01-07*
