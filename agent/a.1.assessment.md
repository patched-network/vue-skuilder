# Assessment: NavigationStrategy Orchestrator and Advanced Strategies

## Executive Summary

This assessment evaluates the feasibility of implementing:
1. **InterferenceMitigator** - A NavigationStrategy to identify and mitigate learning interference
2. **HierarchyDefinition** - A NavigationStrategy to enforce prerequisite structures
3. **Strategy Orchestrator** - A wrapper that can consume multiple strategies, weigh their opinions, and produce a unified output

**TL;DR**: All three are highly feasible. The existing architecture is well-designed for extension. The orchestrator pattern is explicitly anticipated in the codebase TODOs. The required infrastructure (tag system, ELO tracking, SRS intervals, card history) exists and is production-ready.

## Current Architecture: Deep Dive

### 1. NavigationStrategy System Overview

The system uses a **Strategy Pattern** with dynamic loading:

```typescript
// Storage (DB): ContentNavigationStrategyData
{
  _id: "NAVIGATION_STRATEGY-custom",
  implementingClass: "elo" | "hardcodedOrder" | "interference" | ...,
  serializedData: "{ /* strategy config */ }"
}

// Runtime: ContentNavigator abstract class
abstract class ContentNavigator {
  abstract getNewCards(limit?: number): Promise<StudySessionNewItem[]>;
  abstract getPendingReviews(): Promise<StudySessionReviewItem[]>;
}

// Instantiation: Dynamic import factory
ContentNavigator.create(user, course, strategyData)
  → import(`./${implementingClass}`)
  → new NavigatorImpl(user, course, strategyData)
```

**Key Files**:
- Schema: `packages/db/src/core/types/contentNavigationStrategy.ts:7-22`
- Interface: `packages/db/src/core/navigators/index.ts:20-58`
- Hook: `packages/db/src/impl/couch/courseDB.ts:522-594`

### 2. Existing Implementations

#### A. ELONavigator (Default)
**File**: `packages/db/src/core/navigators/elo.ts`

**New Cards**: Uses `course.getCardsCenteredAtELO(userElo)` - matches card difficulty to user skill
**Reviews**: Sorts by difficulty (easiest first) to build confidence

**Strength**: Adaptive difficulty matching via dual-dynamic ELO system
**Limitation**: No concept dependencies, no interference awareness

#### B. HardcodedOrderNavigator
**File**: `packages/db/src/core/navigators/hardcodedOrder.ts`

**New Cards**: Linear sequence from `serializedData` array of card IDs
**Reviews**: Delegates to standard SRS

**Strength**: Explicit sequencing for tutorial content
**Limitation**: Static, doesn't adapt to user performance patterns

### 3. Session Orchestration Context

The `SessionController` manages three queues with **time-aware probability distribution**:

```typescript
// Dynamic queue weighting based on time remaining
newQ:      10% → 50% → 5% → 1%    (plenty time → crunch time)
reviewQ:   65% → 40% → 85% → 9%
failedQ:   25% → 10% → 10% → 90%  (cleanup phase)
```

**Location**: `packages/db/src/study/SessionController.ts:315-385`

**Key Insight**: NavigationStrategies populate queues, but SessionController orchestrates the *timing* and *interleaving* of card presentation. Interference mitigation operates at the strategy level (which cards enter queues) while SessionController handles temporal spacing.

### 4. Available Data Infrastructure

#### A. Tag System
**Location**: `packages/db/src/impl/couch/courseDB.ts:795-899`

**Key Capabilities**:
- `getAppliedTags(cardId)` - Get all tags on a card
- `getCourseTagStubs()` - Get all tags with card counts
- `addTagToCard(cardId, tagId, updateELO?)` - Tag management

**Data Structure**:
```typescript
interface Tag {
  name: string;
  taggedCards: PouchDB.Core.DocumentId[];  // Bidirectional link
}
```

**Strength**: Bidirectional tag-card relationship enables both "cards with tag" and "tags on card" queries
**Opportunity**: No tag-to-tag relationship data (prerequisites, interference patterns)

#### B. ELO System
**Location**: `packages/db/src/impl/couch/courseDB.ts:173-647`

**Multi-Dimensional Tracking**:
```typescript
type CourseElo = {
  global: EloRank;           // Overall skill/difficulty
  tags: {                     // Per-tag performance
    [tagID: string]: EloRank;
  };
};

type EloRank = {
  score: number;  // ~1000 rating
  count: number;  // Interaction count (confidence)
};
```

**Key Methods**:
- `getCardsCenteredAtELO(elo, filter?)` - Get cards near skill level
- `getCardEloData(cardIds)` - Batch ELO fetch
- `updateCardElo(cardId, elo)` - Update difficulty

**Status**: Per-tag ELO is **tracked but not yet used** for card selection (pedagogy.md:59-67)
**Opportunity**: Tag-specific ELO enables detecting weak skills (interference diagnosis)

#### C. Card History & Performance
**Location**: `packages/db/src/study/services/ResponseProcessor.ts`

**Available Metrics**:
```typescript
interface QuestionRecord {
  isCorrect: boolean;        // Pass/fail
  performance: number;       // Continuous [0,1] with time penalty
  priorAttemps: number;      // Retry count
  timeStamp: Moment;         // Temporal data
}

interface CardHistory {
  records: QuestionRecord[];
  lapses: number;            // Total failures
  streak: number;            // Current success streak
  bestInterval: number;      // Longest successful gap
}
```

**Key Insight**: Rich performance data enables mastery detection and interference diagnosis

#### D. SRS Scheduling
**Location**: `packages/db/src/study/SpacedRepetition.ts:20-68`

**Algorithm**:
```typescript
// Base interval scaled by performance
interval = lastSuccessfulInterval * (0.75 + performance)

// Weighted by historical performance
finalInterval = (lapses * currentInterval + streak * bestInterval)
                / (lapses + streak)
```

**Initial Interval**: 3 days (hardcoded - line 113)
**Minimum Interval**: 20 hours (line 81)

**Key Insight**: Current SRS only considers *card-level* spacing, not *concept-level* interference between similar cards

### 5. Orchestration Evidence

The `NavigationStrategyManager` interface includes explicit TODOs about composition:

**Location**: `packages/db/src/core/interfaces/navigationStrategyManager.ts:41-45`

```typescript
// [ ] addons here like:
//     - determining Navigation Strategy from context of current user
//     - determining weighted averages of navigation strategies
//     - expressing A/B testing results of 'ecosystem of strategies'
```

**Key Insight**: Strategy composition was anticipated in the original design

## Proposed Strategies: Detailed Design

### Option 1: InterferenceMitigator Strategy

#### Problem Statement
Learning interference occurs when similar concepts presented in close temporal proximity cause confusion and reduced retention. Classic examples:
- **Proactive Interference**: Old knowledge interferes with new (e.g., Spanish "hablar" vs. Italian "parlare")
- **Retroactive Interference**: New learning disrupts old (e.g., learning multiple similar APIs in one session)

#### Data Foundation

**What We Have**:
1. **Tag System**: Cards are tagged with concepts (e.g., `["forks", "pins", "chess-tactics"]`)
2. **Card History**: Timestamp of every card interaction (`CardHistory.records[].timeStamp`)
3. **SRS Intervals**: When cards were last seen
4. **Performance Data**: Per-card success rates and lapses

**What We Can Derive**:
- **Recent Exposure Set**: Cards seen in last N minutes/hours
- **Tag Co-occurrence**: Which tags appeared together recently
- **Confusion Patterns**: Cards with similar tags that have high lapse rates

#### Implementation Strategy

**Class**: `InterferenceMitigatorNavigator`
**File**: `packages/db/src/core/navigators/interferenceMitigator.ts`

**Configuration** (`serializedData`):
```typescript
{
  minTagSpacing: number;        // Seconds between cards sharing tags
  similarityThreshold: number;  // Jaccard index threshold (0-1)
  lookbackWindow: number;       // Seconds to look back for recent exposure
  baseStrategy: string;         // Delegate strategy (e.g., "elo")
}
```

**Algorithm**:

```typescript
async getNewCards(limit: number): Promise<StudySessionNewItem[]> {
  // 1. Get candidate cards from base strategy (e.g., ELO)
  const baseNavigator = await this.createBaseNavigator();
  const candidates = await baseNavigator.getNewCards(limit * 3); // Over-fetch

  // 2. Get recent exposure history (cards in current session + recent history)
  const recentCards = await this.getRecentlySeenCards(this.lookbackWindow);
  const recentTags = await this.extractTags(recentCards);

  // 3. Filter candidates to minimize interference
  const filtered = [];
  for (const card of candidates) {
    const cardTags = await this.course.getAppliedTags(card.cardID);
    const similarity = this.jaccardIndex(cardTags, recentTags);

    if (similarity < this.similarityThreshold) {
      // Tags are sufficiently different
      filtered.push(card);
    } else {
      // Check temporal spacing
      const timeSinceRelated = this.timeSinceTagExposure(cardTags, recentCards);
      if (timeSinceRelated > this.minTagSpacing) {
        filtered.push(card);
      }
    }

    if (filtered.length >= limit) break;
  }

  return filtered;
}
```

**Helper Methods**:
```typescript
// Jaccard similarity: |A ∩ B| / |A ∪ B|
private jaccardIndex(tagsA: string[], tagsB: string[]): number {
  const intersection = tagsA.filter(t => tagsB.includes(t)).length;
  const union = new Set([...tagsA, ...tagsB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Time since any card with overlapping tags was seen
private async timeSinceTagExposure(
  targetTags: string[],
  recentCards: CardHistory[]
): Promise<number> {
  let mostRecentOverlap = 0;

  for (const history of recentCards) {
    const historyTags = await this.course.getAppliedTags(history.cardID);
    const hasOverlap = targetTags.some(t => historyTags.includes(t));

    if (hasOverlap) {
      const lastSeen = history.records[history.records.length - 1].timeStamp;
      const elapsed = moment.utc().diff(lastSeen, 'seconds');
      mostRecentOverlap = Math.max(mostRecentOverlap, elapsed);
    }
  }

  return mostRecentOverlap;
}
```

**Complexity**: O(candidates × recentCards × tags) - manageable for typical session sizes

**Fallback**: If filtering exhausts candidates, relaxes `similarityThreshold` incrementally

#### Advanced: Confusion Matrix Extension

**Future Enhancement**: Track empirical interference patterns

```typescript
interface InterferencePattern {
  tagPair: [string, string];
  confusionRate: number;      // % of errors when presented close together
  optimalSpacing: number;     // Empirically derived minimum spacing
}
```

Store patterns in course database, surface during `getNewCards()` filtering.

### Option 2: HierarchyDefinition Strategy

#### Problem Statement
Many domains have explicit prerequisite structures:
- Programming: variables → arrays → loops → algorithms
- Math: addition → multiplication → fractions → algebra
- Music: notes → scales → chords → progressions

Current system has no mechanism to enforce "must master X before seeing Y" relationships.

#### Data Foundation

**What We Have**:
1. **Tag System**: Concepts are tagged
2. **Per-Tag ELO**: User skill level per tag (`CourseElo.tags[tagID].score`)
3. **Card History**: Enables mastery detection (streak, lapses, lastInterval)
4. **ELO Queries**: Can fetch cards by tag and difficulty

**What We Need**:
- **Prerequisite Graph**: Tag → [prerequisite tags] mapping
- **Mastery Threshold**: When is a tag "mastered"?

#### Implementation Strategy

**Class**: `HierarchyDefinitionNavigator`
**File**: `packages/db/src/core/navigators/hierarchyDefinition.ts`

**Configuration** (`serializedData`):
```typescript
{
  prerequisites: {
    [tagID: string]: {
      requires: string[];        // Prerequisite tag IDs
      masteryThreshold: {
        minElo?: number;         // Min ELO score (default: user global ELO)
        minCount?: number;        // Min interaction count (default: 5)
        maxLapseRate?: number;   // Max failure rate (default: 0.3)
      }
    }
  },
  baseStrategy: string;          // Delegate for ordering (e.g., "elo")
}
```

**Example Configuration**:
```json
{
  "prerequisites": {
    "algebra": {
      "requires": ["arithmetic", "fractions"],
      "masteryThreshold": {
        "minElo": 1000,
        "minCount": 10,
        "maxLapseRate": 0.2
      }
    },
    "calculus": {
      "requires": ["algebra", "functions"],
      "masteryThreshold": {
        "minElo": 1100,
        "minCount": 20
      }
    }
  }
}
```

**Algorithm**:

```typescript
async getNewCards(limit: number): Promise<StudySessionNewItem[]> {
  // 1. Get user's current mastery state
  const userReg = await this.user.getCourseRegDoc(this.course.getCourseID());
  const userElo = toCourseElo(userReg.courses[0].elo);
  const masteredTags = await this.getMasteredTags(userElo);

  // 2. Compute unlocked tags (prerequisites satisfied)
  const unlockedTags = this.getUnlockedTags(masteredTags);

  // 3. Get candidate cards from base strategy
  const baseNavigator = await this.createBaseNavigator();
  const candidates = await baseNavigator.getNewCards(limit * 2);

  // 4. Filter to only unlocked cards
  const filtered = [];
  for (const card of candidates) {
    const cardTags = await this.course.getAppliedTags(card.cardID);
    const isUnlocked = cardTags.every(tag =>
      unlockedTags.includes(tag) || !this.hasPrerequisites(tag)
    );

    if (isUnlocked) {
      filtered.push(card);
    }

    if (filtered.length >= limit) break;
  }

  return filtered;
}

private async getMasteredTags(userElo: CourseElo): Promise<string[]> {
  const mastered: string[] = [];

  for (const [tagID, config] of Object.entries(this.prerequisites)) {
    const tagElo = userElo.tags[tagID];
    if (!tagElo) continue;

    const threshold = config.masteryThreshold;
    const meetsElo = !threshold.minElo || tagElo.score >= threshold.minElo;
    const meetsCount = !threshold.minCount || tagElo.count >= threshold.minCount;

    // Check lapse rate if specified
    let meetsLapseRate = true;
    if (threshold.maxLapseRate !== undefined) {
      const tagHistory = await this.getTagHistories(tagID);
      const lapseRate = this.calculateLapseRate(tagHistory);
      meetsLapseRate = lapseRate <= threshold.maxLapseRate;
    }

    if (meetsElo && meetsCount && meetsLapseRate) {
      mastered.push(tagID);
    }
  }

  return mastered;
}

private getUnlockedTags(masteredTags: string[]): string[] {
  const unlocked: string[] = [];

  for (const [tagID, config] of Object.entries(this.prerequisites)) {
    const prerequisitesMet = config.requires.every(req =>
      masteredTags.includes(req)
    );

    if (prerequisitesMet) {
      unlocked.push(tagID);
    }
  }

  // Add tags with no prerequisites
  for (const tag of await this.course.getCourseTagStubs()) {
    if (!this.prerequisites[tag.name]) {
      unlocked.push(tag.name);
    }
  }

  return unlocked;
}
```

**Mastery Detection**: Uses per-tag ELO data that's already tracked but currently unused

**Graph Validation**: Could add cycle detection during strategy creation/validation

**UI Opportunity**: Visualize prerequisite graph as skill tree (like language learning apps)

#### Advanced: Dynamic Threshold Adjustment

**Future Enhancement**: Adapt mastery thresholds based on user learning rate

```typescript
interface AdaptiveThreshold {
  baseThreshold: MasteryThreshold;
  adjustmentFactor: number;  // Multiplier based on user's learning velocity
}

// Fast learners → higher thresholds (ensure solid foundation)
// Slow learners → lower thresholds (maintain motivation)
```

### Option 3: Strategy Orchestrator

#### Problem Statement
Different pedagogical goals may conflict:
- **ELO Navigator**: Wants to match difficulty to user skill
- **Interference Mitigator**: Wants to space similar concepts
- **Hierarchy Navigator**: Wants to enforce prerequisites

How do we combine these constraints into a unified card selection?

#### Design Pattern: Weighted Filter Pipeline

The orchestrator acts as a **meta-navigator** that coordinates multiple sub-strategies.

**Class**: `OrchestratorNavigator`
**File**: `packages/db/src/core/navigators/orchestrator.ts`

**Configuration** (`serializedData`):
```typescript
{
  strategies: Array<{
    implementingClass: string;   // Strategy to use
    serializedData: string;      // Config for that strategy
    mode: "filter" | "rank" | "source";
    weight: number;              // Relative importance (0-1)
  }>,

  combinerMode: "weighted" | "cascade" | "voting";
  fallbackStrategy?: string;     // If orchestration yields no results
}
```

#### Mode 1: Filter Pipeline (Recommended)

**Pattern**: Each strategy acts as a filter, reducing candidates

```typescript
async getNewCards(limit: number): Promise<StudySessionNewItem[]> {
  // 1. Start with over-fetched candidate set from primary source strategy
  const sourceStrategy = this.strategies.find(s => s.mode === "source");
  const navigator = await ContentNavigator.create(
    this.user,
    this.course,
    sourceStrategy
  );

  let candidates = await navigator.getNewCards(limit * 5); // Over-fetch

  // 2. Apply filter strategies sequentially
  const filterStrategies = this.strategies.filter(s => s.mode === "filter");

  for (const strategyConfig of filterStrategies) {
    if (candidates.length === 0) break;

    const filter = await this.createNavigator(strategyConfig);

    // Each filter scores candidates [0-1] for suitability
    const scored = await Promise.all(
      candidates.map(async (card) => ({
        card,
        score: await filter.scoreCard(card, candidates)
      }))
    );

    // Keep cards above threshold, weighted by strategy importance
    const threshold = 0.5 * strategyConfig.weight;
    candidates = scored
      .filter(s => s.score >= threshold)
      .map(s => s.card);
  }

  // 3. Apply ranking strategies to order remaining candidates
  const rankStrategies = this.strategies.filter(s => s.mode === "rank");

  if (rankStrategies.length > 0) {
    const scored = await Promise.all(
      candidates.map(async (card) => {
        let totalScore = 0;
        let totalWeight = 0;

        for (const strategyConfig of rankStrategies) {
          const ranker = await this.createNavigator(strategyConfig);
          totalScore += (await ranker.scoreCard(card, candidates)) * strategyConfig.weight;
          totalWeight += strategyConfig.weight;
        }

        return { card, score: totalScore / totalWeight };
      })
    );

    candidates = scored
      .sort((a, b) => b.score - a.score)
      .map(s => s.card);
  }

  return candidates.slice(0, limit);
}
```

**Required Interface Extension**:

```typescript
abstract class ContentNavigator {
  // Existing methods
  abstract getNewCards(limit?: number): Promise<StudySessionNewItem[]>;
  abstract getPendingReviews(): Promise<StudySessionReviewItem[]>;

  // New method for orchestration
  async scoreCard(
    card: StudySessionNewItem,
    context: StudySessionNewItem[]
  ): Promise<number> {
    // Default implementation: all cards equally valid
    return 1.0;
  }
}
```

**Strategy Implementation**: Each navigator implements `scoreCard()` to quantify suitability

**Example Implementations**:

```typescript
// ELONavigator.scoreCard()
async scoreCard(card: StudySessionNewItem): Promise<number> {
  const userElo = await this.getUserElo();
  const cardElo = await this.course.getCardEloData([card.cardID]);

  // Score is inverse of ELO distance (closer = better)
  const distance = Math.abs(cardElo[0].global.score - userElo.global.score);
  return Math.max(0, 1 - distance / 1000); // Normalize to [0,1]
}

// InterferenceMitigatorNavigator.scoreCard()
async scoreCard(
  card: StudySessionNewItem,
  context: StudySessionNewItem[]
): Promise<number> {
  const cardTags = await this.course.getAppliedTags(card.cardID);
  const recentTags = await this.extractTags(context);

  const similarity = this.jaccardIndex(cardTags, recentTags);

  // Lower similarity = higher score
  return 1 - similarity;
}

// HierarchyDefinitionNavigator.scoreCard()
async scoreCard(card: StudySessionNewItem): Promise<number> {
  const cardTags = await this.course.getAppliedTags(card.cardID);
  const masteredTags = await this.getMasteredTags();

  // Binary: prerequisites met (1.0) or not (0.0)
  const prerequisitesMet = cardTags.every(tag =>
    this.getUnlockedTags(masteredTags).includes(tag)
  );

  return prerequisitesMet ? 1.0 : 0.0;
}
```

#### Mode 2: Weighted Voting (Alternative)

**Pattern**: Each strategy proposes cards independently, orchestrator combines via weighted voting

```typescript
async getNewCards(limit: number): Promise<StudySessionNewItem[]> {
  // 1. Each strategy proposes candidates
  const proposals = await Promise.all(
    this.strategies.map(async (strategyConfig) => {
      const navigator = await this.createNavigator(strategyConfig);
      const cards = await navigator.getNewCards(limit * 2);

      return {
        cards,
        weight: strategyConfig.weight
      };
    })
  );

  // 2. Build weighted frequency map
  const votes = new Map<string, number>();

  for (const { cards, weight } of proposals) {
    for (let i = 0; i < cards.length; i++) {
      const cardID = cards[i].cardID;
      const positionWeight = (cards.length - i) / cards.length; // Earlier = higher
      const vote = weight * positionWeight;

      votes.set(cardID, (votes.get(cardID) || 0) + vote);
    }
  }

  // 3. Return top-voted cards
  const sorted = Array.from(votes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return await this.hydrateCards(sorted.map(([id]) => id));
}
```

**Tradeoff**: Voting is simpler but may violate hard constraints (e.g., prerequisite not met)

#### Orchestrator Example Configuration

```json
{
  "strategies": [
    {
      "implementingClass": "elo",
      "serializedData": "{}",
      "mode": "source",
      "weight": 1.0
    },
    {
      "implementingClass": "hierarchyDefinition",
      "serializedData": "{\"prerequisites\": {...}}",
      "mode": "filter",
      "weight": 1.0
    },
    {
      "implementingClass": "interferenceMitigator",
      "serializedData": "{\"minTagSpacing\": 1800, \"similarityThreshold\": 0.5}",
      "mode": "rank",
      "weight": 0.7
    }
  ],
  "combinerMode": "weighted",
  "fallbackStrategy": "elo"
}
```

**Interpretation**:
1. Get candidates from ELO navigator (match user skill)
2. **Filter** to only cards with prerequisites met (hard constraint)
3. **Rank** remaining cards to minimize interference (soft constraint, weight 0.7)

#### Advanced: Contextual Strategy Selection

**Future Enhancement**: Choose strategies based on session context

```typescript
interface StrategySelector {
  condition: {
    timeOfDay?: "morning" | "afternoon" | "evening";
    sessionCount?: { min: number; max: number };
    recentPerformance?: { min: number; max: number };
  };
  strategy: string;
}

// Example: Morning sessions focus on new material (ELO)
//          Evening sessions review + avoid interference
```

## Feasibility Assessment

### Technical Feasibility: ✅ HIGH

**Existing Infrastructure**:
- ✅ Tag system with bidirectional card-tag links
- ✅ Multi-dimensional ELO tracking (per-tag data ready)
- ✅ Rich card history with performance metrics
- ✅ Dynamic strategy loading via `ContentNavigator.create()`
- ✅ Strategy CRUD methods in `CourseDB`

**Required Changes**:
- ➕ Implement new navigator classes (extend existing pattern)
- ➕ Add `scoreCard()` method to `ContentNavigator` base class
- ➕ Store prerequisite graph in strategy configuration
- ⚠️  Query performance: Tag queries and history lookups may need optimization for large courses

### Complexity Assessment

| Component | Lines of Code (Est.) | Complexity | Risk |
|-----------|---------------------|------------|------|
| InterferenceMitigator | ~200 LOC | Medium | Low - filtering logic straightforward |
| HierarchyDefinition | ~250 LOC | Medium | Low - prerequisite graph traversal well-known |
| Orchestrator | ~300 LOC | High | Medium - coordination logic, edge cases |
| Interface Extension (`scoreCard()`) | ~50 LOC | Low | Low - backward compatible (default impl) |
| **Total** | **~800 LOC** | **Medium-High** | **Low-Medium** |

### Performance Considerations

**Potential Bottlenecks**:
1. **Tag Queries**: `getAppliedTags()` called per candidate card
   - **Mitigation**: Batch fetch tags for all candidates
   - **Estimated Impact**: O(candidates) → O(1) with batching

2. **Card History Fetches**: Per-tag mastery requires aggregating histories
   - **Mitigation**: Cache tag-level aggregates in user document
   - **Estimated Impact**: Amortized across session

3. **Orchestrator Over-fetching**: May load 5x cards to filter down to desired count
   - **Mitigation**: Adaptive over-fetch ratio based on filter selectivity
   - **Estimated Impact**: Acceptable for typical session sizes (<100 candidates)

**Benchmark Target**: <100ms for `getNewCards()` call (currently ~50ms for ELO)

### Data Model Extensions

**New Document Types**: None required (use existing `ContentNavigationStrategyData`)

**New Fields**:
- ✅ `CourseElo.tags` - already exists, just unused
- ➕ `Tag.prerequisites?: string[]` - optional, store in strategy config instead
- ➕ `Tag.interferencePatterns?: InterferencePattern[]` - future enhancement

**Migration Impact**: None - all extensions are opt-in via new strategies

## Implementation Risks & Mitigations

### Risk 1: Orchestration Complexity
**Description**: Composing multiple strategies may have unexpected interactions
**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:
- Start with filter pipeline (simpler than voting)
- Implement comprehensive logging for card selection decisions
- Build debug UI showing which strategies filtered/ranked each card
- Add strategy validation during creation (e.g., cycle detection in prerequisites)

### Risk 2: Performance Degradation
**Description**: Complex strategies may slow card selection unacceptably
**Likelihood**: Low
**Impact**: High (affects UX)

**Mitigation**:
- Implement batched queries (tags, ELO, histories)
- Add performance monitoring to `ContentNavigator.create()`
- Set timeout budget (e.g., 200ms) with fallback to simpler strategy
- Cache frequently accessed data (user mastery state) for session duration

### Risk 3: Over-Filtering
**Description**: Strategies may be too restrictive, yielding zero candidates
**Likelihood**: Medium (especially with hierarchy constraints)
**Impact**: High (breaks study session)

**Mitigation**:
- Implement graceful degradation: relax constraints progressively
- Always maintain fallback to base strategy (ELO)
- Log "constraint violation" events for course authors to adjust thresholds
- UI warning when strategies are overly restrictive

### Risk 4: Prerequisite Graph Misconfiguration
**Description**: Course authors create invalid graphs (cycles, orphans)
**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:
- Add graph validation on strategy save:
  - Cycle detection (DFS)
  - Orphan detection (tags with prerequisites that don't exist)
  - Reachability check (all tags have path from root)
- Visualize graph in UI before saving
- Provide "validate prerequisites" tool

## Recommended Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Enable orchestration without implementing complex strategies

1. ✅ Add `scoreCard()` method to `ContentNavigator` base class
2. ✅ Implement `OrchestratorNavigator` with filter pipeline mode
3. ✅ Add comprehensive logging and debug instrumentation
4. ✅ Write unit tests for orchestration logic
5. ✅ Create simple test strategy (e.g., `RandomFilterNavigator`) to validate framework

**Deliverable**: Working orchestrator that can compose existing navigators

### Phase 2: InterferenceMitigator (Week 3)
**Goal**: Implement tag-based interference detection

1. ✅ Implement `InterferenceMitigatorNavigator`
2. ✅ Add `scoreCard()` implementation using Jaccard similarity
3. ✅ Implement temporal spacing checks
4. ✅ Add session history tracking for recent exposures
5. ✅ Write integration tests with ELO + Interference composition

**Deliverable**: Working interference mitigation, testable via orchestrator

### Phase 3: HierarchyDefinition (Week 4)
**Goal**: Implement prerequisite-based card selection

1. ✅ Implement `HierarchyDefinitionNavigator`
2. ✅ Add prerequisite graph parsing and traversal
3. ✅ Implement mastery detection using per-tag ELO
4. ✅ Add graph validation utilities (cycle detection, etc.)
5. ✅ Write integration tests with full orchestration

**Deliverable**: Working prerequisite enforcement

### Phase 4: Polish & Optimization (Week 5-6)
**Goal**: Production-ready performance and UX

1. ✅ Implement batched queries for tags and ELO
2. ✅ Add performance monitoring and budget enforcement
3. ✅ Implement graceful degradation and fallbacks
4. ✅ Add strategy validation on save
5. ✅ Build debug UI for strategy composition visualization
6. ✅ Write comprehensive integration tests
7. ✅ Documentation and examples

**Deliverable**: Production-ready orchestrator + strategies

## Alternative Approaches Considered

### Alternative 1: Hard-Code Strategy Combinations
**Approach**: Pre-define specific combinations (e.g., "ELO + Interference", "Hierarchy + ELO")

**Pros**: Simpler, no orchestration complexity
**Cons**: Not extensible, requires code changes for new combinations

**Verdict**: ❌ Rejected - violates existing architecture's extensibility goals

### Alternative 2: SQL-Like Query Language
**Approach**: Define card selection via declarative DSL (e.g., `SELECT cards WHERE elo NEAR user AND tags NOT IN recent`)

**Pros**: Very flexible, no code for new combinations
**Cons**: Large implementation effort, steep learning curve

**Verdict**: ⏸️  Defer - interesting for v2, but overkill for current needs

### Alternative 3: Strategy as Pure Functions
**Approach**: Strategies are stateless functions: `(user, course, context) => Card[]`

**Pros**: Simpler composition (functional programming patterns)
**Cons**: Breaks existing OOP architecture, requires refactor

**Verdict**: ❌ Rejected - too disruptive, existing pattern works well

## Success Metrics

**Development Metrics**:
- ✅ All strategies pass unit tests
- ✅ Orchestrator can compose 2+ strategies without crashes
- ✅ `getNewCards()` completes in <200ms for typical courses
- ✅ Zero production incidents related to card selection

**Pedagogical Metrics** (to be measured post-deployment):
- 📊 Reduction in confusion errors (cards with similar tags)
- 📊 Improved mastery rates (prerequisite enforcement)
- 📊 User retention (appropriate difficulty via ELO + hierarchy)

**Instrumentation Needed**:
- Log strategy selection decisions (which cards filtered, why)
- Track mastery unlock events (user passes threshold)
- Measure inter-card similarity of presented sequences
- A/B test: traditional ELO vs. orchestrated strategies

## Open Questions

1. **Interference Threshold Calibration**: What is the optimal `minTagSpacing` and `similarityThreshold`?
   - **Recommendation**: Start conservative (1800s spacing, 0.5 similarity), tune via data

2. **Mastery Threshold Defaults**: What ELO/count/lapse-rate indicates "mastery"?
   - **Recommendation**: Use domain heuristics - e.g., ELO > user-global, count > 5, lapse < 30%

3. **Orchestrator Fallback Behavior**: When all strategies filter to zero, what to do?
   - **Recommendation**: Cascade fallback: relax filters 20% → 50% → base strategy

4. **Per-Tag ELO Initialization**: New tags start with zero data - how to bootstrap?
   - **Recommendation**: Inherit from global ELO until tag-specific data accumulates

5. **Graph Visualization**: How to represent prerequisite graphs in UI?
   - **Recommendation**: Use force-directed graph (D3.js) with drag-to-reorder

## Recommendation

**Proceed with phased implementation** following the 4-phase roadmap above.

**Priority Order**:
1. **Phase 1** (Orchestrator) - Foundational, unlocks all future work
2. **Phase 3** (Hierarchy) - High pedagogical value, leverages unused per-tag ELO
3. **Phase 2** (Interference) - Refinement, less critical for MVP
4. **Phase 4** (Polish) - Continuous, parallel to other phases

**Rationale**:
- Architecture supports all three strategies natively
- No data model changes required
- Phases can be developed independently (parallelizable)
- Hierarchy addresses explicit user need (prerequisite structures)
- Orchestrator enables rapid experimentation with new strategies

**Estimated Timeline**: 6 weeks for complete implementation (all phases)

**Next Steps**:
1. User approval of approach
2. Create detailed technical plan for Phase 1
3. Set up instrumentation/logging infrastructure
4. Begin implementation

---

## Appendix: Key Code Locations

### Core Navigation System
- **ContentNavigationStrategyData**: `packages/db/src/core/types/contentNavigationStrategy.ts:7-22`
- **ContentNavigator Interface**: `packages/db/src/core/navigators/index.ts:20-58`
- **NavigationStrategyManager**: `packages/db/src/core/interfaces/navigationStrategyManager.ts:8-46`
- **Strategy Selection Hook**: `packages/db/src/impl/couch/courseDB.ts:522-560`

### Existing Navigators
- **ELONavigator**: `packages/db/src/core/navigators/elo.ts:8-79`
- **HardcodedOrderNavigator**: `packages/db/src/core/navigators/hardcodedOrder.ts:7-64`

### Session Management
- **SessionController**: `packages/db/src/study/SessionController.ts:182-385`
- **ResponseProcessor**: `packages/db/src/study/services/ResponseProcessor.ts:41-262`
- **SrsService**: `packages/db/src/study/services/SrsService.ts:23-43`
- **SpacedRepetition Algorithm**: `packages/db/src/study/SpacedRepetition.ts:20-128`

### Data Infrastructure
- **Tag Queries**: `packages/db/src/impl/couch/courseDB.ts:795-899`
- **ELO Queries**: `packages/db/src/impl/couch/courseDB.ts:173-647`
- **User Types**: `packages/db/src/core/types/user.ts:1-94`

### Documentation
- **Pedagogy Overview**: `docs/learn/pedagogy.md`
- **Previous Navigator Work**: `agent/hardcoded-navigation/a.1.assessment.md`
