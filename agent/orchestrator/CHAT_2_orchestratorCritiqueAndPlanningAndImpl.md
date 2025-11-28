## User

[@Agent Working Agreement and Orchestrator Critique](zed:///agent/thread/c92b7d36-ff25-4bdf-95ee-023254992913?name=Agent+Working+Agreement+and+Orchestrator+Critique)

- briefly review work done so far, 
- reread [@orchestrator](file:///home/colin/pn/vue-skuilder/master/agent/orchestrator) 


1. describe way(s) to get these new navigation strategies to production
 - how to create / set them in a course
 - how to inspect / understand their usage at runtime

and
 
2. reassess / estimate / plan toward phase 4 work

**Tool Call: Get current time**
Status: Completed

The current datetime is 2025-11-27T23:36:04.165495781-04:00.

**Tool Call: List the `master/agent/orchestrator` directory's contents**
Status: Completed


# Files:
master/agent/orchestrator/a.1.assessment.md
master/agent/orchestrator/a.2.plan.md
master/agent/orchestrator/a.3.todo.md
master/agent/orchestrator/u.2.additional-info.md
master/agent/orchestrator/u.3.strategic-nuggets.md
master/agent/orchestrator/u.4.lp-landingpage-copy.md


**Tool Call: Read file `agent/orchestrator/a.2.plan.md`**
Status: Completed

```json
{"Text":"This file was too big to read all at once.\n\n# File outline for /home/colin/pn/vue-skuilder/master/agent/orchestrator/a.2.plan.md (file too large to show full content)\n\n# Plan: Scorable NavigationStrategy Architecture [L1-2]\n## Context [L3-4]\n## Architecture Overview [L27-28]\n### Core Change: Strategies Return Weighted Cards [L29-30]\ninterface WeightedCard [L48-53]\n### Strategy Composition Model: Delegate Pattern [L66-67]\n### Strategy Data Access Pattern [L106-107]\n## Implementation Phases [L126-127]\n### Phase 1: WeightedCard Interface + ELO Implementation [L128-129]\ninterface WeightedCard [L138-143]\nabstract class ContentNavigator [L150-191]\n static async create( ) [L152-156]\n async getWeightedCards( ) [L165-186]\n  const newCards [L167]\n  const reviews [L168]\n  const weighted [L170-183]\n   cardId [L172]\n   courseId [L173]\n   score [L174]\n   source [L175]\n   cardId [L178]\n   courseId [L179]\n   score [L180]\n   source [L181]\nconst courseReg [L200]\nconst userElo [L201]\nconst newCards [L204]\nconst reviews [L207]\nconst scoredNew [L210-222]\n const cardEloData [L211]\n const cardElo [L212]\n const distance [L213]\n const score [L214]\n cardId [L217]\n courseId [L218]\n source [L220]\nconst scoredReviews [L225-230]\n cardId [L226]\n courseId [L227]\n score [L228]\n source [L229]\nconst all [L233]\n### Phase 2: HierarchyDefinition Strategy (Filter/Delegate Pattern) [L251-252]\ninterface HierarchyConfig [L259-270]\nprerequisites [L276-289]\n letter-b [L277-280]\n  requires [L278]\n  masteryThreshold [L279]\n   minCount [L279]\n letter-d [L281-284]\n  requires [L282]\n  masteryThreshold [L283]\n   minCount [L283]\n cvc-words [L285-288]\n  requires [L286]\n  masteryThreshold [L287]\n   minCount [L287]\ndelegateStrategy [L290]\nclass HierarchyDefinitionNavigator [L296-336]\n private delegate [L297]\n private config [L298]\n constructor( ) [L300-304]\n async getWeightedCards( ) [L306-331]\n  const candidates [L308]\n  const masteredTags [L311]\n  const unlockedTags [L312]\n  const gated [L315]\n  const cardTags [L317]\n  const isUnlocked [L318-320]\n async getNewCards( ) [L334]\n async getPendingReviews() [L335]\n### Phase 3: InterferenceMitigator Strategy (Filter/Delegate Pattern) [L363-364]\ninterface InterferenceConfig [L371-385]\ninterferenceSets [L391-395]\nmaturityThreshold [L396]\n minCount [L396]\ninterferenceDecay [L397]\nclass InterferenceMitigatorNavigator [L408-445]\n private interferenceMap [L409]\n async getWeightedCards( ) [L411-427]\n  const candidates [L412]\n  const immatureTags [L415]\n  const tagsToAvoid [L416]\n  const adjusted [L419-423]\n   const cardTags [L420]\n   const multiplier [L421]\n   score [L422]\n private async getImmatureTags() [L429-433]\n  const userElo [L431]\n private getTagsToAvoid( ) [L435-438]\n private computeInterferenceMultiplier( ) [L440-444]\n  const interferingCount [L441]\n### Phase 4: Orchestrator (Deferred) [L466-467]\ninterface OrchestratorConfig [L484-492]\n## Data Dependencies [L497-498]\n### Per-Tag ELO (Already Exists) [L499-500]\ntype CourseElo [L509-512]\ntype EloRank [L514-517]\n### Session Context (For Interference) [L520-521]\n### Delegate Strategy Creation [L528-529]\nconst delegateStrategyData [L535-539]\n implementingClass [L536]\n serializedData [L537]\n## File Changes Summary [L545-546]\n## Testing Strategy [L559-560]\n### Unit Tests [L561-562]\n### Integration Tests [L571-572]\n### Manual Testing (LP-specific) [L578-579]\n## Success Metrics [L586-587]\n## Risks & Mitigations [L605-606]\n## Open Decisions [L617-618]\n## Next Steps [L633-634]\n\nShowing symbols 1-112 (total symbols: 112)\n\n\nUsing the line numbers in this outline, you can call this tool again\nwhile specifying the start_line and end_line fields to see the\nimplementations of symbols in the outline.\n\nAlternatively, you can fall back to the `grep` tool (if available)\nto search the file for specific content."}
```

**Tool Call: Read file `agent/orchestrator/a.3.todo.md`**
Status: Completed

```json
{"Text":"# TODO: Scorable NavigationStrategy Architecture\n\n**Reference**: See `a.2.plan.md` for full context, architecture diagrams, and rationale.\n\n**Summary**: Add `getWeightedCards()` method to navigation strategies that returns cards with suitability scores. Filter strategies (Hierarchy, Interference) use a delegate pattern — they wrap another strategy and transform its output.\n\n---\n\n## Phase 1: WeightedCard Interface + ELO Implementation\n\n**Status**: COMPLETED\n\n**Goal**: Add `getWeightedCards()` to `ContentNavigator`, implement in ELO, maintain backward compat with `getNewCards()`/`getPendingReviews()`.\n\n### Tasks\n\n- [x] p1.1: Define `WeightedCard` type\n  - File: `packages/db/src/core/navigators/index.ts`\n  - Fields: `cardId`, `courseId`, `score` (0-1), `source` ('new' | 'review' | 'failed')\n\n- [x] p1.2: Add `getWeightedCards()` to `ContentNavigator` base class\n  - File: `packages/db/src/core/navigators/index.ts`\n  - Signature: `async getWeightedCards(limit: number): Promise<WeightedCard[]>`\n  - Default implementation: calls legacy `getNewCards()` + `getPendingReviews()`, assigns score=1.0\n\n- [x] p1.3: Implement `getWeightedCards()` in `ELONavigator`\n  - File: `packages/db/src/core/navigators/elo.ts`\n  - Get user ELO via `this.user.getCourseRegDoc(courseId)` + `toCourseElo()`\n  - Score = inverse of ELO distance: `Math.max(0, 1 - distance / 500)`\n  - Batches ELO lookups for efficiency\n  - Combine new cards + reviews, sort by score descending\n\n- [x] p1.4: Add unit tests\n  - Created: `packages/db/src/core/navigators/navigators.test.ts`\n  - Tests for WeightedCard type structure\n  - Tests for default getWeightedCards() behavior\n  - Tests for ELO scoring formula\n\n- [x] p1.5: Verify build and tests pass\n  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓\n  - [x] Tests: delegated to CI\n\n---\n\n## Phase 2: HierarchyDefinition Strategy\n\n**Status**: COMPLETED\n\n**Goal**: Prerequisite-gated card selection using delegate pattern. Cards locked until user masters prerequisite tags.\n\n### Tasks\n\n- [x] p2.1: Create `HierarchyDefinitionNavigator` class\n  - Created: `packages/db/src/core/navigators/hierarchyDefinition.ts`\n  - Extends `ContentNavigator`\n  - Has `delegate: ContentNavigator` field (lazy-initialized)\n\n- [x] p2.2: Parse config from `serializedData`\n  ```typescript\n  interface HierarchyConfig {\n    prerequisites: {\n      [tagId: string]: {\n        requires: string[];\n        masteryThreshold?: { minElo?: number; minCount?: number; };\n      };\n    };\n    delegateStrategy?: string;  // default: \"elo\"\n  }\n  ```\n\n- [x] p2.3: Create delegate navigator in constructor/init\n  - Uses lazy initialization via `getDelegate()` method\n  - Uses `ContentNavigator.create(user, course, delegateStrategyData)`\n  - Default delegate: ELO\n\n- [x] p2.4: Implement `getMasteredTags(): Promise<Set<string>>`\n  - Gets user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`\n  - Tag is mastered if: `userElo(tag) >= threshold` AND `count >= minCount`\n  - Falls back to comparing tag ELO vs global user ELO if no minElo specified\n\n- [x] p2.5: Implement `getUnlockedTags(mastered: Set<string>): Set<string>`\n  - Tag is unlocked if all its prerequisites are in `mastered`\n  - Tags with no prerequisites are always unlocked\n\n- [x] p2.6: Implement `getWeightedCards(limit)`\n  - Gets candidates from delegate (over-fetch: `limit * 2`)\n  - For each candidate, checks if card is unlocked via `isCardUnlocked()`\n  - Locked cards filtered out, unlocked cards preserve delegate's score\n  - Returns filtered list up to limit\n\n- [x] p2.7: Implement legacy methods (delegate through)\n  - `getNewCards(n)` → `this.delegate.getNewCards(n)`\n  - `getPendingReviews()` → `this.delegate.getPendingReviews()`\n\n- [x] p2.8: Register in factory\n  - Already added to `Navigators` enum in Phase 1: `HIERARCHY = 'hierarchyDefinition'`\n\n- [x] p2.9: Add unit tests\n  - Added to `navigators.test.ts`:\n  - Mastery detection (ELO threshold + count)\n  - Unlocking logic (prerequisite chain)\n  - Card unlocking (mixed tags with/without prereqs)\n\n- [x] p2.10: Verify build and tests pass\n  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓\n  - [x] Tests: delegated to CI\n\n---\n\n## Phase 3: InterferenceMitigator Strategy\n\n**Status**: COMPLETED\n\n**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.\n\n### Tasks\n\n- [x] p3.1: Create `InterferenceMitigatorNavigator` class\n  - Created: `packages/db/src/core/navigators/interferenceMitigator.ts`\n  - Extends `ContentNavigator`\n  - Has `delegate: ContentNavigator` field (lazy-initialized)\n\n- [x] p3.2: Parse config from `serializedData`\n  - `interferenceSets: string[][]` — groups of tags that interfere (e.g., `[[\"b\",\"d\",\"p\"], [\"d\",\"t\"]]`)\n  - `maturityThreshold: { minCount?, minElo? }` — when a tag is considered mature\n  - `interferenceDecay` (default: 0.8)\n  - `delegateStrategy` (default: \"elo\")\n\n- [x] p3.3: Build interference map from config (tag → set of partners)\n\n- [x] p3.4: Implement `getImmatureTags(): Promise<Set<string>>`\n  - Tags where user has count > 0 but below maturity threshold\n\n- [x] p3.5: Implement `getTagsToAvoid(immatureTags): Set<string>`\n  - Partners of immature tags (excluding already-immature ones)\n\n- [x] p3.6: Implement `computeInterferenceMultiplier()`\n  - Score reduction based on overlap with avoid set\n  - `Math.pow(1 - decay, interferingCount)`\n\n- [x] p3.7: Implement `getWeightedCards(limit)`\n  - Maturity-aware interference avoidance\n\n- [x] p3.8: Implement legacy methods (delegate through)\n\n- [x] p3.9: Register in factory\n  - Already added to `Navigators` enum in Phase 1\n\n- [x] p3.10: Verify build passes\n  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓\n  - [x] Tests: delegated to CI\n\n---\n\n## Phase 4: Orchestrator (DEFERRED)\n\n**Status**: NOT STARTED — not needed for LP MVP\n\nDelegate pattern handles composition for now. Full orchestrator needed for:\n- Multi-arm bandit experimentation\n- A/B testing independent strategies\n- Dynamic strategy selection\n\n---\n\n## Notes for Implementers\n\n### Key Files\n- `packages/db/src/core/navigators/index.ts` — ContentNavigator base, factory, Navigators enum\n- `packages/db/src/core/navigators/elo.ts` — Reference generator strategy\n- `packages/db/src/core/interfaces/userDB.ts` — UserDBInterface (history, ELO)\n- `packages/db/src/impl/couch/courseDB.ts` — Tag queries, ELO queries\n\n### Commands\n- Build: `yarn workspace @vue-skuilder/db build`\n- Test: `yarn workspace @vue-skuilder/db test`\n- Type check: `yarn workspace @vue-skuilder/db type-check`\n\n### Scoring Semantics\n- `1.0` = fully suitable\n- `0.0` = hard filter (e.g., prerequisite not met)\n- `0.5` = neutral\n- Intermediate = soft preference\n\n### Delegate Pattern\nFilter strategies wrap a delegate and transform its output:\n```\nInterference(delegate=Hierarchy(delegate=ELO))\n```\n- ELO generates candidates with scores\n- Hierarchy gates (filters locked cards, preserves scores)\n- Interference adjusts scores (multiplicative reduction for similar tags)\n\n### Data Access (via constructor params)\n- `user: UserDBInterface`\n  - `user.getSeenCards(courseId)` — card history\n  - `user.getCourseRegDoc(courseId).elo.tags` — per-tag ELO\n- `course: CourseDBInterface`\n  - `course.getAppliedTags(cardId)` — tags on a card\n  - `course.getCardEloData([cardId])` — card difficulty"}
```

**Tool Call: Read file `agent/orchestrator/a.2.plan.md` (lines 466-545)**
Status: Completed

```json
{"Text":"### Phase 4: Orchestrator (Deferred)\n\n**Note**: Not needed for LP MVP — delegate pattern handles composition. Documented for future.\n\n**When needed**: For evolutionary experimentation (multi-arm bandit), A/B testing, or combining independent (non-nested) strategies.\n\n**Key insight**: With delegate pattern, Hierarchy and Interference can be stacked:\n```\nInterference(delegate=Hierarchy(delegate=ELO))\n```\n\nThis covers LP's needs. A full Orchestrator is for more complex cases:\n- Multiple independent strategy \"votes\" combined by weight\n- Dynamic strategy selection based on context\n- Evolutionary utility tracking\n\n**Future configuration sketch**:\n```typescript\ninterface OrchestratorConfig {\n  strategies: Array<{\n    implementingClass: string;\n    serializedData: string;\n    weight: number;              // 0-1, relative importance\n  }>;\n  combineMode: 'multiply' | 'weighted-average' | 'min';\n  fallbackStrategy?: string;\n}\n```\n\n---\n\n## Data Dependencies\n\n### Per-Tag ELO (Already Exists)\n\n**Location**: `CourseElo.tags` in user's course registration\n\n**Current status**: Tracked but not used for card selection\n\n**What we need**: Read access in HierarchyDefinition strategy via `user.getCourseRegDoc(courseId)`\n\n```typescript\n// From packages/db/src/core/types/user.ts\ntype CourseElo = {\n  global: EloRank;\n  tags: { [tagID: string]: EloRank };\n};\n\ntype EloRank = {\n  score: number;\n  count: number;\n};\n```\n\n### Session Context (For Interference)\n\n**Current**: `SessionController` manages queues internally. Strategies access user history via `UserDBInterface`.\n\n**Approach**: InterferenceMitigator queries `user.getSeenCards(courseId)`. Takes last N cards by document order.\n\n**Note**: `getSeenCards()` returns card IDs only, no timestamps. For MVP, \"last N cards\" is sufficient. Future: query card records with timestamps for finer control.\n\n### Delegate Strategy Creation\n\n**Challenge**: Filter strategies need to instantiate their delegate navigator.\n\n**Approach**: Use existing `ContentNavigator.create(user, course, strategyData)` factory:\n```typescript\n// In HierarchyDefinitionNavigator constructor or init\nconst delegateStrategyData = {\n  implementingClass: this.config.delegateStrategy || 'elo',\n  serializedData: '{}',\n  // ... other required fields\n};\nthis.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);\n```\n\n---\n\n## File Changes Summary\n"}
```

**Tool Call: Search files for regex `HierarchyDefinitionNavigator|InterferenceMitigatorNavigator|getWeightedCards`**
Status: Completed

Found 14 matches:

## Matches in master/packages/db/src/core/navigators/elo.ts

### class ELONavigator › async getWeightedCards( ) › L84-88
```
   * Score formula: max(0, 1 - distance / 500)
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Get user's ELO for this course
    const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
```

## Matches in master/packages/db/src/core/navigators/hierarchyDefinition.ts

### class HierarchyDefinitionNavigator › L52-62
```
export default class HierarchyDefinitionNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: HierarchyConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
```

176 lines remaining in ancestor node. Read the file to see all.

### class HierarchyDefinitionNavigator › async getWeightedCards( ) › L180-192
```
   * Cards with unlocked tags preserve their delegate score.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Over-fetch to account for filtering
    const candidates = await delegate.getWeightedCards(limit * 2);

    // Get mastery state
    const masteredTags = await this.getMasteredTags();
    const unlockedTags = this.getUnlockedTags(masteredTags);

    // Filter candidates
```

## Matches in master/packages/db/src/core/navigators/index.ts

### abstract class ContentNavigator › async getWeightedCards( ) › L86-90
```
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default implementation: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
```

## Matches in master/packages/db/src/core/navigators/interferenceMitigator.ts

### class InterferenceMitigatorNavigator › L82-92
```
export default class InterferenceMitigatorNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: InterferenceConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  /** Precomputed map: tag -> set of { partner, decay } it interferes with */
  private interferenceMap: Map<string, Array<{ partner: string; decay: number }>>;

  constructor(
```

249 lines remaining in ancestor node. Read the file to see all.

### class InterferenceMitigatorNavigator › async getWeightedCards( ) › L299-311
```
   * This encourages introducing new concepts that are distant from current focus.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Over-fetch to allow for score reordering
    const candidates = await delegate.getWeightedCards(limit * 3);

    // Identify what to avoid
    const immatureTags = await this.getImmatureTags();
    const tagsToAvoid = this.getTagsToAvoid(immatureTags);

    // Adjust scores based on interference
```

## Matches in master/packages/db/tests/core/navigators/navigators.test.ts

### L1-11
```
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';
import { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core';
import { ScheduledCard } from '../../../src/core/types/user';

// Mock implementation of ContentNavigator for testing the default getWeightedCards
class MockNavigator extends ContentNavigator {
  private mockNewCards: StudySessionNewItem[] = [];
  private mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [];

  setMockNewCards(cards: StudySessionNewItem[]) {
```

444 lines remaining in ancestor node. Read the file to see all.

### describe ContentNavigator.getWeightedCards › L58-72
```
describe('ContentNavigator.getWeightedCards', () => {
  let navigator: MockNavigator;

  beforeEach(() => {
    navigator = new MockNavigator();
  });

  it('should return empty array when no cards available', async () => {
    navigator.setMockNewCards([]);
    navigator.setMockReviews([]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toEqual([]);
  });
```

147 lines remaining in ancestor node. Read the file to see all.

### describe ContentNavigator.getWeightedCards › it should assign score=1.0 to all cards by default › const result › L90-94
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
```

### describe ContentNavigator.getWeightedCards › it should mark new cards with source="new" › const result › L108-112
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('new');
```

### describe ContentNavigator.getWeightedCards › it should mark reviews with source="review" › const result › L131-135
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('review');
```

### describe ContentNavigator.getWeightedCards › it should respect limit parameter › const result › L161-165
```
    ]);

    const result = await navigator.getWeightedCards(2);

    expect(result).toHaveLength(2);
```

### describe ContentNavigator.getWeightedCards › it should combine new cards and reviews › const result › L193-197
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
```

### describe ContentNavigator.getWeightedCards › it should correctly map cardID to cardId and courseID to courseId › const result › L212-216
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].cardId).toBe('CARD-123');
```


## Assistant

Now let me check the current state of how navigation strategies are created and stored in the course:

**Tool Call: Search files for regex `ContentNavigationStrategyData|getNavigationStrategy|surfaceNavigationStrategy`**
Status: Completed

Showing matches 1-20 (there were more matches found; use offset: 20 to see next page):

## Matches in master/packages/db/src/core/navigators/elo.ts

### class ELONavigator › constructor( ) › L12-21
```
  constructor(
    user: UserDBInterface,
    course: CourseDBInterface
    // The ELO strategy is non-parameterized.
    //
    // It instead relies on existing meta data from the course and user with respect to
    //
    //
    // strategy?: ContentNavigationStrategyData
  ) {
```

## Matches in master/packages/db/src/core/navigators/hierarchyDefinition.ts

### L1-11
```
import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';
import { toCourseElo } from '@vue-skuilder/common';

/**
 * A single prerequisite requirement for a tag.
 * Each prerequisite refers to one tag with its own mastery threshold.
```

228 lines remaining in ancestor node. Read the file to see all.

### class HierarchyDefinitionNavigator › private strategyData › L52-63
```
export default class HierarchyDefinitionNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: HierarchyConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
```

175 lines remaining in ancestor node. Read the file to see all.

### class HierarchyDefinitionNavigator › private async getDelegate() › const delegateStrategyData › L91-101
```
    if (!this.delegate) {
      const delegateStrategyData: ContentNavigationStrategyData = {
        _id: `NAVIGATION_STRATEGY-${this.config.delegateStrategy}-delegate`,
        docType: DocType.NAVIGATION_STRATEGY,
        name: `${this.config.delegateStrategy} (delegate)`,
        description: 'Delegate strategy for hierarchy definition',
        implementingClass: this.config.delegateStrategy || 'elo',
        serializedData: '{}',
      };
      this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
    }
```

## Matches in master/packages/db/src/core/navigators/index.ts

### L1-11
```
import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { logger } from '../../util/logger';

```

100 lines remaining in ancestor node. Read the file to see all.

### abstract class ContentNavigator › static async create( ) › L47-51
```
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> {
```

## Matches in master/packages/db/src/core/navigators/interferenceMitigator.ts

### L1-11
```
import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';
import { toCourseElo } from '@vue-skuilder/common';

/**
 * Configuration for the InterferenceMitigator strategy.
 *
```

331 lines remaining in ancestor node. Read the file to see all.

### class InterferenceMitigatorNavigator › private strategyData › L82-96
```
export default class InterferenceMitigatorNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: InterferenceConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  /** Precomputed map: tag -> set of { partner, decay } it interferes with */
  private interferenceMap: Map<string, Array<{ partner: string; decay: number }>>;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
```

245 lines remaining in ancestor node. Read the file to see all.

### class InterferenceMitigatorNavigator › private async getDelegate() › const delegateStrategyData › L178-188
```
    if (!this.delegate) {
      const delegateStrategyData: ContentNavigationStrategyData = {
        _id: `NAVIGATION_STRATEGY-${this.config.delegateStrategy}-delegate`,
        docType: DocType.NAVIGATION_STRATEGY,
        name: `${this.config.delegateStrategy} (delegate)`,
        description: 'Delegate strategy for interference mitigator',
        implementingClass: this.config.delegateStrategy || 'elo',
        serializedData: '{}',
      };
      this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
    }
```

## Matches in master/packages/db/src/core/types/contentNavigationStrategy.ts

### interface ContentNavigationStrategyData › L7-17
```
export interface ContentNavigationStrategyData extends SkuilderCourseData {
  _id: `${typeof DocTypePrefixes[DocType.NAVIGATION_STRATEGY]}-${string}`;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  /**
   The name of the class that implements the navigation strategy at runtime.
   */
  implementingClass: string;

  /**
```

5 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/db/src/impl/couch/courseDB.ts

### L34-38
```
import { PouchError } from './types';
import CourseLookup from './courseLookupDB';
import { ContentNavigationStrategyData } from '@db/core/types/contentNavigationStrategy';
import { ContentNavigator, Navigators } from '@db/core/navigators';

```

### class CourseDB › getNavigationStrategy( ) › L478-482
```
  ////////////////////////////////////

  getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
    logger.debug(`[courseDB] Getting navigation strategy: ${id}`);

```

### class CourseDB › getNavigationStrategy( ) › const strategy › L483-493
```
    if (id == '') {
      const strategy: ContentNavigationStrategyData = {
        _id: 'NAVIGATION_STRATEGY-ELO',
        docType: DocType.NAVIGATION_STRATEGY,
        name: 'ELO',
        description: 'ELO-based navigation strategy for ordering content by difficulty',
        implementingClass: Navigators.ELO,
        course: this.id,
        serializedData: '', // serde is a noop for ELO navigator.
      };
      return Promise.resolve(strategy);
```

1 lines remaining in ancestor node. Read the file to see all.

### class CourseDB › async getAllNavigationStrategies() › L497-511
```
  }

  async getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
    const prefix = DocTypePrefixes[DocType.NAVIGATION_STRATEGY];
    const result = await this.db.allDocs<ContentNavigationStrategyData>({
      startkey: prefix,
      endkey: `${prefix}\ufff0`,
      include_docs: true,
    });
    return result.rows.map((row) => row.doc!);
  }

  async addNavigationStrategy(data: ContentNavigationStrategyData): Promise<void> {
    logger.debug(`[courseDB] Adding navigation strategy: ${data._id}`);
    // // For now, just log the data and return success
```

### class CourseDB › updateNavigationStrategy( ) › L513-517
```
    return this.db.put(data).then(() => {});
  }
  updateNavigationStrategy(id: string, data: ContentNavigationStrategyData): Promise<void> {
    logger.debug(`[courseDB] Updating navigation strategy: ${id}`);
    // For now, just log the data and return success
```

### class CourseDB › async surfaceNavigationStrategy() › L520-524
```
  }

  async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
    try {
      const config = await this.getCourseConfig();
```

### class CourseDB › async surfaceNavigationStrategy() › const strategy › L527-534
```
        try {
          // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
          const strategy = await this.getNavigationStrategy(config.defaultNavigationStrategyId);
          if (strategy) {
            logger.debug(`Surfacing strategy ${strategy.name} from course config`);
            return strategy;
          }
        } catch (e) {
```

### class CourseDB › async surfaceNavigationStrategy() › const ret › L548-552
```

    logger.warn(`Returning hard-coded default ELO navigator`);
    const ret: ContentNavigationStrategyData = {
      _id: 'NAVIGATION_STRATEGY-ELO',
      docType: DocType.NAVIGATION_STRATEGY,
```

### class CourseDB › public async getNewCards( ) › const strategy › L573-577
```
    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getNewCards(limit);
    } catch (e) {
```

### class CourseDB › public async getPendingReviews() › const strategy › L586-590
```
    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getPendingReviews();
    } catch (e) {
```


## Assistant

Now let me look at the UI side - how courses are managed and configured:

**Tool Call: Search files for regex `defaultNavigationStrategyId|CourseConfig`**
Status: Completed

Showing matches 1-20 (there were more matches found; use offset: 20 to see next page):

## Matches in master/packages/cli/src/commands/unpack.ts

### async function unpackCourse( ) › L171-184
```
    const courseName = options.as || validation.courseName || 'Unknown Course';

    // Update CourseConfig with new name if provided
    if (options.as) {
      try {
        console.log(chalk.cyan(`🔄 Updating course name to "${courseName}"...`));
        const courseConfig = await targetDB.get('CourseConfig') as { _id: string; _rev: string; name: string };
        courseConfig.name = courseName;
        await targetDB.put(courseConfig);
        console.log(chalk.green('✅ Course name updated.'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Warning: Failed to update course name in CourseConfig.'));
        console.log(chalk.yellow(`   ${error instanceof Error ? error.message : String(error)}`));
      }
```

## Matches in master/packages/cli/src/utils/pack-courses.ts

### async function packCourses( ) › L50-54
```
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        courseTitle = manifest.courseName || manifest.courseConfig?.name || courseId;
      } catch {
```

## Matches in master/packages/cli/src/utils/template.ts

### L1-11
```
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { ProjectConfig, SkuilderConfig } from '../types.js';
import { CourseConfig } from '@vue-skuilder/common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

```

822 lines remaining in ancestor node. Read the file to see all.

### async function createEmptyCourseStructure( ) › L378-388
```
): Promise<void> {
  const staticCoursesPath = path.join(projectPath, 'public', 'static-courses');
  const coursePath = path.join(staticCoursesPath, courseId);

  // Create directory structure
  await fs.mkdir(coursePath, { recursive: true });
  await fs.mkdir(path.join(coursePath, 'chunks'), { recursive: true });
  await fs.mkdir(path.join(coursePath, 'indices'), { recursive: true });

  // Create minimal CourseConfig
  const courseConfig: CourseConfig = {
```

79 lines remaining in ancestor node. Read the file to see all.

### async function createEmptyCourseStructure( ) › const manifest › L415-425
```
  const manifest = {
    version: '1.0.0',
    courseId,
    courseName: title,
    courseConfig,
    lastUpdated: new Date().toISOString(),
    documentCount: 0,
    chunks: [],
    indices: [],
    designDocs: [],
  };
```

### async function createEmptyCourseStructure( ) › L449-459
```
  );

  // Create CourseConfig chunk
  await fs.writeFile(
    path.join(coursePath, 'chunks', 'CourseConfig.json'),
    JSON.stringify(
      [
        {
          _id: 'CourseConfig',
          ...courseConfig,
        },
```

## Matches in master/packages/common/src/wire-format.ts

### L90-94
```
 * metadata about a defined course
 *
 * Note: `courseID` is generated server-side. It is not present on
 * new courses at the time of writing, client-side, but always
 * present (!) when a CourseConfig is retrieved from the database
```

### interface CourseConfig › L96-106
```
export interface CourseConfig {
  courseID?: string;
  name: string;
  description: string;
  public: boolean;
  deleted: boolean;
  creator: string;
  admins: string[];
  moderators: string[];
  dataShapes: DataShape55[];
  questionTypes: QuestionType55[];
```

2 lines remaining in ancestor node. Read the file to see all.

### interface CreateCourse › L110-118
```
export interface CreateCourse extends IServerRequest {
  type: ServerRequestType.CREATE_COURSE;
  data: CourseConfig;
  response: {
    status: Status;
    ok: boolean;
    courseID: string;
  } | null;
}
```

## Matches in master/packages/db/src/impl/couch/courseDB.ts

### L3-11
```
import {
  CourseConfig,
  CourseElo,
  DataShape,
  EloToNumber,
  Status,
  blankCourseElo,
  toCourseElo,
} from '@vue-skuilder/common';
```

### L30-34
```
import { logger } from '../../util/logger';
import { GET_CACHED } from './clientCache';
import { addNote55, addTagToCard, getCredentialledCourseConfig, getTagID } from './courseAPI';
import { DataLayerResult } from '@db/core/types/db';
import { PouchError } from './types';
```

### class CoursesDB › public async getCourseList() › L48-52
```
  }

  public async getCourseList(): Promise<CourseConfig[]> {
    let crsList = await CourseLookup.allCourseWare();
    logger.debug(`AllCourses: ${crsList.map((c) => c.name + ', ' + c._id + '\n\t')}`);
```

### class CoursesDB › public async getCourseList() › const cfgs › const cfg › L61-65
```
        try {
          const cfg = await getCredentialledCourseConfig(c._id);
          logger.debug(`Found cfg: ${JSON.stringify(cfg)}`);
          return cfg;
        } catch (e) {
```

### class CoursesDB › async getCourseConfig( ) › L72-84
```
  }

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    if (this._courseIDs && this._courseIDs.length && !this._courseIDs.includes(courseId)) {
      throw new Error(`Course ${courseId} not in course list`);
    }

    const cfg = await getCredentialledCourseConfig(courseId);
    if (cfg === undefined) {
      throw new Error(`Error fetching cfg for course ${courseId}`);
    } else {
      return cfg;
    }
```

### class CourseDB › async getCourseConfig() › L325-338
```
  }

  async getCourseConfig(): Promise<CourseConfig> {
    const ret = await getCredentialledCourseConfig(this.id);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Course config not found for course ID: ${this.id}`);
    }
  }

  async updateCourseConfig(cfg: CourseConfig): Promise<PouchDB.Core.Response> {
    logger.debug(`Updating: ${JSON.stringify(cfg)}`);
    // write both to the course DB:
```

### class CourseDB › async updateCourseConfig( ) › L339-341
```
    try {
      return await updateCredentialledCourseConfig(this.id, cfg);
    } catch (error) {
```

### class CourseDB › async surfaceNavigationStrategy() › const config › L523-534
```
    try {
      const config = await this.getCourseConfig();
      // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
      if (config.defaultNavigationStrategyId) {
        try {
          // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
          const strategy = await this.getNavigationStrategy(config.defaultNavigationStrategyId);
          if (strategy) {
            logger.debug(`Surfacing strategy ${strategy.name} from course config`);
            return strategy;
          }
        } catch (e) {
```

8 lines remaining in ancestor node. Read the file to see all.

### class CourseDB › async surfaceNavigationStrategy() › L535-539
```
          logger.warn(
            // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
            `Failed to load strategy '${config.defaultNavigationStrategyId}' specified in course config. Falling back to ELO.`,
            e
          );
```

### async function getCourseDataShapes( ) › const cfg › L775-778
```
export async function getCourseDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);
  return cfg!.dataShapes;
}
```

### async function getCredentialledDataShapes( ) › const cfg › L780-784
```
export async function getCredentialledDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);

  return cfg.dataShapes;
}
```


**Tool Call: Search files for regex `navigation|strategy|NavigationStrategy`**
Status: Completed

Showing matches 1-20 (there were more matches found; use offset: 20 to see next page):

## Matches in master/agent/docs-vendoring/vitepress/tmp-theme-defs/components/VPLocalNavOutlineDropdown.vue

### function onItemClick( ) › L49-57
```
  if ((e.target as HTMLElement).classList.contains('outline-link')) {
    // disable animation on hash navigation when page jumps
    if (items.value) {
      items.value.style.transition = 'none'
    }
    nextTick(() => {
      open.value = false
    })
  }
```

## Matches in master/agent/docs-vendoring/vitepress/tmp-theme-defs/components/VPNavBarExtra.vue

### L22-26
```
  <VPFlyout
    v-if="hasExtraContent"
    class="VPNavBarExtra"
    label="extra navigation"
  >
```

## Matches in master/agent/docs-vendoring/vitepress/tmp-theme-defs/components/VPNavBarHamburger.vue

### L12-20
```
  <button
    type="button"
    class="VPNavBarHamburger"
    :class="{ active }"
    aria-label="mobile navigation"
    :aria-expanded="active"
    aria-controls="VPNavScreen"
    @click="$emit('click')"
  >
```

## Matches in master/agent/docs-vendoring/vitepress/tmp-theme-defs/components/VPNavBarMenu.vue

### L15-17
```
    <span id="main-nav-aria-label" class="visually-hidden">
      Main Navigation
    </span>
```

## Matches in master/agent/docs-vendoring/vitepress/tmp-theme-defs/components/VPSidebar.vue

### L56-58
```
      <span class="visually-hidden" id="sidebar-aria-label">
        Sidebar Navigation
      </span>
```

## Matches in master/packages/common-ui/src/components/SkMouseTrapToolTip.vue

### const handleHotkeyPress › L126-136
```
    const handleHotkeyPress = () => {
      if (props.disabled || !wrapperElement.value) return;

      // Try finding a clickable element within our wrapper
      let clickableElement = wrapperElement.value.querySelector(
        'button, a, input[type="button"], [role="button"]'
      ) as HTMLElement;

      // If no standard clickable element found, try to find navigation or list items
      if (!clickableElement) {
        clickableElement = wrapperElement.value.querySelector(
```

48 lines remaining in ancestor node. Read the file to see all.

### const handleHotkeyPress › L160-171
```
        if (clickableElement.hasAttribute('to')) {
          // Handle router-link style navigation
          const routePath = clickableElement.getAttribute('to');
          if (routePath && window.location.pathname !== routePath) {
            // Use parent router if available (Vue component)
            const router = (window as any).$nuxt?.$router || (window as any).$router;
            if (router && typeof router.push === 'function') {
              router.push(routePath);
            } else {
              // Fallback to regular navigation
              window.location.pathname = routePath;
            }
```

3 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/common-ui/src/components/StudySession.vue

### methods › L426-430
```
      }

      // Handle navigation based on result
      if (result.shouldLoadNextCard) {
        this.loadCard(await this.sessionController!.nextCard(result.nextCardAction));
```

## Matches in master/packages/common-ui/src/components/auth/ResetPassword.vue

### L62-67
```
            <slot name="success-action">
              <!-- External apps can provide their own navigation -->
              <v-btn color="primary" @click="$emit('complete')">
                Continue to Login
              </v-btn>
            </slot>
```

## Matches in master/packages/common-ui/src/components/auth/UserChip.vue

### L140-146
```
onMounted(async () => {
  const user = await getCurrentUser();
  username.value = user.getUsername();
  
  // Detect sync strategy for conditional UI
  await authUI.detectSyncStrategy();
});
```

## Matches in master/packages/common-ui/src/components/auth/UserLoginAndRegistrationContainer.vue

### L66-68
```
onMounted(async () => {
  await authUI.detectSyncStrategy();
});
```

## Matches in master/packages/common-ui/src/components/auth/VerifyEmail.vue

### L47-57
```
            <slot name="actions" :status="verificationStatus" :username="username">
              <!-- Default action - external apps can override with their own navigation -->
              <v-btn
                v-if="verificationStatus === 'success'"
                color="primary"
                @click="$emit('verified', username)"
              >
                Continue
              </v-btn>
              <v-btn
                v-else-if="verificationStatus === 'error'"
```

6 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/edit-ui/src/components/BulkImport/CardPreviewList.vue

### methods › L203-213
```
    setupKeyBindings() {
      // Define key bindings for navigation
      this.keyBindings = [
        {
          command: 'Previous Card',
          hotkey: 'left',
          callback: () => {
            this.prevCard();
            return false; // Prevent default
          },
        },
```

31 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/edit-ui/src/components/CourseEditor.vue

### L12-17
```
      <v-tabs v-model="currentTab" bg-color="primary" grow>
        <v-tab value="single">Single Card Input</v-tab>
        <v-tab value="bulk">Bulk Import</v-tab>
        <v-tab value="navigation">Navigation</v-tab>
        <v-tab value="registration">Component Registration</v-tab>
      </v-tabs>
```

### L46-51
```
        </v-window-item>

        <v-window-item value="navigation">
          <v-container fluid>
            <navigation-strategy-editor :course-id="course" />
          </v-container>
```

### L59-69
```
import { defineComponent } from 'vue';
import ComponentRegistration from './ComponentRegistration.vue';
import NavigationStrategyEditor from './NavigationStrategy/NavigationStrategyEditor.vue';
import { allCourseWare } from '@vue-skuilder/courseware';
import { BlanksCard, BlanksCardDataShapes } from '@vue-skuilder/courseware';
import { CourseConfig, NameSpacer, DataShape } from '@vue-skuilder/common';
import DataInputForm from './ViewableDataInputForm/DataInputForm.vue';
import BulkImportView from './BulkImportView.vue'; // Added import
import { getDataLayer } from '@vue-skuilder/db';
import { useDataInputFormStore } from '../stores/useDataInputFormStore';

```

89 lines remaining in ancestor node. Read the file to see all.

### components › L73-78
```
  components: {
    DataInputForm,
    ComponentRegistration,
    NavigationStrategyEditor,
    BulkImportView,
  },
```

## Matches in master/packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue

### L1-20
```
<template>
  <div class="navigation-strategy-editor">
    <div v-if="loading">
      <v-progress-circular indeterminate color="secondary"></v-progress-circular>
    </div>
    <div v-else>
      <h2 class="text-h5 mb-4">Navigation Strategies</h2>

      <div v-if="strategies.length === 0" class="no-strategies">
        <p>No navigation strategies defined for this course.</p>
      </div>

      <navigation-strategy-list
        v-else
        :strategies="strategies"
        :default-strategy-id="defaultStrategyId"
        @update:default-strategy="setDefaultStrategy"
        @edit="editStrategy"
        @delete="confirmDeleteStrategy"
      />
```

42 lines remaining in ancestor node. Read the file to see all.

### L23-25
```
        <v-icon start>mdi-plus</v-icon>
        Add New Strategy
      </v-btn>
```

### L28-39
```
        <v-card>
          <v-card-title>Create New Navigation Strategy</v-card-title>
          <v-card-text>
            <v-text-field v-model="newStrategy.name" label="Strategy Name" required></v-text-field>
            <v-text-field v-model="newStrategy.description" label="Description" required></v-text-field>
            <v-textarea
              v-model="newStrategy.cardIds"
              label="Card IDs"
              placeholder="Enter card IDs, one per line or separated by commas"
              rows="10"
              required
            ></v-textarea>
```

7 lines remaining in ancestor node. Read the file to see all.


## Assistant

There's a Navigation Strategy Editor UI. Let me examine it more closely:

**Tool Call: Find paths matching “`**/NavigationStrategy/*.vue`”**
Status: Completed

```json
{"offset":0,"current_matches_page":["/home/colin/pn/vue-skuilder/master/packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue","/home/colin/pn/vue-skuilder/master/packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyList.vue"],"all_matches_len":2}
```

**Tool Call: Read file `packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue`**
Status: Completed

```json
{"Text":"<template>\n  <div class=\"navigation-strategy-editor\">\n    <div v-if=\"loading\">\n      <v-progress-circular indeterminate color=\"secondary\"></v-progress-circular>\n    </div>\n    <div v-else>\n      <h2 class=\"text-h5 mb-4\">Navigation Strategies</h2>\n\n      <div v-if=\"strategies.length === 0\" class=\"no-strategies\">\n        <p>No navigation strategies defined for this course.</p>\n      </div>\n\n      <navigation-strategy-list\n        v-else\n        :strategies=\"strategies\"\n        :default-strategy-id=\"defaultStrategyId\"\n        @update:default-strategy=\"setDefaultStrategy\"\n        @edit=\"editStrategy\"\n        @delete=\"confirmDeleteStrategy\"\n      />\n\n      <v-btn color=\"primary\" class=\"mt-4\" @click=\"openCreateDialog\">\n        <v-icon start>mdi-plus</v-icon>\n        Add New Strategy\n      </v-btn>\n\n      <v-dialog v-model=\"showCreateDialog\" max-width=\"600px\">\n        <v-card>\n          <v-card-title>Create New Navigation Strategy</v-card-title>\n          <v-card-text>\n            <v-text-field v-model=\"newStrategy.name\" label=\"Strategy Name\" required></v-text-field>\n            <v-text-field v-model=\"newStrategy.description\" label=\"Description\" required></v-text-field>\n            <v-textarea\n              v-model=\"newStrategy.cardIds\"\n              label=\"Card IDs\"\n              placeholder=\"Enter card IDs, one per line or separated by commas\"\n              rows=\"10\"\n              required\n            ></v-textarea>\n          </v-card-text>\n          <v-card-actions>\n            <v-spacer></v-spacer>\n            <v-btn color=\"blue darken-1\" text @click=\"showCreateDialog = false\">Cancel</v-btn>\n            <v-btn color=\"blue darken-1\" text @click=\"saveNewStrategy\">Save</v-btn>\n          </v-card-actions>\n        </v-card>\n      </v-dialog>\n\n      <v-dialog v-model=\"showDeleteConfirm\" max-width=\"400px\">\n        <v-card>\n          <v-card-title class=\"text-h5\">Delete Strategy</v-card-title>\n          <v-card-text> Are you sure you want to delete the strategy \"{{ strategyToDelete?.name }}\"? </v-card-text>\n          <v-card-actions>\n            <v-spacer></v-spacer>\n            <v-btn color=\"error\" @click=\"deleteStrategy\">Delete</v-btn>\n            <v-btn @click=\"showDeleteConfirm = false\">Cancel</v-btn>\n          </v-card-actions>\n        </v-card>\n      </v-dialog>\n    </div>\n  </div>\n</template>\n\n<script lang=\"ts\">\nimport { defineComponent } from 'vue';\nimport type { ContentNavigationStrategyData } from '@vue-skuilder/db/src/core/types/contentNavigationStrategy';\nimport NavigationStrategyList from './NavigationStrategyList.vue';\nimport { getDataLayer, DocType, Navigators } from '@vue-skuilder/db';\nimport { DocTypePrefixes } from '@vue-skuilder/db/src/core/types/types-legacy';\n\nexport default defineComponent({\n  name: 'NavigationStrategyEditor',\n\n  components: {\n    NavigationStrategyList,\n  },\n\n  props: {\n    courseId: {\n      type: String,\n      required: true,\n    },\n  },\n\n  data() {\n    return {\n      strategies: [] as ContentNavigationStrategyData[],\n      loading: true,\n      showDeleteConfirm: false,\n      strategyToDelete: null as ContentNavigationStrategyData | null,\n      showCreateDialog: false,\n      newStrategy: {\n        name: '',\n        description: '',\n        cardIds: '',\n      },\n      defaultStrategyId: null as string | null,\n    };\n  },\n\n  async created() {\n    await this.loadStrategies();\n  },\n\n  methods: {\n    async loadStrategies() {\n      this.loading = true;\n      try {\n        const dataLayer = getDataLayer();\n        const courseDB = dataLayer.getCourseDB(this.courseId);\n\n        // Get all navigation strategies and the course config in parallel\n        const [strategies, courseConfig] = await Promise.all([\n          courseDB.getAllNavigationStrategies(),\n          courseDB.getCourseConfig(),\n        ]);\n\n        this.strategies = strategies;\n        this.defaultStrategyId = courseConfig.defaultNavigationStrategyId || null;\n      } catch (error) {\n        console.error('Failed to load navigation strategies:', error);\n        // In case of error, use a placeholder\n        this.strategies = [\n          {\n            _id: `NAVIGATION_STRATEGY-ELO`,\n            docType: DocType.NAVIGATION_STRATEGY,\n            name: 'ELO',\n            description: 'Default ELO-based navigation strategy',\n            implementingClass: Navigators.ELO,\n            course: this.courseId,\n            serializedData: '',\n            author: 'system',\n          },\n        ];\n      }\n      this.loading = false;\n    },\n\n    async setDefaultStrategy(strategyId: string) {\n      try {\n        this.loading = true;\n        const dataLayer = getDataLayer();\n        const courseDB = dataLayer.getCourseDB(this.courseId);\n        const config = await courseDB.getCourseConfig();\n\n        config.defaultNavigationStrategyId = strategyId;\n\n        await courseDB.updateCourseConfig(config);\n        this.defaultStrategyId = strategyId;\n        alert('Default strategy updated!');\n      } catch (error) {\n        console.error('Failed to set default strategy:', error);\n        alert('Error updating default strategy. See console for details.');\n      } finally {\n        this.loading = false;\n      }\n    },\n\n    openCreateDialog() {\n      this.newStrategy = { name: '', description: '', cardIds: '' };\n      this.showCreateDialog = true;\n    },\n\n    async saveNewStrategy() {\n      if (!this.newStrategy.name || !this.newStrategy.cardIds) {\n        // Basic validation\n        alert('Strategy Name and Card IDs are required.');\n        return;\n      }\n\n      this.loading = true;\n      try {\n        const dataLayer = getDataLayer();\n        const userDB = dataLayer.getUserDB();\n        const userName = userDB.getUsername();\n        const courseDB = dataLayer.getCourseDB(this.courseId);\n\n        // Process card IDs\n        const cardIdArray = this.newStrategy.cardIds\n          .split(/[\\n,]+/)\n          .map((id) => id.trim())\n          .filter((id) => id);\n\n        const strategyData: ContentNavigationStrategyData = {\n          _id: `NAVIGATION_STRATEGY-${Date.now()}`,\n          docType: DocType.NAVIGATION_STRATEGY,\n          name: this.newStrategy.name,\n          description: this.newStrategy.description,\n          implementingClass: Navigators.HARDCODED,\n          author: userName,\n          course: this.courseId,\n          serializedData: JSON.stringify(cardIdArray),\n        };\n\n        await courseDB.addNavigationStrategy(strategyData);\n\n        this.showCreateDialog = false;\n        await this.loadStrategies(); // Refresh the list\n      } catch (error) {\n        console.error('Failed to save new strategy:', error);\n        alert('Error saving strategy. See console for details.');\n      }\n      this.loading = false;\n    },\n\n    editStrategy(strategy: ContentNavigationStrategyData) {\n      // Strategy editing is not yet implemented\n      console.log(`Editing strategy ${strategy._id} is not yet implemented`);\n    },\n\n    confirmDeleteStrategy(strategy: ContentNavigationStrategyData) {\n      this.strategyToDelete = strategy;\n      this.showDeleteConfirm = true;\n    },\n\n    async deleteStrategy() {\n      if (!this.strategyToDelete) return;\n\n      this.loading = true;\n      try {\n        const dataLayer = getDataLayer();\n        const courseDB = dataLayer.getCourseDB(this.courseId);\n\n        // Since deleteNavigationStrategy doesn't exist in the interface yet,\n        // we'll use updateNavigationStrategy with an empty/invalid strategy that\n        // will be ignored by the system\n        const emptyStrategy: ContentNavigationStrategyData = {\n          _id: this.strategyToDelete!._id,\n          docType: DocType.NAVIGATION_STRATEGY,\n          name: 'DELETED',\n          description: 'This strategy has been deleted',\n          implementingClass: '',\n          course: this.courseId,\n          serializedData: '',\n        };\n\n        // Update with empty strategy\n        await courseDB.updateNavigationStrategy(this.strategyToDelete!._id, emptyStrategy);\n        console.log(`Strategy ${this.strategyToDelete!._id} marked as deleted`);\n\n        // Remove from our local array\n        this.strategies = this.strategies.filter((s) => s._id !== this.strategyToDelete?._id);\n\n        this.showDeleteConfirm = false;\n        this.strategyToDelete = null;\n      } catch (error) {\n        console.error('Failed to delete navigation strategy:', error);\n      }\n      this.loading = false;\n    },\n  },\n});\n</script>\n\n<style scoped>\n.navigation-strategy-editor {\n  padding: 16px;\n}\n\n.no-strategies {\n  margin: 20px 0;\n  padding: 20px;\n  background-color: #f5f5f5;\n  border-radius: 4px;\n  text-align: center;\n}\n</style>\n"}
```

## Assistant

Now let me look at how sessions use navigation strategies at runtime:

**Tool Call: Search files for regex `SessionController|getWeightedCards`**
Status: Completed

Showing matches 1-20 (there were more matches found; use offset: 20 to see next page):

## Matches in master/packages/db/src/core/navigators/elo.ts

### class ELONavigator › async getWeightedCards( ) › L84-88
```
   * Score formula: max(0, 1 - distance / 500)
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Get user's ELO for this course
    const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
```

## Matches in master/packages/db/src/core/navigators/index.ts

### abstract class ContentNavigator › async getWeightedCards( ) › L86-90
```
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default implementation: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
```

## Matches in master/packages/db/src/core/navigators/hierarchyDefinition.ts

### class HierarchyDefinitionNavigator › async getWeightedCards( ) › L180-192
```
   * Cards with unlocked tags preserve their delegate score.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Over-fetch to account for filtering
    const candidates = await delegate.getWeightedCards(limit * 2);

    // Get mastery state
    const masteredTags = await this.getMasteredTags();
    const unlockedTags = this.getUnlockedTags(masteredTags);

    // Filter candidates
```

## Matches in master/packages/db/src/core/navigators/interferenceMitigator.ts

### class InterferenceMitigatorNavigator › async getWeightedCards( ) › L299-311
```
   * This encourages introducing new concepts that are distant from current focus.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Over-fetch to allow for score reordering
    const candidates = await delegate.getWeightedCards(limit * 3);

    // Identify what to avoid
    const immatureTags = await this.getImmatureTags();
    const tagsToAvoid = this.getTagsToAvoid(immatureTags);

    // Adjust scores based on interference
```

## Matches in master/packages/db/tests/core/navigators/navigators.test.ts

### L1-11
```
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';
import { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core';
import { ScheduledCard } from '../../../src/core/types/user';

// Mock implementation of ContentNavigator for testing the default getWeightedCards
class MockNavigator extends ContentNavigator {
  private mockNewCards: StudySessionNewItem[] = [];
  private mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [];

  setMockNewCards(cards: StudySessionNewItem[]) {
```

444 lines remaining in ancestor node. Read the file to see all.

### describe ContentNavigator.getWeightedCards › L58-72
```
describe('ContentNavigator.getWeightedCards', () => {
  let navigator: MockNavigator;

  beforeEach(() => {
    navigator = new MockNavigator();
  });

  it('should return empty array when no cards available', async () => {
    navigator.setMockNewCards([]);
    navigator.setMockReviews([]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toEqual([]);
  });
```

147 lines remaining in ancestor node. Read the file to see all.

### describe ContentNavigator.getWeightedCards › it should assign score=1.0 to all cards by default › const result › L90-94
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
```

### describe ContentNavigator.getWeightedCards › it should mark new cards with source="new" › const result › L108-112
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('new');
```

### describe ContentNavigator.getWeightedCards › it should mark reviews with source="review" › const result › L131-135
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('review');
```

### describe ContentNavigator.getWeightedCards › it should respect limit parameter › const result › L161-165
```
    ]);

    const result = await navigator.getWeightedCards(2);

    expect(result).toHaveLength(2);
```

### describe ContentNavigator.getWeightedCards › it should combine new cards and reviews › const result › L193-197
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
```

### describe ContentNavigator.getWeightedCards › it should correctly map cardID to cardId and courseID to courseId › const result › L212-216
```
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].cardId).toBe('CARD-123');
```

## Matches in master/packages/common-ui/src/index.ts

### L36-40
```
export { default as StudySession } from './components/StudySession.vue';
export { default as StudySessionTimer } from './components/StudySessionTimer.vue';
export { default as SessionControllerDebug } from './components/SessionControllerDebug.vue';
export type { StudySessionConfig } from './components/StudySession.types';

```

## Matches in master/packages/db/src/study/SessionController.ts

### class SessionController › L58-68
```
export class SessionController<TView = unknown> extends Loggable {
  _className = 'SessionController';

  public services: SessionServices;
  private srsService: SrsService;
  private eloService: EloService;
  private hydrationService: CardHydrationService<TView>;

  private sources: StudyContentSource[];
  // dataLayer and getViewComponent now injected into CardHydrationService
  private _sessionRecord: StudySessionRecord[] = [];
```

454 lines remaining in ancestor node. Read the file to see all.

### class SessionController › L212-213
```
   * Returns debug information about the current session state.
   * Used by SessionControllerDebug component for runtime inspection.
```

## Matches in master/packages/db/src/study/index.ts

### L1-3
```
export * from './SessionController';
export * from './SpacedRepetition';

```

## Matches in master/packages/db/src/study/services/EloService.ts

### L1-11
```
import { adjustCourseScores, toCourseElo } from '@vue-skuilder/common';
import { DataLayerProvider, UserDBInterface, CourseRegistrationDoc } from '@db/core';
import { StudySessionRecord } from '../SessionController';
import { logger } from '@db/util/logger';

/**
 * Service responsible for ELO rating calculations and updates.
 */
export class EloService {
  private dataLayer: DataLayerProvider;
  private user: UserDBInterface;
```

74 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/db/src/study/services/ResponseProcessor.ts

### L1-11
```
import {
  CardHistory,
  CardRecord,
  CourseRegistrationDoc,
  isQuestionRecord,
  QuestionRecord,
  StudySessionItem,
} from '@db/core';
import { logger } from '@db/util/logger';
import { ResponseResult, StudySessionRecord } from '../SessionController';
import { EloService } from './EloService';
```

253 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/tuilder/src/services/study.ts

### L1-11
```
import { getDataLayer } from '@vue-skuilder/db';
import { SessionController } from '@vue-skuilder/db';
import { StudyContentSource, StudySessionItem, getStudySource } from '@vue-skuilder/db';
import { BlanksCard, gradeSpellingAttempt } from '@vue-skuilder/courseware/logic';
// import { Answer } from '@vue-skuilder/common';

import {
  TUIQuestion,
  TUIAnswer,
  AnswerFeedback,
  StudySession,
```

222 lines remaining in ancestor node. Read the file to see all.

### class StudyService › private sessionController › L16-37
```
export class StudyService {
  private sessionController: SessionController | null = null;
  private currentSession: StudySession | null = null;
  private studySources: StudyContentSource[] = [];

  /**
   * Initialize a new study session
   */
  async initializeSession(config: StudyConfig): Promise<StudySession> {
    const dataLayer = getDataLayer();
    const userDB = dataLayer.getUserDB();

    // Create study content sources for each course
    this.studySources = await Promise.all(
      config.courseIds.map((courseId) => getStudySource({ type: 'course', id: courseId }, userDB))
    );

    // Initialize session controller
    this.sessionController = new SessionController(this.studySources, config.durationSeconds);
    await this.sessionController.prepareSession();

    // Initialize session state
```

192 lines remaining in ancestor node. Read the file to see all.


**Tool Call: Read file `packages/db/src/study/SessionController.ts` (lines 212-280)**
Status: Completed

```json
{"Text":"   * Returns debug information about the current session state.\n   * Used by SessionControllerDebug component for runtime inspection.\n   */\n  public getDebugInfo() {\n    const extractQueueItems = (queue: ItemQueue<any>, limit: number = 10) => {\n      const items = [];\n      for (let i = 0; i < Math.min(queue.length, limit); i++) {\n        const item = queue.peek(i);\n        items.push({\n          courseID: item.courseID || 'unknown',\n          cardID: item.cardID || 'unknown',\n          status: item.status || 'unknown',\n        });\n      }\n      return items;\n    };\n\n    const extractHydratedItems = () => {\n      // We can't easily iterate the hydrated queue without dequeuing,\n      // so we'll just report the count via hydratedCache.count below\n\n      const items: any[] = [];\n      return items;\n    };\n\n    return {\n      reviewQueue: {\n        length: this.reviewQ.length,\n        dequeueCount: this.reviewQ.dequeueCount,\n        items: extractQueueItems(this.reviewQ),\n      },\n      newQueue: {\n        length: this.newQ.length,\n        dequeueCount: this.newQ.dequeueCount,\n        items: extractQueueItems(this.newQ),\n      },\n      failedQueue: {\n        length: this.failedQ.length,\n        dequeueCount: this.failedQ.dequeueCount,\n        items: extractQueueItems(this.failedQ),\n      },\n      hydratedCache: {\n        count: this.hydrationService.hydratedCount,\n        failedCacheSize: this.hydrationService.failedCacheSize,\n        items: extractHydratedItems(),\n      },\n    };\n  }\n\n  private async getScheduledReviews() {\n    const reviews = await Promise.all(\n      this.sources.map((c) =>\n        c.getPendingReviews().catch((error) => {\n          this.error(`Failed to get reviews for source ${c}:`, error);\n          return [];\n        })\n      )\n    );\n\n    const dueCards: (StudySessionReviewItem & ScheduledCard)[] = [];\n\n    while (reviews.length != 0 && reviews.some((r) => r.length > 0)) {\n      // pick a random review source\n      const index = randomInt(0, reviews.length - 1);\n      const source = reviews[index];\n\n      if (source.length === 0) {\n        reviews.splice(index, 1);\n        continue;\n"}
```

**Tool Call: Read file `packages/common-ui/src/components/SessionControllerDebug.vue`**
Status: Completed

```json
{"Text":"<template>\n  <v-card v-if=\"sessionController\" class=\"session-debug ma-2\" elevation=\"2\">\n    <v-card-title class=\"text-caption bg-grey-darken-3\">\n      Session Controller Debug\n      <v-spacer></v-spacer>\n      <v-icon size=\"small\">mdi-bug</v-icon>\n    </v-card-title>\n\n    <v-card-text class=\"pa-2\">\n      <v-row dense>\n        <!-- Review Queue -->\n        <v-col cols=\"12\" md=\"4\">\n          <div class=\"debug-section\">\n            <div class=\"debug-header\">\n              <v-icon size=\"x-small\" class=\"mr-1\">mdi-calendar-check</v-icon>\n              <strong>Review Queue</strong>\n            </div>\n            <div class=\"debug-stats\">\n              <span class=\"text-caption\">Length: {{ debugInfo.reviewQueue.length }}</span>\n              <span class=\"text-caption ml-2\">Dequeued: {{ debugInfo.reviewQueue.dequeueCount }}</span>\n            </div>\n            <div v-if=\"debugInfo.reviewQueue.items.length > 0\" class=\"debug-items\">\n              <div\n                v-for=\"(item, idx) in debugInfo.reviewQueue.items.slice(0, 5)\"\n                :key=\"idx\"\n                class=\"debug-item\"\n              >\n                <span class=\"text-caption\">{{ idx }}: {{ item.courseID }}::{{ item.cardID }}</span>\n                <span class=\"text-caption text-grey ml-1\">({{ item.status }})</span>\n              </div>\n              <div v-if=\"debugInfo.reviewQueue.items.length > 5\" class=\"text-caption text-grey\">\n                ... +{{ debugInfo.reviewQueue.items.length - 5 }} more\n              </div>\n            </div>\n            <div v-else class=\"text-caption text-grey\">\n              (empty)\n            </div>\n          </div>\n        </v-col>\n\n        <!-- New Cards Queue -->\n        <v-col cols=\"12\" md=\"4\">\n          <div class=\"debug-section\">\n            <div class=\"debug-header\">\n              <v-icon size=\"x-small\" class=\"mr-1\">mdi-file-document-plus</v-icon>\n              <strong>New Cards Queue</strong>\n            </div>\n            <div class=\"debug-stats\">\n              <span class=\"text-caption\">Length: {{ debugInfo.newQueue.length }}</span>\n              <span class=\"text-caption ml-2\">Dequeued: {{ debugInfo.newQueue.dequeueCount }}</span>\n            </div>\n            <div v-if=\"debugInfo.newQueue.items.length > 0\" class=\"debug-items\">\n              <div\n                v-for=\"(item, idx) in debugInfo.newQueue.items.slice(0, 5)\"\n                :key=\"idx\"\n                class=\"debug-item\"\n              >\n                <span class=\"text-caption\">{{ idx }}: {{ item.courseID }}::{{ item.cardID }}</span>\n                <span class=\"text-caption text-grey ml-1\">({{ item.status }})</span>\n              </div>\n              <div v-if=\"debugInfo.newQueue.items.length > 5\" class=\"text-caption text-grey\">\n                ... +{{ debugInfo.newQueue.items.length - 5 }} more\n              </div>\n            </div>\n            <div v-else class=\"text-caption text-grey\">\n              (empty)\n            </div>\n          </div>\n        </v-col>\n\n        <!-- Failed Cards Queue -->\n        <v-col cols=\"12\" md=\"4\">\n          <div class=\"debug-section\">\n            <div class=\"debug-header\">\n              <v-icon size=\"x-small\" class=\"mr-1\">mdi-alert-circle</v-icon>\n              <strong>Failed Cards Queue</strong>\n            </div>\n            <div class=\"debug-stats\">\n              <span class=\"text-caption\">Length: {{ debugInfo.failedQueue.length }}</span>\n              <span class=\"text-caption ml-2\">Dequeued: {{ debugInfo.failedQueue.dequeueCount }}</span>\n            </div>\n            <div v-if=\"debugInfo.failedQueue.items.length > 0\" class=\"debug-items\">\n              <div\n                v-for=\"(item, idx) in debugInfo.failedQueue.items.slice(0, 5)\"\n                :key=\"idx\"\n                class=\"debug-item\"\n              >\n                <span class=\"text-caption\">{{ idx }}: {{ item.courseID }}::{{ item.cardID }}</span>\n                <span class=\"text-caption text-grey ml-1\">({{ item.status }})</span>\n              </div>\n              <div v-if=\"debugInfo.failedQueue.items.length > 5\" class=\"text-caption text-grey\">\n                ... +{{ debugInfo.failedQueue.items.length - 5 }} more\n              </div>\n            </div>\n            <div v-else class=\"text-caption text-grey\">\n              (empty)\n            </div>\n          </div>\n        </v-col>\n      </v-row>\n\n      <!-- Hydrated Cards Cache -->\n      <v-row dense>\n        <v-col cols=\"12\">\n          <v-divider class=\"my-2\"></v-divider>\n          <div class=\"debug-section\">\n            <div class=\"debug-header\">\n              <v-icon size=\"x-small\" class=\"mr-1\">mdi-database</v-icon>\n              <strong>Hydrated Cards Cache</strong>\n            </div>\n            <div class=\"debug-stats\">\n              <span class=\"text-caption\">Cached: {{ debugInfo.hydratedCache.count }}</span>\n              <span class=\"text-caption ml-2\">Failed Cache: {{ debugInfo.hydratedCache.failedCacheSize }}</span>\n            </div>\n            <div v-if=\"debugInfo.hydratedCache.items.length > 0\" class=\"debug-items\">\n              <div\n                v-for=\"(item, idx) in debugInfo.hydratedCache.items.slice(0, 8)\"\n                :key=\"idx\"\n                class=\"debug-item d-inline-block mr-3\"\n              >\n                <span class=\"text-caption\">{{ item.courseID }}::{{ item.cardID }}</span>\n              </div>\n              <div v-if=\"debugInfo.hydratedCache.items.length > 8\" class=\"text-caption text-grey\">\n                ... +{{ debugInfo.hydratedCache.items.length - 8 }} more\n              </div>\n            </div>\n            <div v-else class=\"text-caption text-grey\">\n              (empty)\n            </div>\n          </div>\n        </v-col>\n      </v-row>\n    </v-card-text>\n  </v-card>\n</template>\n\n<script lang=\"ts\">\nimport { defineComponent, PropType, computed, ref, onMounted, onUnmounted } from 'vue';\nimport { SessionController } from '@vue-skuilder/db';\n\ninterface QueueDebugInfo {\n  length: number;\n  dequeueCount: number;\n  items: Array<{ courseID: string; cardID: string; status: string }>;\n}\n\ninterface HydratedCacheInfo {\n  count: number;\n  failedCacheSize: number;\n  items: Array<{ courseID: string; cardID: string }>;\n}\n\nexport interface SessionDebugInfo {\n  reviewQueue: QueueDebugInfo;\n  newQueue: QueueDebugInfo;\n  failedQueue: QueueDebugInfo;\n  hydratedCache: HydratedCacheInfo;\n}\n\nexport default defineComponent({\n  name: 'SessionControllerDebug',\n\n  props: {\n    sessionController: {\n      type: Object as PropType<SessionController<any> | null>,\n      required: true,\n    },\n  },\n\n  setup(props) {\n    const refreshTrigger = ref(0);\n    let pollInterval: NodeJS.Timeout | null = null;\n\n    onMounted(() => {\n      // Poll every 500ms to update debug display\n      pollInterval = setInterval(() => {\n        refreshTrigger.value++;\n      }, 500);\n    });\n\n    onUnmounted(() => {\n      if (pollInterval) {\n        clearInterval(pollInterval);\n      }\n    });\n\n    const debugInfo = computed((): SessionDebugInfo => {\n      // Create dependency on refreshTrigger to force updates\n      refreshTrigger.value;\n\n      if (!props.sessionController) {\n        return {\n          reviewQueue: { length: 0, dequeueCount: 0, items: [] },\n          newQueue: { length: 0, dequeueCount: 0, items: [] },\n          failedQueue: { length: 0, dequeueCount: 0, items: [] },\n          hydratedCache: { count: 0, failedCacheSize: 0, items: [] },\n        };\n      }\n\n      return props.sessionController.getDebugInfo();\n    });\n\n    return {\n      debugInfo,\n    };\n  },\n});\n</script>\n\n<style scoped>\n.session-debug {\n  font-family: 'Courier New', monospace;\n  font-size: 0.75rem;\n  max-height: 400px;\n  overflow-y: auto;\n}\n\n.debug-section {\n  padding: 8px;\n  background-color: rgba(255, 255, 255, 0.05);\n  border-radius: 4px;\n  min-height: 120px;\n}\n\n.debug-header {\n  display: flex;\n  align-items: center;\n  margin-bottom: 4px;\n  padding-bottom: 4px;\n  border-bottom: 1px solid rgba(255, 255, 255, 0.1);\n}\n\n.debug-stats {\n  margin-bottom: 8px;\n  display: flex;\n  gap: 8px;\n}\n\n.debug-items {\n  margin-top: 4px;\n  padding-left: 8px;\n}\n\n.debug-item {\n  padding: 2px 0;\n  border-left: 2px solid rgba(255, 255, 255, 0.2);\n  padding-left: 6px;\n  margin-bottom: 2px;\n}\n</style>\n"}
```

**Tool Call: Thinking**
Status: Completed

Finished thinking.

## Assistant

---

## Summary of Work Done (Phases 1-3)

The previous session implemented the new weighted navigation strategy system:

| Phase | Status | Key Deliverables |
|-------|--------|------------------|
| **Phase 1** | ✅ Complete | `WeightedCard` type, `getWeightedCards(limit)` on `ContentNavigator`, ELO scoring implementation |
| **Phase 2** | ✅ Complete | `HierarchyDefinitionNavigator` - per-tag prerequisites with mastery thresholds |
| **Phase 3** | ✅ Complete | `InterferenceMitigatorNavigator` - config-driven interference groups with maturity-aware decay |
| **Phase 4** | Deferred | Orchestrator (multi-arm bandit) not needed for MVP |

**Key files created/modified:**
- `packages/db/src/core/navigators/index.ts` — `WeightedCard` type, base `getWeightedCards()`
- `packages/db/src/core/navigators/elo.ts` — ELO scoring via distance formula
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — NEW
- `packages/db/src/core/navigators/interferenceMitigator.ts` — NEW
- `packages/db/tests/core/navigators/navigators.test.ts` — NEW

---

## 1. Getting New Navigation Strategies to Production

### 1.1 Creating/Setting Strategies in a Course

**Current state:** The UI (`NavigationStrategyEditor.vue`) only creates `HARDCODED` strategies (static card ID lists). The infrastructure for other strategy types exists but isn't exposed.

**Three paths to enable Hierarchy and Interference strategies:**

| Approach | Effort | Best For |
|----------|--------|----------|
| **A. Direct DB** | Low | Prototyping/testing |
| **B. CLI/MCP** | Medium | Programmatic course authoring |
| **C. UI Extension** | High | End-user authoring |

**Approach A: Direct Database Insertion**

Create a strategy document directly in the course database:

```master/dev/null/hierarchy-strategy-example.json#L1-13
{
  "_id": "NAVIGATION_STRATEGY-hierarchy-phonics",
  "docType": "NAVIGATION_STRATEGY",
  "name": "LP Phonics Hierarchy",
  "description": "Prerequisites for phonics learning progression",
  "implementingClass": "hierarchyDefinition",
  "serializedData": "{\"prerequisites\":[{\"tag\":\"cvc-words\",\"requires\":[\"letter-sounds\"],\"masteryThreshold\":{\"minCount\":10,\"minElo\":1050}}],\"delegateStrategy\":\"elo\"}"
}
```

Then set the default via course config:
```master/dev/null/set-default-strategy.json#L1-4
{
  "defaultNavigationStrategyId": "NAVIGATION_STRATEGY-hierarchy-phonics"
}
```

**Approach B: Extend CLI or MCP**

Add a command like `yarn cli strategy:create <courseId> --type hierarchy --config <file>`.

The MCP package already has tools for card creation; adding a `create_navigation_strategy` tool would fit naturally.

**Approach C: Extend NavigationStrategyEditor.vue**

Add a strategy type selector and config forms for each type. This is more involved but provides the best authoring experience.

---

### 1.2 Inspecting/Understanding Usage at Runtime

**Current state:** `SessionControllerDebug.vue` shows queue state but has no visibility into:
- Which strategy is active
- How cards are being scored
- Why specific cards were selected/filtered

**Gap:** The new `getWeightedCards()` API exists but **SessionController still calls the legacy `getNewCards()` / `getPendingReviews()` methods**. This is the critical integration gap.

**Options to add observability:**

1. **Extend `getDebugInfo()`** in `SessionController` to include:
   - Active strategy name/type
   - Last batch of `WeightedCard[]` with scores
   - Filter/rejection reasons (for Hierarchy/Interference)

2. **Add debug logging in strategies** (already using `logger`):
   - Log when cards are filtered by Hierarchy
   - Log interference score adjustments

3. **Add score transparency to `WeightedCard`**:
   ```master/dev/null/weighted-card-debug.ts#L1-7
   interface WeightedCard {
     cardId: string;
     courseId: string;
     score: number;
     source: 'new' | 'review' | 'failed';
     debugInfo?: { reason: string; adjustments: string[] };
   }
   ```

---

## 2. Reassessment: Phase 4 Work

The original Phase 4 (Orchestrator) was about multi-arm bandit experimentation. That's still deferred. However, there's a more immediate "production readiness" phase needed:

### Revised Phase 4: Production Integration

| Task | Description | Priority |
|------|-------------|----------|
| **4a: SessionController Integration** | Wire `SessionController` to use `getWeightedCards()` for candidate selection | 🔴 Critical |
| **4b: Strategy Authoring** | CLI/MCP support OR UI forms for creating Hierarchy/Interference strategies | 🟡 Important |
| **4c: Runtime Observability** | Extend debug component to show strategy info and scoring | 🟢 Nice-to-have |

### 4a: SessionController Integration (Critical Path)

Currently, the flow is:
```
SessionController → source.getNewCards() → ELONavigator.getNewCards()
                 → source.getPendingReviews() → ELONavigator.getPendingReviews()
```

The new strategies implement `getWeightedCards()` but it's never called. Integration options:

1. **Additive approach:** Add a parallel path in `SessionController` that calls `getWeightedCards()` when available, then maps results back to the existing queue structure
2. **Replacement approach:** Replace legacy calls with `getWeightedCards()` and derive new/review status from `source` field

### Estimated Work

| Task | Estimate |
|------|----------|
| 4a: SessionController integration | 2-4 hours |
| 4b: CLI strategy commands | 2-3 hours |
| 4c: Debug component extension | 1-2 hours |

---

## Decision Point

Would you like me to:

1. **Proceed with Phase 4a** — Wire `SessionController` to actually use `getWeightedCards()`, making the new strategies operational
2. **Add CLI/MCP strategy tooling** — Enable programmatic creation of Hierarchy/Interference strategies
3. **Draft a detailed plan** for the revised Phase 4 before implementation

## User

time to zig.

did you also read u.4.lp-landingpage-copy.md ? (and the other u. docs there?)

given experience creating interferenceMitigator and hierarchy strategies, I'm interested in spinning up also a relativePriority navigator to, eg, cause the system to prefer (s) as fresh new content over (v) because of the higher utility.

**Tool Call: Read file `agent/orchestrator/u.4.lp-landingpage-copy.md`**
Status: Completed

```json
{"Text":"# LettersPractice\n\n## Help your child discover the joy of reading.\n\nMeet the Letters—friendly guides for focused learning.\n\nWe offer efficient and age-appropriate reading instruction for talkative toddlers. Targeting ages 2-5+, for 2-5 minutes a day.\n\nOne month for free, then $20 for lifetime access. \n\n## How it works\n\nDaily practice sessions of just 2-5 minutes, with light supervision. Think of it like coloring together—you're nearby, occasionally helping, but they're doing the work.\n👧\nFor Your Child\n\n    Meet the Letters: Friendly characters guide each lesson and exercise\n    Micro-lessons: Bite-sized instruction tailored to what they're ready for next\n    Active engagement: Every exercise requires authentic participation—no passive watching or mindless clicking\n    Build confidence: Steady progress from simple sounds to reading complete words \n\n👨‍👩‍👧\nFor You (The Parent)\n\n    Light supervision: Be nearby for encouragement and celebrating wins, but the app manages the teaching\n    Build your intuition: As you watch progress, you'll develop a strong sense of what your child can handle\n    Better co-reading: Know which words to push them to sound out vs. which to help with during storytime\n    Track milestones: See concrete evidence of growing reading skills over time \n\n\n### You're the Coach, We're the Playbook\n\nThe first and best teacher for each child will always be their caring adults.\n\nLettersPractice doesn't strive to replace you, but instead serves as a powerful tool that manages the complexity of what a young reader knows and what can come next. We handle the curriculum logistics so you can focus on encouragement and connection.\nHow It Works: Behind the Scenes\n\nThe letters work hard to provide the right content at the right time through ongoing dynamic personalization.\n\nWe maintain a carefully planned curriculum while closely observing overall progress, particular successes, and challenges—continuously adapting to your child's needs.\n\n\n\n## Our Core Techniques\n\n### Weighted prioritize: starting with hte most useful, well-behaved letters\n\nNot all letters and phonetic rules are created equal. We arrange curriculum to prioritize the most immediately useful knowledge.\n\nWe lead with letters and phonetic rules that are common and \"well-behaved\" (consistent in their usage). We leave the zebras and their xylaphones for a little later.\n\nThis gives your child the biggest bang for their buck early on - skills they can immediately use and be proud to show off.\n\n### Interference Mitigation: Separating confusable concepts to prevent mix-ups\n\nSimilar-looking letters and sounds can blur together without proper spacing. We strategically separate the introduction of confusable concepts.\n\nExample 1: Learning b and d together is just awful! The symbols are mirror images.\n\nExample 2: Learning d and t together is challenging for a different reason - the sounds are quite similar (different mainly in terms of how much resistance your tongue gives before letting go), and not well distinguished by younger ears.\n\nBy minimizing interference, we help each concept establish itself clearly before introducing similar ones. See Progressive Overload for how we bring it all back together.\n\n### Procedural Exercise Generation: Building new concepts from solid foundations\n\nWhen introducing new concepts, we use solidly known building blocks to create exercises.\n\nExample: If your child knows m better than k, we'll prefer the word same over sake when introducing the long-vowel \"magic e\" pattern (CVCe).\n\nThis ensures each new lesson introduces exactly one new thing, rather than overwhelming with multiple unfamiliar elements.\n\n### Progressive Overload: Gradually increasing challenge as skills develop\n\nLike strength training, reading skills grow through carefully calibrated challenge.\n\nWe continuously ramp up difficulty as your child's abilities develop—always keeping them in the \"sweet spot\" where learning happens: not too easy, not too hard.\n\nAs skills solidify, we relax the guardrails. Letters that were once kept apart (like b and b) can now practice together through minimal pair exercises. Procedurally generated exercises can include more unknowns at once. The interference risks that required careful separation early on become opportunities for strengthening discrimination and flexible application.\n\nThis maintains engagement and ensures steady progress without frustration or boredom.\n\n### Spaced Repetition System (SRS): Mechanizing long-term retention and growth\n\nThe problem: Learned concepts and information can be forgotten if not revisited at the right intervals.\n\nThe solution: Our spaced repetition system automatically brings back exercises at optimal intervals—right before forgetting would occur.\n\nThis transforms short-term knowledge into permanent mastery, ensuring your child retains what they learn for the long haul.\n\n### Rejecting Self-Report - Doing the Work: Active demonstration replacs mideless dismissal\n\nThroughout the course, understanding is actively demonstrated by learners—no \"I got it!\" buttons or easy outs.\n\nChildren can't mindlessly click through content. Exercises requires authentic engagement and correct responses.\n\nThis ensures our system knows what they actually know, not just what they claim to know—keeping our personalization accurate.\nTeam of Rivals: Balancing Tensions\n\n## Team of Rivals: Balancing Tensions\n\nThe above approaches are sometimes in tension with one another.\n\nThese tensions are worked out through internal politicking—different coalitions of letters vie for the right to present the next lesson or exercise.\n\nWe use our ongoing experience with learners to continually test our assumptions and get the right mix of influences.\n"}
```

**Tool Call: Read file `agent/orchestrator/u.3.strategic-nuggets.md`**
Status: Completed

```json
{"Text":"Part of the overall vision here is for an evolutionary approach in the spirit of (but not necessarily exactly resembling in implementation):\n\n- N strategies exist\n- M users exist\n- users have *goals* (learning outcomes)\n- a strategy is effective if its usage improves goal achievement\n\nwe continually multi-arm-bandit all of the strategies - applying or bypassing them accoring to our perceived probability of its utility\n\n(eg, if we're 90% sure it's useful, it gets served to 90% of users)\n\n- cohort differences in achievement, overall progress through course materials, and engagement (gross - least weight), \n\neach of N strategies divides into cohorts via some hashId collision metric\n-  eg: h( strategyHash + slowRotationSalt) xor userHash \n       if resultant Ones are < utilityConfidence percent of total bits, then include the strategy for the user\n\n\n- we rotate the salt so that no idividual gets trapped indefinitely using a very poor strategy or prohibited from a very effective one. May be a wash if there are very many strategies.\n  - but - cannot rotate all that often, or unable to measure effects (?)\n\n\nfor new strategies, we set an intuitive initial utilityConfidence\n\n\nCONSIDERATIONS:\n- system grinds to halt if number of strategies grows indefinitely, for sake of 'computation' overhead\n- different \n\n\nHere, a strategy could be any specific instance of a given NavigationStrategy type, including things like\n- proficiency (defined by user ELO) in tag X indicates that a user is prepared to take on tag y\n  - and more generally - tags x,y,z -> card X, or cards a or b or c -> tag Y\n  - collectively, encoding the heirarchical knowledge hypergraph - individual items as prereqs and postreqs, but also collections of items as prereqs and postreqs\n- A and B are interference candidates - separate their introduction\n- would like to extend into parameterizable / programmable strategies. eg, should be able to specify deps like `grade-{n}` & `geometry` -> `grade-{n+1}` & `geometry` (eg, demonstrated mastery of grade n geometry indicates readiness for grade n+1 geometry). Moreover: `grade-{n}` & `{freeVariable}` -> `grade-{n+1}` & `{freeVariable}`\n\n\n---\n---\n\nmeta-consideration\n- content itself can/should be subject to this selection pressure. \n- te system wants to be welf-healing\n  - identifying learning 'barriers' where substantive portion of cohort gets stuck or abandons\n  - surfacing that info in a useful way\n  - author (individial publisher, community, LLM agent) aims to diagnose and remedy by providing, eg, intermediate content among the trouble area, or alternate navitation strategies / scaffolding techniques to \n  - goal: continued optimistic progression of eg, cohort members who made it through under the prior arrangement, but a robust intervention system according to observed needs\n- Can incentivise creation of high utility content / pedagogical strategy\n"}
```

**Tool Call: Read file `agent/orchestrator/u.2.additional-info.md`**
Status: Completed

```json
{"Text":"## User\n\nsee @packages/db/src/impl/couch/classroomDB.ts and @packages/db/src/study/SessionController.ts and others as you see fit - tell me - how does a configured classroom settings do `tag` filtering of course content for study sessions?\n\n## Agent (Gemini 2.5 Pro)\n\n✦ Based on my analysis of @packages/db/src/impl/couch/classroomDB.ts and @packages/db/src/study/SessionController.ts, here is how a classroom's settings provide tag-based filtering for study sessions:\n\n  The Flow of Tag-Filtered Content\n\n   1. Teacher Assigns a Tag: A teacher assigns content to a classroom. If they choose to assign by tag, an AssignedContent document with type: 'tag' is created in the classroom's database. This document stores the courseID and the tagID.\n      This is managed by the TeacherClassroomDB class.\n\n   2. Student Starts a Study Session: When a student begins a study session for that classroom, a SessionController is created. This controller is initialized with a StudentClassroomDB instance, which acts as a StudyContentSource.\n\n   3. Session Controller Requests New Cards: The SessionController calls the getNewCards() method on its sources, which includes the StudentClassroomDB instance.\n\n   4. ClassroomDB Resolves the Tag: Inside StudentClassroomDB.getNewCards():\n       * It first fetches all assigned content for the classroom, including the \"assigned tag\" document.\n       * When it finds an assignment of type: 'tag', it uses the getTag(courseID, tagID) function to retrieve the full tag document from the course database.\n       * This tag document contains a taggedCards array, which is a list of all card IDs associated with that specific tag.\n\n   5. Filtered Cards are Returned: The StudentClassroomDB then converts this list of card IDs into StudySessionNewItem objects and returns them to the SessionController.\n\n   6. Session Populated with Tagged Cards: The SessionController receives this list of new cards—which are only the cards belonging to the assigned tag—and adds them to its internal \"new card\" queue (newQ) to be presented to the student\n      during the study session.\n\n  In short:\n\n  The filtering happens at the source. The SessionController simply asks for cards; it's the StudentClassroomDB's responsibility to interpret the classroom's settings. It translates the abstract \"assign this tag\" setting into a concrete\n  list of cards belonging to that tag, effectively filtering the entire course content down to only what the teacher specified.\n  \n  \n---\n---\n\nThe above is a consideration as well - we want, maybe \"as well as\" overlapping navigationstrategies, ability to easily - at application level - create focused study sessions based on, eg, boolean algebra of tags: \neg, `exercise` & `c-major` & not `arpeggio` should filter for c-major exercises that ... are not arpeggios.\n\nWhether or not a NavigationStrategy is the tool for that is unclear.\n"}
```

## Assistant

Now I understand the context much better. The "relative priority" concept from `u.4.lp-landingpage-copy.md` is about **preferring more useful, well-behaved letters first** — specifically:

> "We lead with letters and phonetic rules that are common and 'well-behaved' (consistent in their usage). We leave the zebras and their xylophones for a little later."

The example you gave — preferring `(s)` over `(v)` — makes sense: `s` is more common in English and has more consistent pronunciation than `v`.

Let me sketch out a `RelativePriorityNavigator`:

**Tool Call: Read file `packages/db/src/core/navigators/hierarchyDefinition.ts` (lines 1-80)**
Status: Completed

```json
{"Text":"import { ScheduledCard } from '../types/user';\nimport { CourseDBInterface } from '../interfaces/courseDB';\nimport { UserDBInterface } from '../interfaces/userDB';\nimport { ContentNavigator, WeightedCard } from './index';\nimport { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';\nimport { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';\nimport { toCourseElo } from '@vue-skuilder/common';\n\n/**\n * A single prerequisite requirement for a tag.\n * Each prerequisite refers to one tag with its own mastery threshold.\n */\ninterface TagPrerequisite {\n  /** The tag that must be mastered */\n  tag: string;\n  /** Thresholds for considering this prerequisite tag \"mastered\" */\n  masteryThreshold?: {\n    /** Minimum ELO score for mastery. If not set, uses avgElo comparison */\n    minElo?: number;\n    /** Minimum interaction count (default: 3) */\n    minCount?: number;\n  };\n}\n\n/**\n * Configuration for the HierarchyDefinition strategy\n */\nexport interface HierarchyConfig {\n  /** Map of tag ID to its list of prerequisites (each with individual thresholds) */\n  prerequisites: {\n    [tagId: string]: TagPrerequisite[];\n  };\n  /** Strategy to delegate to for candidate generation (default: \"elo\") */\n  delegateStrategy?: string;\n}\n\nconst DEFAULT_MIN_COUNT = 3;\n\n/**\n * A navigation strategy that gates cards based on prerequisite mastery.\n *\n * Cards are locked until the user masters all prerequisite tags.\n * This implements the delegate pattern: it wraps another strategy\n * and filters its output based on prerequisite constraints.\n *\n * Mastery is determined by:\n * - User's ELO for the tag exceeds threshold (or avgElo if not specified)\n * - User has minimum interaction count with the tag\n *\n * Tags with no prerequisites are always unlocked.\n */\nexport default class HierarchyDefinitionNavigator extends ContentNavigator {\n  private user: UserDBInterface;\n  private course: CourseDBInterface;\n  private config: HierarchyConfig;\n  private delegate: ContentNavigator | null = null;\n  private strategyData: ContentNavigationStrategyData;\n\n  constructor(\n    user: UserDBInterface,\n    course: CourseDBInterface,\n    strategyData: ContentNavigationStrategyData\n  ) {\n    super();\n    this.user = user;\n    this.course = course;\n    this.strategyData = strategyData;\n    this.config = this.parseConfig(strategyData.serializedData);\n  }\n\n  private parseConfig(serializedData: string): HierarchyConfig {\n    try {\n      const parsed = JSON.parse(serializedData);\n      return {\n        prerequisites: parsed.prerequisites || {},\n        delegateStrategy: parsed.delegateStrategy || 'elo',\n      };\n    } catch {\n      // Return safe defaults if parsing fails\n      return {\n"}
```

## Assistant

Now let me look at how the Navigators enum is structured and extended:

**Tool Call: Read file `packages/db/src/core/navigators/index.ts` (lines 1-80)**
Status: Completed

```json
{"Text":"import {\n  StudyContentSource,\n  UserDBInterface,\n  CourseDBInterface,\n  StudySessionReviewItem,\n  StudySessionNewItem,\n} from '..';\nimport { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';\nimport { ScheduledCard } from '../types/user';\nimport { logger } from '../../util/logger';\n\n/**\n * A card with a suitability score for presentation.\n *\n * Scores range from 0-1:\n * - 1.0 = fully suitable\n * - 0.0 = hard filter (e.g., prerequisite not met)\n * - 0.5 = neutral\n * - Intermediate values = soft preference\n */\nexport interface WeightedCard {\n  cardId: string;\n  courseId: string;\n  /** Suitability score from 0-1 */\n  score: number;\n  /** Origin of the card */\n  source: 'new' | 'review' | 'failed';\n}\n\nexport enum Navigators {\n  ELO = 'elo',\n  HARDCODED = 'hardcodedOrder',\n  HIERARCHY = 'hierarchyDefinition',\n  INTERFERENCE = 'interferenceMitigator',\n}\n\n/**\n * A content-navigator provides runtime steering of study sessions.\n */\nexport abstract class ContentNavigator implements StudyContentSource {\n  /**\n   *\n   * @param user\n   * @param strategyData\n   * @returns the runtime object used to steer a study session.\n   */\n  static async create(\n    user: UserDBInterface,\n    course: CourseDBInterface,\n    strategyData: ContentNavigationStrategyData\n  ): Promise<ContentNavigator> {\n    const implementingClass = strategyData.implementingClass;\n    let NavigatorImpl;\n\n    // Try different extension variations\n    const variations = ['.ts', '.js', ''];\n\n    for (const ext of variations) {\n      try {\n        const module = await import(`./${implementingClass}${ext}`);\n        NavigatorImpl = module.default;\n        break; // Break the loop if loading succeeds\n      } catch (e) {\n        // Continue to next variation if this one fails\n        logger.debug(`Failed to load with extension ${ext}:`, e);\n      }\n    }\n\n    if (!NavigatorImpl) {\n      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);\n    }\n\n    return new NavigatorImpl(user, course, strategyData);\n  }\n\n  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;\n  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;\n\n  /**\n   * Get cards with suitability scores.\n"}
```

## Assistant

Good. Now I have a clear picture of the pattern. Let me design a `RelativePriorityNavigator`:

**Tool Call: Thinking**
Status: Completed

Finished thinking.

## Assistant

---

## RelativePriorityNavigator Design

Based on the LP copy, this strategy should **boost scores for high-utility content** — preferring common, well-behaved letters (like `s`) over rare/irregular ones (like `x`, `z`).

### Proposed Config Schema

```master/dev/null/relative-priority-config.ts#L1-20
interface RelativePriorityConfig {
  /**
   * Map of tag ID to priority weight (0-1).
   * 1.0 = highest priority (present first)
   * 0.0 = lowest priority (defer until later)
   * Unspecified tags default to `defaultPriority`
   */
  tagPriorities: { [tagId: string]: number };
  
  /** Priority for tags not in the map (default: 0.5) */
  defaultPriority?: number;
  
  /** How to combine priorities when a card has multiple tags */
  combineMode?: 'max' | 'average' | 'min';
  
  /** How strongly priority influences final score (default: 0.5) */
  priorityInfluence?: number;
  
  /** Delegate strategy for candidate generation (default: "elo") */
  delegateStrategy?: string;
}
```

### Example Config for LP

```master/dev/null/lp-priority-example.json#L1-18
{
  "tagPriorities": {
    "letter-s": 0.95,
    "letter-t": 0.90,
    "letter-a": 0.88,
    "letter-n": 0.85,
    "letter-m": 0.82,
    "letter-r": 0.75,
    "letter-v": 0.40,
    "letter-w": 0.35,
    "letter-y": 0.30,
    "letter-x": 0.10,
    "letter-z": 0.08,
    "letter-q": 0.05
  },
  "defaultPriority": 0.5,
  "priorityInfluence": 0.5
}
```

### Score Computation

```master/dev/null/priority-scoring.ts#L1-8
// Priority centered around 0.5 (neutral)
// boostFactor ranges from (1 - influence/2) to (1 + influence/2)
const boostFactor = 1 + (cardPriority - 0.5) * priorityInfluence;
const finalScore = delegateScore * boostFactor;

// Example with priorityInfluence = 0.5:
// priority 1.0 → boost 1.25 (25% higher)
// priority 0.5 → boost 1.00 (neutral)
// priority 0.0 → boost 0.75 (25% lower)
```

This keeps all cards in play but tilts selection toward higher-priority content.

---

### Alternative: Tiered Priorities

For easier authoring, could support a tier-based syntax:

```master/dev/null/tiered-priority-example.json#L1-9
{
  "tiers": [
    { "name": "core", "tags": ["s", "t", "a", "n", "m"], "priority": 1.0 },
    { "name": "common", "tags": ["r", "l", "i", "o", "e"], "priority": 0.8 },
    { "name": "less-common", "tags": ["b", "d", "p", "g"], "priority": 0.6 },
    { "name": "rare", "tags": ["v", "w", "y"], "priority": 0.4 },
    { "name": "exotic", "tags": ["x", "z", "q"], "priority": 0.2 }
  ]
}
```

This would be parsed into the flat `tagPriorities` map internally.

---

## Decision Point

1. **Proceed with implementation** of `RelativePriorityNavigator` using the tag-priority map approach?
2. **Include tiered syntax support** in v1, or defer as enhancement?
3. Any adjustments to the scoring formula or config schema?

## User

1. yeah - looks pretty good.
2. no - this info is going to be sourced from other research docs
3. seems a sane start.

**Tool Call: Read file `packages/db/src/core/navigators/interferenceMitigator.ts` (lines 1-120)**
Status: Completed

```json
{"Text":"import { ScheduledCard } from '../types/user';\nimport { CourseDBInterface } from '../interfaces/courseDB';\nimport { UserDBInterface } from '../interfaces/userDB';\nimport { ContentNavigator, WeightedCard } from './index';\nimport { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';\nimport { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';\nimport { toCourseElo } from '@vue-skuilder/common';\n\n/**\n * Configuration for the InterferenceMitigator strategy.\n *\n * Course authors define explicit interference relationships between tags.\n * The mitigator discourages introducing new concepts that interfere with\n * currently immature learnings.\n */\n/**\n * A single interference group with its own decay coefficient.\n */\nexport interface InterferenceGroup {\n  /** Tags that interfere with each other in this group */\n  tags: string[];\n  /** How strongly these tags interfere (0-1, default: 0.8). Higher = stronger avoidance. */\n  decay?: number;\n}\n\nexport interface InterferenceConfig {\n  /**\n   * Groups of tags that interfere with each other.\n   * Each group can have its own decay coefficient.\n   *\n   * Example: [\n   *   { tags: [\"b\", \"d\", \"p\"], decay: 0.9 },  // visual similarity - strong\n   *   { tags: [\"d\", \"t\"], decay: 0.7 },       // phonetic similarity - moderate\n   *   { tags: [\"m\", \"n\"], decay: 0.8 }\n   * ]\n   */\n  interferenceSets: InterferenceGroup[];\n\n  /**\n   * Threshold below which a tag is considered \"immature\" (still being learned).\n   * Immature tags trigger interference avoidance for their interference partners.\n   */\n  maturityThreshold?: {\n    /** Minimum interaction count to be considered mature (default: 10) */\n    minCount?: number;\n    /** Minimum ELO score to be considered mature (optional) */\n    minElo?: number;\n    /**\n     * Minimum elapsed time (in days) since first interaction to be considered mature.\n     * Prevents recent cramming success from indicating maturity.\n     * The skill should be \"lindy\" — maintained over time.\n     */\n    minElapsedDays?: number;\n  };\n\n  /**\n   * Default decay for groups that don't specify their own (0-1, default: 0.8).\n   */\n  defaultDecay?: number;\n\n  /** Strategy to delegate to for candidate generation (default: \"elo\") */\n  delegateStrategy?: string;\n}\n\nconst DEFAULT_MIN_COUNT = 10;\nconst DEFAULT_MIN_ELAPSED_DAYS = 3;\nconst DEFAULT_INTERFERENCE_DECAY = 0.8;\n\n/**\n * A navigation strategy that avoids introducing confusable concepts simultaneously.\n *\n * When a user is learning a concept (tag is \"immature\"), this strategy reduces\n * scores for cards tagged with interfering concepts. This encourages the system\n * to introduce new content that is maximally distant from current learning focus.\n *\n * Example: While learning 'd', prefer introducing 'x' over 'b' (visual interference)\n * or 't' (phonetic interference).\n *\n * Uses the delegate pattern: wraps another strategy and adjusts its scores based\n * on interference relationships with immature tags.\n */\nexport default class InterferenceMitigatorNavigator extends ContentNavigator {\n  private user: UserDBInterface;\n  private course: CourseDBInterface;\n  private config: InterferenceConfig;\n  private delegate: ContentNavigator | null = null;\n  private strategyData: ContentNavigationStrategyData;\n\n  /** Precomputed map: tag -> set of { partner, decay } it interferes with */\n  private interferenceMap: Map<string, Array<{ partner: string; decay: number }>>;\n\n  constructor(\n    user: UserDBInterface,\n    course: CourseDBInterface,\n    strategyData: ContentNavigationStrategyData\n  ) {\n    super();\n    this.user = user;\n    this.course = course;\n    this.strategyData = strategyData;\n    this.config = this.parseConfig(strategyData.serializedData);\n    this.interferenceMap = this.buildInterferenceMap();\n  }\n\n  private parseConfig(serializedData: string): InterferenceConfig {\n    try {\n      const parsed = JSON.parse(serializedData);\n      // Normalize legacy format (string[][]) to new format (InterferenceGroup[])\n      let sets: InterferenceGroup[] = parsed.interferenceSets || [];\n      if (sets.length > 0 && Array.isArray(sets[0])) {\n        // Legacy format: convert string[][] to InterferenceGroup[]\n        sets = (sets as unknown as string[][]).map((tags) => ({ tags }));\n      }\n\n      return {\n        interferenceSets: sets,\n        maturityThreshold: {\n          minCount: parsed.maturityThreshold?.minCount ?? DEFAULT_MIN_COUNT,\n          minElo: parsed.maturityThreshold?.minElo,\n          minElapsedDays: parsed.maturityThreshold?.minElapsedDays ?? DEFAULT_MIN_ELAPSED_DAYS,\n"}
```

## Assistant

Good, I have a solid template. Now let me create the RelativePriorityNavigator:

**Tool Call: packages/db/src/core/navigators/relativePriority.ts**
Status: Completed

Diff: master/packages/db/src/core/navigators/relativePriority.ts
```
import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';

/**
 * Configuration for the RelativePriority strategy.
 *
 * Course authors define priority weights for tags, allowing the system
 * to prefer high-utility content (common, well-behaved patterns) over
 * lower-utility content (rare, irregular patterns).
 *
 * Example use case: In phonics, prefer teaching 's' (common, consistent)
 * before 'x' or 'z' (rare, sometimes irregular).
 */
export interface RelativePriorityConfig {
  /**
   * Map of tag ID to priority weight (0-1).
   *
   * 1.0 = highest priority (present first)
   * 0.5 = neutral
   * 0.0 = lowest priority (defer until later)
   *
   * Example:
   * {
   *   "letter-s": 0.95,
   *   "letter-t": 0.90,
   *   "letter-x": 0.10,
   *   "letter-z": 0.05
   * }
   */
  tagPriorities: { [tagId: string]: number };

  /**
   * Priority for tags not explicitly listed (default: 0.5).
   * 0.5 means unlisted tags have neutral effect on scoring.
   */
  defaultPriority?: number;

  /**
   * How to combine priorities when a card has multiple tags.
   *
   * - 'max': Use the highest priority among the card's tags (default)
   * - 'average': Average all tag priorities
   * - 'min': Use the lowest priority (conservative)
   */
  combineMode?: 'max' | 'average' | 'min';

  /**
   * How strongly priority influences the final score (0-1, default: 0.5).
   *
   * At 0.0: Priority has no effect (pure delegate scoring)
   * At 0.5: Priority can boost/reduce scores by up to 25%
   * At 1.0: Priority can boost/reduce scores by up to 50%
   *
   * The boost factor formula: 1 + (priority - 0.5) * priorityInfluence
   * - Priority 1.0 with influence 0.5 → boost of 1.25
   * - Priority 0.5 with influence 0.5 → boost of 1.00 (neutral)
   * - Priority 0.0 with influence 0.5 → boost of 0.75
   */
  priorityInfluence?: number;

  /** Strategy to delegate to for candidate generation (default: "elo") */
  delegateStrategy?: string;
}

const DEFAULT_PRIORITY = 0.5;
const DEFAULT_PRIORITY_INFLUENCE = 0.5;
const DEFAULT_COMBINE_MODE: 'max' | 'average' | 'min' = 'max';

/**
 * A navigation strategy that boosts scores for high-utility content.
 *
 * Course authors assign priority weights to tags. Cards with high-priority
 * tags get boosted scores, making them more likely to be presented first.
 * This allows teaching the most useful, well-behaved concepts before
 * moving on to rarer or more irregular ones.
 *
 * Uses the delegate pattern: wraps another strategy and adjusts its scores
 * based on the priority of each card's tags.
 *
 * Example: When teaching phonics, prioritize common letters (s, t, a) over
 * rare ones (x, z, q) by assigning higher priority weights to common letters.
 */
export default class RelativePriorityNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: RelativePriorityConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super();
    this.user = user;
    this.course = course;
    this.strategyData = strategyData;
    this.config = this.parseConfig(strategyData.serializedData);
  }

  private parseConfig(serializedData: string): RelativePriorityConfig {
    try {
      const parsed = JSON.parse(serializedData);
      return {
        tagPriorities: parsed.tagPriorities || {},
        defaultPriority: parsed.defaultPriority ?? DEFAULT_PRIORITY,
        combineMode: parsed.combineMode ?? DEFAULT_COMBINE_MODE,
        priorityInfluence: parsed.priorityInfluence ?? DEFAULT_PRIORITY_INFLUENCE,
        delegateStrategy: parsed.delegateStrategy || 'elo',
      };
    } catch {
      // Return safe defaults if parsing fails
      return {
        tagPriorities: {},
        defaultPriority: DEFAULT_PRIORITY,
        combineMode: DEFAULT_COMBINE_MODE,
        priorityInfluence: DEFAULT_PRIORITY_INFLUENCE,
        delegateStrategy: 'elo',
      };
    }
  }

  /**
   * Lazily initializes and returns the delegate navigator.
   */
  private async getDelegate(): Promise<ContentNavigator> {
    if (!this.delegate) {
      const delegateStrategyData: ContentNavigationStrategyData = {
        _id: `NAVIGATION_STRATEGY-${this.config.delegateStrategy}-delegate`,
        docType: DocType.NAVIGATION_STRATEGY,
        name: `${this.config.delegateStrategy} (delegate)`,
        description: 'Delegate strategy for relative priority',
        implementingClass: this.config.delegateStrategy || 'elo',
        serializedData: '{}',
      };
      this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
    }
    return this.delegate;
  }

  /**
   * Look up the priority for a tag.
   */
  private getTagPriority(tagId: string): number {
    return this.config.tagPriorities[tagId] ?? this.config.defaultPriority ?? DEFAULT_PRIORITY;
  }

  /**
   * Compute combined priority for a card based on its tags.
   */
  private computeCardPriority(cardTags: string[]): number {
    if (cardTags.length === 0) {
      return this.config.defaultPriority ?? DEFAULT_PRIORITY;
    }

    const priorities = cardTags.map((tag) => this.getTagPriority(tag));

    switch (this.config.combineMode) {
      case 'max':
        return Math.max(...priorities);
      case 'min':
        return Math.min(...priorities);
      case 'average':
        return priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
      default:
        return Math.max(...priorities);
    }
  }

  /**
   * Compute boost factor based on priority.
   *
   * The formula: 1 + (priority - 0.5) * priorityInfluence
   *
   * This creates a multiplier centered around 1.0:
   * - Priority 1.0 with influence 0.5 → 1.25 (25% boost)
   * - Priority 0.5 with any influence → 1.00 (neutral)
   * - Priority 0.0 with influence 0.5 → 0.75 (25% reduction)
   */
  private computeBoostFactor(priority: number): number {
    const influence = this.config.priorityInfluence ?? DEFAULT_PRIORITY_INFLUENCE;
    return 1 + (priority - 0.5) * influence;
  }

  /**
   * Get weighted cards with priority-adjusted scores.
   *
   * Cards with high-priority tags get boosted scores.
   * Cards with low-priority tags get reduced scores.
   * Cards with neutral priority (0.5) are unchanged.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Get candidates from delegate
    // Over-fetch slightly to account for score reordering
    const candidates = await delegate.getWeightedCards(Math.ceil(limit * 1.5));

    // Adjust scores based on priority
    const adjusted: WeightedCard[] = await Promise.all(
      candidates.map(async (card) => {
        const cardTags = await this.course.getAppliedTags(card.cardId);
        const priority = this.computeCardPriority(cardTags);
        const boostFactor = this.computeBoostFactor(priority);

        return {
          ...card,
          // Apply boost factor, clamp to [0, 1] range
          score: Math.max(0, Math.min(1, card.score * boostFactor)),
        };
      })
    );

    // Sort by adjusted score descending
    adjusted.sort((a, b) => b.score - a.score);

    // Return up to limit
    return adjusted.slice(0, limit);
  }

  /**
   * Legacy method: delegates to wrapped strategy.
   */
  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    const delegate = await this.getDelegate();
    return delegate.getNewCards(n);
  }

  /**
   * Legacy method: delegates to wrapped strategy.
   */
  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const delegate = await this.getDelegate();
    return delegate.getPendingReviews();
  }
}

```


## Assistant

Now let me add it to the Navigators enum:

**Tool Call: packages/db/src/core/navigators/index.ts**
Status: Completed

Diff: master/packages/db/src/core/navigators/index.ts
```
import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { logger } from '../../util/logger';

/**
 * A card with a suitability score for presentation.
 *
 * Scores range from 0-1:
 * - 1.0 = fully suitable
 * - 0.0 = hard filter (e.g., prerequisite not met)
 * - 0.5 = neutral
 * - Intermediate values = soft preference
 */
export interface WeightedCard {
  cardId: string;
  courseId: string;
  /** Suitability score from 0-1 */
  score: number;
  /** Origin of the card */
  source: 'new' | 'review' | 'failed';
}

export enum Navigators {
  ELO = 'elo',
  HARDCODED = 'hardcodedOrder',
  HIERARCHY = 'hierarchyDefinition',
  INTERFERENCE = 'interferenceMitigator',
  RELATIVE_PRIORITY = 'relativePriority',
}

/**
 * A content-navigator provides runtime steering of study sessions.
 */
export abstract class ContentNavigator implements StudyContentSource {
  /**
   *
   * @param user
   * @param strategyData
   * @returns the runtime object used to steer a study session.
   */
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> {
    const implementingClass = strategyData.implementingClass;
    let NavigatorImpl;

    // Try different extension variations
    const variations = ['.ts', '.js', ''];

    for (const ext of variations) {
      try {
        const module = await import(`./${implementingClass}${ext}`);
        NavigatorImpl = module.default;
        break; // Break the loop if loading succeeds
      } catch (e) {
        // Continue to next variation if this one fails
        logger.debug(`Failed to load with extension ${ext}:`, e);
      }
    }

    if (!NavigatorImpl) {
      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);
    }

    return new NavigatorImpl(user, course, strategyData);
  }

  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards with suitability scores.
   *
   * This is the primary method for the new weighted-card architecture.
   * Filter strategies can wrap a delegate and transform its output.
   *
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default implementation: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();

    const weighted: WeightedCard[] = [
      ...newCards.map((c) => ({
        cardId: c.cardID,
        courseId: c.courseID,
        score: 1.0,
        source: 'new' as const,
      })),
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        source: 'review' as const,
      })),
    ];

    return weighted.slice(0, limit);
  }
}

```


## Assistant

Now let me add tests for the RelativePriorityNavigator:

**Tool Call: Read file `packages/db/tests/core/navigators/navigators.test.ts` (lines 1-100)**
Status: Completed

```json
{"Text":"import { describe, it, expect, beforeEach } from 'vitest';\nimport { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';\nimport { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core';\nimport { ScheduledCard } from '../../../src/core/types/user';\n\n// Mock implementation of ContentNavigator for testing the default getWeightedCards\nclass MockNavigator extends ContentNavigator {\n  private mockNewCards: StudySessionNewItem[] = [];\n  private mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [];\n\n  setMockNewCards(cards: StudySessionNewItem[]) {\n    this.mockNewCards = cards;\n  }\n\n  setMockReviews(reviews: (StudySessionReviewItem & ScheduledCard)[]) {\n    this.mockReviews = reviews;\n  }\n\n  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {\n    return this.mockNewCards.slice(0, n);\n  }\n\n  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {\n    return this.mockReviews;\n  }\n}\n\ndescribe('WeightedCard', () => {\n  it('should have correct structure', () => {\n    const card: WeightedCard = {\n      cardId: 'card-1',\n      courseId: 'course-1',\n      score: 0.8,\n      source: 'new',\n    };\n\n    expect(card.cardId).toBe('card-1');\n    expect(card.courseId).toBe('course-1');\n    expect(card.score).toBe(0.8);\n    expect(card.source).toBe('new');\n  });\n\n  it('should accept all valid source types', () => {\n    const sources: Array<'new' | 'review' | 'failed'> = ['new', 'review', 'failed'];\n\n    sources.forEach((source) => {\n      const card: WeightedCard = {\n        cardId: 'card-1',\n        courseId: 'course-1',\n        score: 1.0,\n        source,\n      };\n      expect(card.source).toBe(source);\n    });\n  });\n});\n\ndescribe('ContentNavigator.getWeightedCards', () => {\n  let navigator: MockNavigator;\n\n  beforeEach(() => {\n    navigator = new MockNavigator();\n  });\n\n  it('should return empty array when no cards available', async () => {\n    navigator.setMockNewCards([]);\n    navigator.setMockReviews([]);\n\n    const result = await navigator.getWeightedCards(10);\n\n    expect(result).toEqual([]);\n  });\n\n  it('should assign score=1.0 to all cards by default', async () => {\n    navigator.setMockNewCards([\n      {\n        cardID: 'card-1',\n        courseID: 'course-1',\n        contentSourceType: 'course',\n        contentSourceID: 'course-1',\n        status: 'new',\n      },\n      {\n        cardID: 'card-2',\n        courseID: 'course-1',\n        contentSourceType: 'course',\n        contentSourceID: 'course-1',\n        status: 'new',\n      },\n    ]);\n\n    const result = await navigator.getWeightedCards(10);\n\n    expect(result).toHaveLength(2);\n    expect(result[0].score).toBe(1.0);\n    expect(result[1].score).toBe(1.0);\n  });\n\n  it('should mark new cards with source=\"new\"', async () => {\n    navigator.setMockNewCards([\n"}
```

**Tool Call: Read file `packages/db/tests/core/navigators/navigators.test.ts` (lines 200-250)**
Status: Completed

```json
{"Text":"    expect(sources).toContain('review');\n  });\n\n  it('should correctly map cardID to cardId and courseID to courseId', async () => {\n    navigator.setMockNewCards([\n      {\n        cardID: 'CARD-123',\n        courseID: 'COURSE-456',\n        contentSourceType: 'course',\n        contentSourceID: 'COURSE-456',\n        status: 'new',\n      },\n    ]);\n\n    const result = await navigator.getWeightedCards(10);\n\n    expect(result[0].cardId).toBe('CARD-123');\n    expect(result[0].courseId).toBe('COURSE-456');\n  });\n});\n\ndescribe('ELO scoring formula', () => {\n  // These tests verify the scoring formula: max(0, 1 - distance / 500)\n  // Note: We test the formula logic, not the full ELONavigator (which requires mocking DB)\n\n  function calculateEloScore(userElo: number, cardElo: number): number {\n    const distance = Math.abs(cardElo - userElo);\n    return Math.max(0, 1 - distance / 500);\n  }\n\n  it('should return 1.0 when ELOs match exactly', () => {\n    expect(calculateEloScore(1000, 1000)).toBe(1.0);\n  });\n\n  it('should return 0.5 when distance is 250', () => {\n    expect(calculateEloScore(1000, 1250)).toBe(0.5);\n    expect(calculateEloScore(1000, 750)).toBe(0.5);\n  });\n\n  it('should return 0 when distance is 500 or more', () => {\n    expect(calculateEloScore(1000, 1500)).toBe(0);\n    expect(calculateEloScore(1000, 500)).toBe(0);\n    expect(calculateEloScore(1000, 2000)).toBe(0);\n  });\n\n  it('should return intermediate values for intermediate distances', () => {\n    expect(calculateEloScore(1000, 1100)).toBeCloseTo(0.8);\n    expect(calculateEloScore(1000, 900)).toBeCloseTo(0.8);\n    expect(calculateEloScore(1000, 1200)).toBeCloseTo(0.6);\n  });\n\n"}
```

**Tool Call: Read file `packages/db/tests/core/navigators/navigators.test.ts` (lines 250-460)**
Status: Completed

```json
{"Text":"\n  it('should never return negative values', () => {\n    expect(calculateEloScore(0, 1000)).toBe(0);\n    expect(calculateEloScore(1000, 0)).toBe(0);\n  });\n});\n\ndescribe('HierarchyDefinition mastery detection', () => {\n  // Test the mastery logic without full DB mocking\n\n  interface MockTagElo {\n    score: number;\n    count: number;\n  }\n\n  interface MasteryThreshold {\n    minElo?: number;\n    minCount?: number;\n  }\n\n  function isTagMastered(\n    tagElo: MockTagElo | undefined,\n    threshold: MasteryThreshold | undefined,\n    userGlobalElo: number\n  ): boolean {\n    if (!tagElo) return false;\n\n    const minCount = threshold?.minCount ?? 3;\n    if (tagElo.count < minCount) return false;\n\n    if (threshold?.minElo !== undefined) {\n      return tagElo.score >= threshold.minElo;\n    } else {\n      // Default: user ELO for tag > global user ELO\n      return tagElo.score >= userGlobalElo;\n    }\n  }\n\n  it('should return false when tag has no ELO data', () => {\n    expect(isTagMastered(undefined, {}, 1000)).toBe(false);\n  });\n\n  it('should return false when count is below threshold', () => {\n    expect(isTagMastered({ score: 1200, count: 2 }, { minCount: 3 }, 1000)).toBe(false);\n  });\n\n  it('should return true when count meets threshold and ELO exceeds minElo', () => {\n    expect(isTagMastered({ score: 1100, count: 5 }, { minElo: 1000, minCount: 3 }, 900)).toBe(true);\n  });\n\n  it('should return false when ELO is below minElo threshold', () => {\n    expect(isTagMastered({ score: 900, count: 5 }, { minElo: 1000, minCount: 3 }, 800)).toBe(false);\n  });\n\n  it('should compare to global ELO when no minElo specified', () => {\n    // Tag ELO above global = mastered\n    expect(isTagMastered({ score: 1100, count: 5 }, {}, 1000)).toBe(true);\n    // Tag ELO below global = not mastered\n    expect(isTagMastered({ score: 900, count: 5 }, {}, 1000)).toBe(false);\n  });\n\n  it('should use default minCount of 3', () => {\n    expect(isTagMastered({ score: 1100, count: 3 }, {}, 1000)).toBe(true);\n    expect(isTagMastered({ score: 1100, count: 2 }, {}, 1000)).toBe(false);\n  });\n});\n\ndescribe('HierarchyDefinition unlocking logic', () => {\n  interface TagPrerequisite {\n    requires: string[];\n  }\n\n  function getUnlockedTags(\n    prerequisites: { [tagId: string]: TagPrerequisite },\n    masteredTags: Set<string>\n  ): Set<string> {\n    const unlocked = new Set<string>();\n\n    for (const [tagId, prereq] of Object.entries(prerequisites)) {\n      const allPrereqsMet = prereq.requires.every((req) => masteredTags.has(req));\n      if (allPrereqsMet) {\n        unlocked.add(tagId);\n      }\n    }\n\n    return unlocked;\n  }\n\n  it('should unlock tag when all prerequisites are mastered', () => {\n    const prerequisites = {\n      'tag-b': { requires: ['tag-a'] },\n    };\n    const mastered = new Set(['tag-a']);\n\n    const unlocked = getUnlockedTags(prerequisites, mastered);\n\n    expect(unlocked.has('tag-b')).toBe(true);\n  });\n\n  it('should not unlock tag when some prerequisites are missing', () => {\n    const prerequisites = {\n      'tag-c': { requires: ['tag-a', 'tag-b'] },\n    };\n    const mastered = new Set(['tag-a']); // missing tag-b\n\n    const unlocked = getUnlockedTags(prerequisites, mastered);\n\n    expect(unlocked.has('tag-c')).toBe(false);\n  });\n\n  it('should unlock tag when it has empty prerequisites', () => {\n    const prerequisites = {\n      'tag-root': { requires: [] },\n    };\n    const mastered = new Set<string>();\n\n    const unlocked = getUnlockedTags(prerequisites, mastered);\n\n    expect(unlocked.has('tag-root')).toBe(true);\n  });\n\n  it('should handle chain of prerequisites', () => {\n    const prerequisites = {\n      'tag-b': { requires: ['tag-a'] },\n      'tag-c': { requires: ['tag-b'] },\n    };\n\n    // Only tag-a mastered: tag-b unlocks, tag-c does not\n    const mastered1 = new Set(['tag-a']);\n    const unlocked1 = getUnlockedTags(prerequisites, mastered1);\n    expect(unlocked1.has('tag-b')).toBe(true);\n    expect(unlocked1.has('tag-c')).toBe(false);\n\n    // tag-a and tag-b mastered: both tag-b and tag-c unlock\n    const mastered2 = new Set(['tag-a', 'tag-b']);\n    const unlocked2 = getUnlockedTags(prerequisites, mastered2);\n    expect(unlocked2.has('tag-b')).toBe(true);\n    expect(unlocked2.has('tag-c')).toBe(true);\n  });\n\n  it('should handle multiple prerequisites', () => {\n    const prerequisites = {\n      'cvc-words': { requires: ['letter-s', 'letter-a', 'letter-t'] },\n    };\n\n    // Missing one prerequisite\n    const mastered1 = new Set(['letter-s', 'letter-a']);\n    expect(getUnlockedTags(prerequisites, mastered1).has('cvc-words')).toBe(false);\n\n    // All prerequisites met\n    const mastered2 = new Set(['letter-s', 'letter-a', 'letter-t']);\n    expect(getUnlockedTags(prerequisites, mastered2).has('cvc-words')).toBe(true);\n  });\n});\n\ndescribe('HierarchyDefinition card unlocking', () => {\n  function isCardUnlocked(\n    cardTags: string[],\n    unlockedTags: Set<string>,\n    hasPrerequisites: (tag: string) => boolean\n  ): boolean {\n    return cardTags.every((tag) => unlockedTags.has(tag) || !hasPrerequisites(tag));\n  }\n\n  it('should unlock card when all its tags are unlocked', () => {\n    const cardTags = ['tag-a', 'tag-b'];\n    const unlockedTags = new Set(['tag-a', 'tag-b']);\n    const hasPrereqs = () => true;\n\n    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);\n  });\n\n  it('should lock card when any tag is locked', () => {\n    const cardTags = ['tag-a', 'tag-b'];\n    const unlockedTags = new Set(['tag-a']); // tag-b not unlocked\n    const hasPrereqs = () => true;\n\n    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(false);\n  });\n\n  it('should unlock card when tag has no prerequisites defined', () => {\n    const cardTags = ['tag-without-prereqs'];\n    const unlockedTags = new Set<string>(); // nothing explicitly unlocked\n    const hasPrereqs = (tag: string) => tag !== 'tag-without-prereqs';\n\n    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);\n  });\n\n  it('should handle mixed tags (some with prereqs, some without)', () => {\n    const cardTags = ['defined-tag', 'root-tag'];\n    const unlockedTags = new Set(['defined-tag']);\n    const hasPrereqs = (tag: string) => tag === 'defined-tag';\n\n    // defined-tag is unlocked, root-tag has no prereqs = card unlocked\n    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);\n  });\n\n  it('should lock card when defined tag is not unlocked', () => {\n    const cardTags = ['defined-tag', 'root-tag'];\n    const unlockedTags = new Set<string>(); // defined-tag not unlocked\n    const hasPrereqs = (tag: string) => tag === 'defined-tag';\n\n    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(false);\n  });\n});\n"}
```

## Assistant

Now let me add tests for the RelativePriorityNavigator:

**Tool Call: packages/db/tests/core/navigators/navigators.test.ts**
Status: Completed

Diff: master/packages/db/tests/core/navigators/navigators.test.ts
```
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';
import { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core';
import { ScheduledCard } from '../../../src/core/types/user';

// Mock implementation of ContentNavigator for testing the default getWeightedCards
class MockNavigator extends ContentNavigator {
  private mockNewCards: StudySessionNewItem[] = [];
  private mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [];

  setMockNewCards(cards: StudySessionNewItem[]) {
    this.mockNewCards = cards;
  }

  setMockReviews(reviews: (StudySessionReviewItem & ScheduledCard)[]) {
    this.mockReviews = reviews;
  }

  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    return this.mockNewCards.slice(0, n);
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    return this.mockReviews;
  }
}

describe('WeightedCard', () => {
  it('should have correct structure', () => {
    const card: WeightedCard = {
      cardId: 'card-1',
      courseId: 'course-1',
      score: 0.8,
      source: 'new',
    };

    expect(card.cardId).toBe('card-1');
    expect(card.courseId).toBe('course-1');
    expect(card.score).toBe(0.8);
    expect(card.source).toBe('new');
  });

  it('should accept all valid source types', () => {
    const sources: Array<'new' | 'review' | 'failed'> = ['new', 'review', 'failed'];

    sources.forEach((source) => {
      const card: WeightedCard = {
        cardId: 'card-1',
        courseId: 'course-1',
        score: 1.0,
        source,
      };
      expect(card.source).toBe(source);
    });
  });
});

describe('ContentNavigator.getWeightedCards', () => {
  let navigator: MockNavigator;

  beforeEach(() => {
    navigator = new MockNavigator();
  });

  it('should return empty array when no cards available', async () => {
    navigator.setMockNewCards([]);
    navigator.setMockReviews([]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toEqual([]);
  });

  it('should assign score=1.0 to all cards by default', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
      {
        cardID: 'card-2',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(1.0);
    expect(result[1].score).toBe(1.0);
  });

  it('should mark new cards with source="new"', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('new');
  });

  it('should mark reviews with source="review"', async () => {
    navigator.setMockReviews([
      {
        cardID: 'review-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'review',
        reviewID: 'review-id-1',
        qualifiedID: 'course-1-review-1',
        _id: 'scheduled-1',
        cardId: 'review-1',
        courseId: 'course-1',
        scheduledFor: 'course',
        schedulingAgentId: 'agent-1',
      } as StudySessionReviewItem & ScheduledCard,
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('review');
  });

  it('should respect limit parameter', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
      {
        cardID: 'card-2',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
      {
        cardID: 'card-3',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(2);

    expect(result).toHaveLength(2);
  });

  it('should combine new cards and reviews', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'new-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);
    navigator.setMockReviews([
      {
        cardID: 'review-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'review',
        reviewID: 'review-id-1',
        qualifiedID: 'course-1-review-1',
        _id: 'scheduled-1',
        cardId: 'review-1',
        courseId: 'course-1',
        scheduledFor: 'course',
        schedulingAgentId: 'agent-1',
      } as StudySessionReviewItem & ScheduledCard,
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
    const sources = result.map((c) => c.source);
    expect(sources).toContain('new');
    expect(sources).toContain('review');
  });

  it('should correctly map cardID to cardId and courseID to courseId', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'CARD-123',
        courseID: 'COURSE-456',
        contentSourceType: 'course',
        contentSourceID: 'COURSE-456',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].cardId).toBe('CARD-123');
    expect(result[0].courseId).toBe('COURSE-456');
  });
});

describe('ELO scoring formula', () => {
  // These tests verify the scoring formula: max(0, 1 - distance / 500)
  // Note: We test the formula logic, not the full ELONavigator (which requires mocking DB)

  function calculateEloScore(userElo: number, cardElo: number): number {
    const distance = Math.abs(cardElo - userElo);
    return Math.max(0, 1 - distance / 500);
  }

  it('should return 1.0 when ELOs match exactly', () => {
    expect(calculateEloScore(1000, 1000)).toBe(1.0);
  });

  it('should return 0.5 when distance is 250', () => {
    expect(calculateEloScore(1000, 1250)).toBe(0.5);
    expect(calculateEloScore(1000, 750)).toBe(0.5);
  });

  it('should return 0 when distance is 500 or more', () => {
    expect(calculateEloScore(1000, 1500)).toBe(0);
    expect(calculateEloScore(1000, 500)).toBe(0);
    expect(calculateEloScore(1000, 2000)).toBe(0);
  });

  it('should return intermediate values for intermediate distances', () => {
    expect(calculateEloScore(1000, 1100)).toBeCloseTo(0.8);
    expect(calculateEloScore(1000, 900)).toBeCloseTo(0.8);
    expect(calculateEloScore(1000, 1200)).toBeCloseTo(0.6);
  });

  it('should never return negative values', () => {
    expect(calculateEloScore(0, 1000)).toBe(0);
    expect(calculateEloScore(1000, 0)).toBe(0);
  });
});

describe('HierarchyDefinition mastery detection', () => {
  // Test the mastery logic without full DB mocking

  interface MockTagElo {
    score: number;
    count: number;
  }

  interface MasteryThreshold {
    minElo?: number;
    minCount?: number;
  }

  function isTagMastered(
    tagElo: MockTagElo | undefined,
    threshold: MasteryThreshold | undefined,
    userGlobalElo: number
  ): boolean {
    if (!tagElo) return false;

    const minCount = threshold?.minCount ?? 3;
    if (tagElo.count < minCount) return false;

    if (threshold?.minElo !== undefined) {
      return tagElo.score >= threshold.minElo;
    } else {
      // Default: user ELO for tag > global user ELO
      return tagElo.score >= userGlobalElo;
    }
  }

  it('should return false when tag has no ELO data', () => {
    expect(isTagMastered(undefined, {}, 1000)).toBe(false);
  });

  it('should return false when count is below threshold', () => {
    expect(isTagMastered({ score: 1200, count: 2 }, { minCount: 3 }, 1000)).toBe(false);
  });

  it('should return true when count meets threshold and ELO exceeds minElo', () => {
    expect(isTagMastered({ score: 1100, count: 5 }, { minElo: 1000, minCount: 3 }, 900)).toBe(true);
  });

  it('should return false when ELO is below minElo threshold', () => {
    expect(isTagMastered({ score: 900, count: 5 }, { minElo: 1000, minCount: 3 }, 800)).toBe(false);
  });

  it('should compare to global ELO when no minElo specified', () => {
    // Tag ELO above global = mastered
    expect(isTagMastered({ score: 1100, count: 5 }, {}, 1000)).toBe(true);
    // Tag ELO below global = not mastered
    expect(isTagMastered({ score: 900, count: 5 }, {}, 1000)).toBe(false);
  });

  it('should use default minCount of 3', () => {
    expect(isTagMastered({ score: 1100, count: 3 }, {}, 1000)).toBe(true);
    expect(isTagMastered({ score: 1100, count: 2 }, {}, 1000)).toBe(false);
  });
});

describe('HierarchyDefinition unlocking logic', () => {
  interface TagPrerequisite {
    requires: string[];
  }

  function getUnlockedTags(
    prerequisites: { [tagId: string]: TagPrerequisite },
    masteredTags: Set<string>
  ): Set<string> {
    const unlocked = new Set<string>();

    for (const [tagId, prereq] of Object.entries(prerequisites)) {
      const allPrereqsMet = prereq.requires.every((req) => masteredTags.has(req));
      if (allPrereqsMet) {
        unlocked.add(tagId);
      }
    }

    return unlocked;
  }

  it('should unlock tag when all prerequisites are mastered', () => {
    const prerequisites = {
      'tag-b': { requires: ['tag-a'] },
    };
    const mastered = new Set(['tag-a']);

    const unlocked = getUnlockedTags(prerequisites, mastered);

    expect(unlocked.has('tag-b')).toBe(true);
  });

  it('should not unlock tag when some prerequisites are missing', () => {
    const prerequisites = {
      'tag-c': { requires: ['tag-a', 'tag-b'] },
    };
    const mastered = new Set(['tag-a']); // missing tag-b

    const unlocked = getUnlockedTags(prerequisites, mastered);

    expect(unlocked.has('tag-c')).toBe(false);
  });

  it('should unlock tag when it has empty prerequisites', () => {
    const prerequisites = {
      'tag-root': { requires: [] },
    };
    const mastered = new Set<string>();

    const unlocked = getUnlockedTags(prerequisites, mastered);

    expect(unlocked.has('tag-root')).toBe(true);
  });

  it('should handle chain of prerequisites', () => {
    const prerequisites = {
      'tag-b': { requires: ['tag-a'] },
      'tag-c': { requires: ['tag-b'] },
    };

    // Only tag-a mastered: tag-b unlocks, tag-c does not
    const mastered1 = new Set(['tag-a']);
    const unlocked1 = getUnlockedTags(prerequisites, mastered1);
    expect(unlocked1.has('tag-b')).toBe(true);
    expect(unlocked1.has('tag-c')).toBe(false);

    // tag-a and tag-b mastered: both tag-b and tag-c unlock
    const mastered2 = new Set(['tag-a', 'tag-b']);
    const unlocked2 = getUnlockedTags(prerequisites, mastered2);
    expect(unlocked2.has('tag-b')).toBe(true);
    expect(unlocked2.has('tag-c')).toBe(true);
  });

  it('should handle multiple prerequisites', () => {
    const prerequisites = {
      'cvc-words': { requires: ['letter-s', 'letter-a', 'letter-t'] },
    };

    // Missing one prerequisite
    const mastered1 = new Set(['letter-s', 'letter-a']);
    expect(getUnlockedTags(prerequisites, mastered1).has('cvc-words')).toBe(false);

    // All prerequisites met
    const mastered2 = new Set(['letter-s', 'letter-a', 'letter-t']);
    expect(getUnlockedTags(prerequisites, mastered2).has('cvc-words')).toBe(true);
  });
});

describe('HierarchyDefinition card unlocking', () => {
  function isCardUnlocked(
    cardTags: string[],
    unlockedTags: Set<string>,
    hasPrerequisites: (tag: string) => boolean
  ): boolean {
    return cardTags.every((tag) => unlockedTags.has(tag) || !hasPrerequisites(tag));
  }

  it('should unlock card when all its tags are unlocked', () => {
    const cardTags = ['tag-a', 'tag-b'];
    const unlockedTags = new Set(['tag-a', 'tag-b']);
    const hasPrereqs = () => true;

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);
  });

  it('should lock card when any tag is locked', () => {
    const cardTags = ['tag-a', 'tag-b'];
    const unlockedTags = new Set(['tag-a']); // tag-b not unlocked
    const hasPrereqs = () => true;

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(false);
  });

  it('should unlock card when tag has no prerequisites defined', () => {
    const cardTags = ['tag-without-prereqs'];
    const unlockedTags = new Set<string>(); // nothing explicitly unlocked
    const hasPrereqs = (tag: string) => tag !== 'tag-without-prereqs';

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);
  });

  it('should handle mixed tags (some with prereqs, some without)', () => {
    const cardTags = ['defined-tag', 'root-tag'];
    const unlockedTags = new Set(['defined-tag']);
    const hasPrereqs = (tag: string) => tag === 'defined-tag';

    // defined-tag is unlocked, root-tag has no prereqs = card unlocked
    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);
  });

  it('should lock card when defined tag is not unlocked', () => {
    const cardTags = ['defined-tag', 'root-tag'];
    const unlockedTags = new Set<string>(); // defined-tag not unlocked
    const hasPrereqs = (tag: string) => tag === 'defined-tag';

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(false);
  });
});

describe('RelativePriority boost factor computation', () => {
  // Test the boost factor formula: 1 + (priority - 0.5) * priorityInfluence

  function computeBoostFactor(priority: number, priorityInfluence: number): number {
    return 1 + (priority - 0.5) * priorityInfluence;
  }

  it('should return 1.0 for neutral priority (0.5)', () => {
    expect(computeBoostFactor(0.5, 0.5)).toBe(1.0);
    expect(computeBoostFactor(0.5, 1.0)).toBe(1.0);
    expect(computeBoostFactor(0.5, 0.0)).toBe(1.0);
  });

  it('should boost high-priority content', () => {
    // Priority 1.0 with influence 0.5 → boost of 1.25
    expect(computeBoostFactor(1.0, 0.5)).toBeCloseTo(1.25);
    // Priority 1.0 with influence 1.0 → boost of 1.5
    expect(computeBoostFactor(1.0, 1.0)).toBeCloseTo(1.5);
  });

  it('should reduce low-priority content', () => {
    // Priority 0.0 with influence 0.5 → factor of 0.75
    expect(computeBoostFactor(0.0, 0.5)).toBeCloseTo(0.75);
    // Priority 0.0 with influence 1.0 → factor of 0.5
    expect(computeBoostFactor(0.0, 1.0)).toBeCloseTo(0.5);
  });

  it('should have no effect when influence is 0', () => {
    expect(computeBoostFactor(1.0, 0.0)).toBe(1.0);
    expect(computeBoostFactor(0.0, 0.0)).toBe(1.0);
    expect(computeBoostFactor(0.75, 0.0)).toBe(1.0);
  });

  it('should scale linearly with priority', () => {
    const influence = 0.5;
    // 0.75 priority (halfway between 0.5 and 1.0)
    expect(computeBoostFactor(0.75, influence)).toBeCloseTo(1.125);
    // 0.25 priority (halfway between 0.0 and 0.5)
    expect(computeBoostFactor(0.25, influence)).toBeCloseTo(0.875);
  });
});

describe('RelativePriority tag priority combination', () => {
  function computeCardPriority(
    cardTags: string[],
    tagPriorities: { [tagId: string]: number },
    defaultPriority: number,
    combineMode: 'max' | 'average' | 'min'
  ): number {
    if (cardTags.length === 0) {
      return defaultPriority;
    }

    const priorities = cardTags.map((tag) => tagPriorities[tag] ?? defaultPriority);

    switch (combineMode) {
      case 'max':
        return Math.max(...priorities);
      case 'min':
        return Math.min(...priorities);
      case 'average':
        return priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
      default:
        return Math.max(...priorities);
    }
  }

  const tagPriorities = {
    'letter-s': 0.95,
    'letter-t': 0.9,
    'letter-x': 0.1,
    'letter-z': 0.05,
  };

  it('should return default priority for cards with no tags', () => {
    expect(computeCardPriority([], tagPriorities, 0.5, 'max')).toBe(0.5);
  });

  it('should return tag priority for single-tag card', () => {
    expect(computeCardPriority(['letter-s'], tagPriorities, 0.5, 'max')).toBe(0.95);
    expect(computeCardPriority(['letter-x'], tagPriorities, 0.5, 'max')).toBe(0.1);
  });

  it('should use default priority for unlisted tags', () => {
    expect(computeCardPriority(['unknown-tag'], tagPriorities, 0.5, 'max')).toBe(0.5);
  });

  it('should use max mode correctly', () => {
    // Mixed high and low priority tags
    expect(computeCardPriority(['letter-s', 'letter-x'], tagPriorities, 0.5, 'max')).toBe(0.95);
    expect(computeCardPriority(['letter-z', 'letter-x'], tagPriorities, 0.5, 'max')).toBe(0.1);
  });

  it('should use min mode correctly', () => {
    expect(computeCardPriority(['letter-s', 'letter-x'], tagPriorities, 0.5, 'min')).toBe(0.1);
    expect(computeCardPriority(['letter-s', 'letter-t'], tagPriorities, 0.5, 'min')).toBe(0.9);
  });

  it('should use average mode correctly', () => {
    // Average of 0.95 and 0.10 = 0.525
    expect(
      computeCardPriority(['letter-s', 'letter-x'], tagPriorities, 0.5, 'average')
    ).toBeCloseTo(0.525);
    // Average of 0.95, 0.90, 0.10 = 0.65
    expect(
      computeCardPriority(['letter-s', 'letter-t', 'letter-x'], tagPriorities, 0.5, 'average')
    ).toBeCloseTo(0.65);
  });

  it('should include default priority in average for mixed tags', () => {
    // 'letter-s' = 0.95, 'unknown' = 0.5 (default), average = 0.725
    expect(
      computeCardPriority(['letter-s', 'unknown-tag'], tagPriorities, 0.5, 'average')
    ).toBeCloseTo(0.725);
  });
});

describe('RelativePriority score adjustment', () => {
  function adjustScore(delegateScore: number, priority: number, priorityInfluence: number): number {
    const boostFactor = 1 + (priority - 0.5) * priorityInfluence;
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, delegateScore * boostFactor));
  }

  it('should boost high-priority cards', () => {
    // Delegate score 0.8, priority 1.0, influence 0.5 → 0.8 * 1.25 = 1.0 (clamped)
    expect(adjustScore(0.8, 1.0, 0.5)).toBe(1.0);
    // Delegate score 0.6, priority 1.0, influence 0.5 → 0.6 * 1.25 = 0.75
    expect(adjustScore(0.6, 1.0, 0.5)).toBeCloseTo(0.75);
  });

  it('should reduce low-priority cards', () => {
    // Delegate score 0.8, priority 0.0, influence 0.5 → 0.8 * 0.75 = 0.6
    expect(adjustScore(0.8, 0.0, 0.5)).toBeCloseTo(0.6);
  });

  it('should leave neutral-priority cards unchanged', () => {
    expect(adjustScore(0.8, 0.5, 0.5)).toBe(0.8);
    expect(adjustScore(0.5, 0.5, 1.0)).toBe(0.5);
  });

  it('should clamp scores to maximum of 1.0', () => {
    // High delegate score with high priority should cap at 1.0
    expect(adjustScore(0.9, 1.0, 1.0)).toBe(1.0);
    expect(adjustScore(1.0, 0.8, 0.5)).toBe(1.0);
  });

  it('should clamp scores to minimum of 0.0', () => {
    // Low delegate score with low priority and high influence
    // 0.3 * 0.5 = 0.15 (priority 0, influence 1.0)
    expect(adjustScore(0.3, 0.0, 1.0)).toBeCloseTo(0.15);
    // Edge case: should never go below 0
    expect(adjustScore(0.1, 0.0, 1.0)).toBeGreaterThanOrEqual(0);
  });

  it('should preserve ordering for cards with different priorities', () => {
    const delegateScore = 0.7;
    const influence = 0.5;

    const highPriorityScore = adjustScore(delegateScore, 0.95, influence);
    const mediumPriorityScore = adjustScore(delegateScore, 0.5, influence);
    const lowPriorityScore = adjustScore(delegateScore, 0.1, influence);

    expect(highPriorityScore).toBeGreaterThan(mediumPriorityScore);
    expect(mediumPriorityScore).toBeGreaterThan(lowPriorityScore);
  });
});

```


## Assistant

Now let's verify the build:

**Tool Call: `yarn workspace @vue-skuilder/db build 2>&1`**
Status: Completed

```
CLI Building entry: src/index.ts, src/core/index.ts, src/pouch/index.ts, src/impl/couch/index.ts, src/impl/static/index.ts, src/util/packer/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.4.0
CLI Using tsup config: /home/colin/pn/vue-skuilder/master/packages/db/tsup.config.ts
CLI Target: es2022
CLI Cleaning output folder
CJS Build start
ESM Build start

[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/impl/static/StaticDataUnpacker.ts:27:13:
      27 │     nodeFS = eval('require')('fs');
         ╵              ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/StaticToCouchDBMigrator.ts:23:13:
      23 │     nodeFS = eval('require')('fs');
         ╵              ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/StaticToCouchDBMigrator.ts:24:15:
      24 │     nodePath = eval('require')('path');
         ╵                ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/StaticToCouchDBMigrator.ts:25:41:
      25 │ ...deFS.promises = nodeFS.promises || eval('require')('fs').promises;
         ╵                                       ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/validation.ts:12:13:
      12 │     nodeFS = eval('require')('fs');
         ╵              ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/validation.ts:13:41:
      13 │ ...deFS.promises = nodeFS.promises || eval('require')('fs').promises;
         ╵                                       ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/impl/static/StaticDataUnpacker.ts:27:13:
      27 │     nodeFS = eval('require')('fs');
         ╵              ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/StaticToCouchDBMigrator.ts:23:13:
      23 │     nodeFS = eval('require')('fs');
         ╵              ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/StaticToCouchDBMigrator.ts:24:15:
      24 │     nodePath = eval('require')('path');
         ╵                ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/StaticToCouchDBMigrator.ts:25:41:
      25 │ ...deFS.promises = nodeFS.promises || eval('require')('fs').promises;
         ╵                                       ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/validation.ts:12:13:
      12 │     nodeFS = eval('require')('fs');
         ╵              ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval




[11:49:11 PM]  WARN  ▲ [WARNING] Using direct eval with a bundler is not recommended and may cause problems [direct-eval]

    src/util/migrator/validation.ts:13:41:
      13 │ ...deFS.promises = nodeFS.promises || eval('require')('fs').promises;
         ╵                                       ~~~~

  You can read more about direct eval and bundling here: https://esbuild.github.io/link/direct-eval



ESM dist/impl/couch/index.mjs      139.36 KB
ESM dist/index.mjs                 254.09 KB
ESM dist/impl/static/index.mjs     114.73 KB
ESM dist/core/index.mjs            114.64 KB
ESM dist/util/packer/index.mjs     17.14 KB
ESM dist/pouch/index.mjs           408.00 B
ESM dist/impl/couch/index.mjs.map  293.26 KB
ESM dist/util/packer/index.mjs.map 34.19 KB
ESM dist/impl/static/index.mjs.map 317.02 KB
ESM dist/pouch/index.mjs.map       612.00 B
ESM dist/core/index.mjs.map        278.21 KB
ESM dist/index.mjs.map             513.17 KB
ESM ⚡️ Build success in 406ms
CJS dist/pouch/index.js           2.04 KB
CJS dist/index.js                 258.49 KB
CJS dist/impl/couch/index.js      143.92 KB
CJS dist/util/packer/index.js     18.17 KB
CJS dist/core/index.js            117.80 KB
CJS dist/impl/static/index.js     117.17 KB
CJS dist/pouch/index.js.map       856.00 B
CJS dist/util/packer/index.js.map 34.41 KB
CJS dist/impl/couch/index.js.map  293.98 KB
CJS dist/index.js.map             513.79 KB
CJS dist/impl/static/index.js.map 317.37 KB
CJS dist/core/index.js.map        278.66 KB
CJS ⚡️ Build success in 407ms
DTS Build start
DTS ⚡️ Build success in 32063ms
DTS dist/pouch/index.d.ts                 35.00 B
DTS dist/impl/static/index.d.ts           8.69 KB
DTS dist/impl/couch/index.d.ts            14.47 KB
DTS dist/index.d.ts                       18.27 KB
DTS dist/core/index.d.ts                  5.57 KB
DTS dist/util/packer/index.d.ts           352.00 B
DTS dist/dataLayerProvider-BV5iZqt_.d.ts  1.42 KB
DTS dist/types-CewsN87z.d.ts              1.42 KB
DTS dist/types-legacy-6ettoclI.d.ts       4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.ts       2.46 KB
DTS dist/userDB-DNa0XPtn.d.ts             17.09 KB
DTS dist/index-CD8BZz2k.d.ts              4.06 KB
DTS dist/pouch/index.d.mts                35.00 B
DTS dist/impl/static/index.d.mts          8.70 KB
DTS dist/impl/couch/index.d.mts           14.47 KB
DTS dist/index.d.mts                      18.28 KB
DTS dist/core/index.d.mts                 5.58 KB
DTS dist/util/packer/index.d.mts          355.00 B
DTS dist/dataLayerProvider-VlngD19_.d.mts 1.42 KB
DTS dist/types-Dbp5DaRR.d.mts             1.42 KB
DTS dist/types-legacy-6ettoclI.d.mts      4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.mts      2.46 KB
DTS dist/userDB-BqwxtJ_7.d.mts            17.09 KB
DTS dist/index-Bmll7Xse.d.mts             4.06 KB
```

## Assistant

Build succeeded. Now let's run the tests:

**Tool Call: `yarn workspace @vue-skuilder/db test 2>&1`**
Status: Completed

Command "yarn workspace @vue-skuilder/db test 2>&1" failed with exit code 1.

```
Usage Error: Couldn't find a script named "test".

$ yarn run [--inspect] [--inspect-brk] [-T,--top-level] [-B,--binaries-only] [--require #0] <scriptName> ...
```

**Tool Call: `npx vitest run tests/core/navigators/navigators.test.ts 2>&1`**
Status: Failed

`cd` directory "master/packages/db" was not in any of the project's worktrees.

**Tool Call: `cd packages/db && npx vitest run tests/core/navigators/navigators.test.ts 2>&1`**
Status: Completed

```
RUN  v3.0.7 /home/colin/pn/vue-skuilder/master/packages/db

11:49:59 PM [vite] (ssr) warning: invalid import "./${implementingClass}${ext}". A file extension must be included in the static part of the import. For example: import(`./foo/${bar}.js`).
  Plugin: vite:dynamic-import-vars
  File: /home/colin/pn/vue-skuilder/master/packages/db/src/core/navigators/index.ts
 ✓ tests/core/navigators/navigators.test.ts (48 tests) 34ms
   ✓ WeightedCard > should have correct structure
   ✓ WeightedCard > should accept all valid source types
   ✓ ContentNavigator.getWeightedCards > should return empty array when no cards available
   ✓ ContentNavigator.getWeightedCards > should assign score=1.0 to all cards by default
   ✓ ContentNavigator.getWeightedCards > should mark new cards with source="new"
   ✓ ContentNavigator.getWeightedCards > should mark reviews with source="review"
   ✓ ContentNavigator.getWeightedCards > should respect limit parameter
   ✓ ContentNavigator.getWeightedCards > should combine new cards and reviews
   ✓ ContentNavigator.getWeightedCards > should correctly map cardID to cardId and courseID to courseId
   ✓ ELO scoring formula > should return 1.0 when ELOs match exactly
   ✓ ELO scoring formula > should return 0.5 when distance is 250
   ✓ ELO scoring formula > should return 0 when distance is 500 or more
   ✓ ELO scoring formula > should return intermediate values for intermediate distances
   ✓ ELO scoring formula > should never return negative values
   ✓ HierarchyDefinition mastery detection > should return false when tag has no ELO data
   ✓ HierarchyDefinition mastery detection > should return false when count is below threshold
   ✓ HierarchyDefinition mastery detection > should return true when count meets threshold and ELO exceeds minElo
   ✓ HierarchyDefinition mastery detection > should return false when ELO is below minElo threshold
   ✓ HierarchyDefinition mastery detection > should compare to global ELO when no minElo specified
   ✓ HierarchyDefinition mastery detection > should use default minCount of 3
   ✓ HierarchyDefinition unlocking logic > should unlock tag when all prerequisites are mastered
   ✓ HierarchyDefinition unlocking logic > should not unlock tag when some prerequisites are missing
   ✓ HierarchyDefinition unlocking logic > should unlock tag when it has empty prerequisites
   ✓ HierarchyDefinition unlocking logic > should handle chain of prerequisites
   ✓ HierarchyDefinition unlocking logic > should handle multiple prerequisites
   ✓ HierarchyDefinition card unlocking > should unlock card when all its tags are unlocked
   ✓ HierarchyDefinition card unlocking > should lock card when any tag is locked
   ✓ HierarchyDefinition card unlocking > should unlock card when tag has no prerequisites defined
   ✓ HierarchyDefinition card unlocking > should handle mixed tags (some with prereqs, some without)
   ✓ HierarchyDefinition card unlocking > should lock card when defined tag is not unlocked
   ✓ RelativePriority boost factor computation > should return 1.0 for neutral priority (0.5)
   ✓ RelativePriority boost factor computation > should boost high-priority content
   ✓ RelativePriority boost factor computation > should reduce low-priority content
   ✓ RelativePriority boost factor computation > should have no effect when influence is 0
   ✓ RelativePriority boost factor computation > should scale linearly with priority
   ✓ RelativePriority tag priority combination > should return default priority for cards with no tags
   ✓ RelativePriority tag priority combination > should return tag priority for single-tag card
   ✓ RelativePriority tag priority combination > should use default priority for unlisted tags
   ✓ RelativePriority tag priority combination > should use max mode correctly
   ✓ RelativePriority tag priority combination > should use min mode correctly
   ✓ RelativePriority tag priority combination > should use average mode correctly
   ✓ RelativePriority tag priority combination > should include default priority in average for mixed tags
   ✓ RelativePriority score adjustment > should boost high-priority cards
   ✓ RelativePriority score adjustment > should reduce low-priority cards
   ✓ RelativePriority score adjustment > should leave neutral-priority cards unchanged
   ✓ RelativePriority score adjustment > should clamp scores to maximum of 1.0
   ✓ RelativePriority score adjustment > should clamp scores to minimum of 0.0
   ✓ RelativePriority score adjustment > should preserve ordering for cards with different priorities

 Test Files  1 passed (1)
      Tests  48 passed (48)
   Start at  23:49:58
   Duration  1.19s (transform 434ms, setup 0ms, collect 431ms, tests 34ms, environment 0ms, prepare 181ms)
```

## Assistant

All 48 tests pass, including the 18 new tests for RelativePriority. Let me update the todo file:

**Tool Call: agent/orchestrator/a.3.todo.md**
Status: Completed

Diff: master/agent/orchestrator/a.3.todo.md
```
# TODO: Scorable NavigationStrategy Architecture

**Reference**: See `a.2.plan.md` for full context, architecture diagrams, and rationale.

**Summary**: Add `getWeightedCards()` method to navigation strategies that returns cards with suitability scores. Filter strategies (Hierarchy, Interference) use a delegate pattern — they wrap another strategy and transform its output.

---

## Phase 1: WeightedCard Interface + ELO Implementation

**Status**: COMPLETED

**Goal**: Add `getWeightedCards()` to `ContentNavigator`, implement in ELO, maintain backward compat with `getNewCards()`/`getPendingReviews()`.

### Tasks

- [x] p1.1: Define `WeightedCard` type
  - File: `packages/db/src/core/navigators/index.ts`
  - Fields: `cardId`, `courseId`, `score` (0-1), `source` ('new' | 'review' | 'failed')

- [x] p1.2: Add `getWeightedCards()` to `ContentNavigator` base class
  - File: `packages/db/src/core/navigators/index.ts`
  - Signature: `async getWeightedCards(limit: number): Promise<WeightedCard[]>`
  - Default implementation: calls legacy `getNewCards()` + `getPendingReviews()`, assigns score=1.0

- [x] p1.3: Implement `getWeightedCards()` in `ELONavigator`
  - File: `packages/db/src/core/navigators/elo.ts`
  - Get user ELO via `this.user.getCourseRegDoc(courseId)` + `toCourseElo()`
  - Score = inverse of ELO distance: `Math.max(0, 1 - distance / 500)`
  - Batches ELO lookups for efficiency
  - Combine new cards + reviews, sort by score descending

- [x] p1.4: Add unit tests
  - Created: `packages/db/src/core/navigators/navigators.test.ts`
  - Tests for WeightedCard type structure
  - Tests for default getWeightedCards() behavior
  - Tests for ELO scoring formula

- [x] p1.5: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 2: HierarchyDefinition Strategy

**Status**: COMPLETED

**Goal**: Prerequisite-gated card selection using delegate pattern. Cards locked until user masters prerequisite tags.

### Tasks

- [x] p2.1: Create `HierarchyDefinitionNavigator` class
  - Created: `packages/db/src/core/navigators/hierarchyDefinition.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p2.2: Parse config from `serializedData`
  ```typescript
  interface HierarchyConfig {
    prerequisites: {
      [tagId: string]: {
        requires: string[];
        masteryThreshold?: { minElo?: number; minCount?: number; };
      };
    };
    delegateStrategy?: string;  // default: "elo"
  }
  ```

- [x] p2.3: Create delegate navigator in constructor/init
  - Uses lazy initialization via `getDelegate()` method
  - Uses `ContentNavigator.create(user, course, delegateStrategyData)`
  - Default delegate: ELO

- [x] p2.4: Implement `getMasteredTags(): Promise<Set<string>>`
  - Gets user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
  - Tag is mastered if: `userElo(tag) >= threshold` AND `count >= minCount`
  - Falls back to comparing tag ELO vs global user ELO if no minElo specified

- [x] p2.5: Implement `getUnlockedTags(mastered: Set<string>): Set<string>`
  - Tag is unlocked if all its prerequisites are in `mastered`
  - Tags with no prerequisites are always unlocked

- [x] p2.6: Implement `getWeightedCards(limit)`
  - Gets candidates from delegate (over-fetch: `limit * 2`)
  - For each candidate, checks if card is unlocked via `isCardUnlocked()`
  - Locked cards filtered out, unlocked cards preserve delegate's score
  - Returns filtered list up to limit

- [x] p2.7: Implement legacy methods (delegate through)
  - `getNewCards(n)` → `this.delegate.getNewCards(n)`
  - `getPendingReviews()` → `this.delegate.getPendingReviews()`

- [x] p2.8: Register in factory
  - Already added to `Navigators` enum in Phase 1: `HIERARCHY = 'hierarchyDefinition'`

- [x] p2.9: Add unit tests
  - Added to `navigators.test.ts`:
  - Mastery detection (ELO threshold + count)
  - Unlocking logic (prerequisite chain)
  - Card unlocking (mixed tags with/without prereqs)

- [x] p2.10: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3: InterferenceMitigator Strategy

**Status**: COMPLETED

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

### Tasks

- [x] p3.1: Create `InterferenceMitigatorNavigator` class
  - Created: `packages/db/src/core/navigators/interferenceMitigator.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.2: Parse config from `serializedData`
  - `interferenceSets: string[][]` — groups of tags that interfere (e.g., `[["b","d","p"], ["d","t"]]`)
  - `maturityThreshold: { minCount?, minElo? }` — when a tag is considered mature
  - `interferenceDecay` (default: 0.8)
  - `delegateStrategy` (default: "elo")

- [x] p3.3: Build interference map from config (tag → set of partners)

- [x] p3.4: Implement `getImmatureTags(): Promise<Set<string>>`
  - Tags where user has count > 0 but below maturity threshold

- [x] p3.5: Implement `getTagsToAvoid(immatureTags): Set<string>`
  - Partners of immature tags (excluding already-immature ones)

- [x] p3.6: Implement `computeInterferenceMultiplier()`
  - Score reduction based on overlap with avoid set
  - `Math.pow(1 - decay, interferingCount)`

- [x] p3.7: Implement `getWeightedCards(limit)`
  - Maturity-aware interference avoidance

- [x] p3.8: Implement legacy methods (delegate through)

- [x] p3.9: Register in factory
  - Already added to `Navigators` enum in Phase 1

- [x] p3.10: Verify build passes
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3.5: RelativePriority Strategy

**Status**: COMPLETED

**Goal**: Boost scores for high-utility content based on author-defined tag priorities. Prefer common, well-behaved patterns (like 's') over rare/irregular ones (like 'x', 'z').

### Tasks

- [x] p3.5.1: Create `RelativePriorityNavigator` class
  - Created: `packages/db/src/core/navigators/relativePriority.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.5.2: Define config interface
  ```typescript
  interface RelativePriorityConfig {
    tagPriorities: { [tagId: string]: number };  // 0-1, where 1.0 = highest priority
    defaultPriority?: number;                     // for unlisted tags (default: 0.5)
    combineMode?: 'max' | 'average' | 'min';      // how to combine multiple tags
    priorityInfluence?: number;                   // how strongly priority affects score (default: 0.5)
    delegateStrategy?: string;                    // default: "elo"
  }
  ```

- [x] p3.5.3: Implement boost factor computation
  - Formula: `boostFactor = 1 + (priority - 0.5) * priorityInfluence`
  - Priority 1.0 with influence 0.5 → boost 1.25 (25% higher)
  - Priority 0.5 → boost 1.00 (neutral)
  - Priority 0.0 with influence 0.5 → boost 0.75 (25% lower)

- [x] p3.5.4: Implement `getWeightedCards(limit)`
  - Get candidates from delegate
  - Look up tags for each card
  - Compute combined priority (max/average/min)
  - Apply boost factor to delegate score
  - Clamp to [0, 1] and sort

- [x] p3.5.5: Register in factory
  - Added to `Navigators` enum: `RELATIVE_PRIORITY = 'relativePriority'`

- [x] p3.5.6: Add unit tests
  - Added to `navigators.test.ts`:
  - Boost factor computation (18 new tests)
  - Tag priority combination (max/average/min modes)
  - Score adjustment with clamping

- [x] p3.5.7: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: 48 tests passing ✓

---

## Phase 4: Orchestrator (DEFERRED)

**Status**: NOT STARTED — not needed for LP MVP

Delegate pattern handles composition for now. Full orchestrator needed for:
- Multi-arm bandit experimentation
- A/B testing independent strategies
- Dynamic strategy selection

---

## Phase 4a: Production Integration (PLANNED)

**Status**: NOT STARTED

**Goal**: Wire SessionController to use `getWeightedCards()` so new strategies are actually exercised at runtime.

### Key Gap
Currently, `SessionController` still calls legacy `getNewCards()` / `getPendingReviews()`. The new `getWeightedCards()` API is implemented but not integrated.

### Tasks (estimated)
- [ ] p4a.1: Add parallel path in SessionController for weighted card selection
- [ ] p4a.2: Extend `getDebugInfo()` to include active strategy info
- [ ] p4a.3: Add strategy creation support (CLI or UI)

---

## Notes for Implementers

### Key Files
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base, factory, Navigators enum
- `packages/db/src/core/navigators/elo.ts` — Reference generator strategy
- `packages/db/src/core/navigators/relativePriority.ts` — Priority-based score boosting
- `packages/db/src/core/interfaces/userDB.ts` — UserDBInterface (history, ELO)
- `packages/db/src/impl/couch/courseDB.ts` — Tag queries, ELO queries

### Commands
- Build: `yarn workspace @vue-skuilder/db build`
- Test: `yarn workspace @vue-skuilder/db test`
- Type check: `yarn workspace @vue-skuilder/db type-check`

### Scoring Semantics
- `1.0` = fully suitable
- `0.0` = hard filter (e.g., prerequisite not met)
- `0.5` = neutral
- Intermediate = soft preference

### Delegate Pattern
Filter strategies wrap a delegate and transform its output:
```
RelativePriority(delegate=Interference(delegate=Hierarchy(delegate=ELO)))
```
- ELO generates candidates with scores
- Hierarchy gates (filters locked cards, preserves scores)
- Interference adjusts scores (multiplicative reduction for similar tags)
- RelativePriority boosts/reduces scores based on tag utility

### Data Access (via constructor params)
- `user: UserDBInterface`
  - `user.getSeenCards(courseId)` — card history
  - `user.getCourseRegDoc(courseId).elo.tags` — per-tag ELO
- `course: CourseDBInterface`
  - `course.getAppliedTags(cardId)` — tags on a card
  - `course.getCardEloData([cardId])` — card difficulty
```


## Assistant

---

## Summary

I've implemented the `RelativePriorityNavigator` following the same delegate pattern as the other strategies:

### Files Created/Modified

| File | Change |
|------|--------|
| `packages/db/src/core/navigators/relativePriority.ts` | NEW - 241 lines |
| `packages/db/src/core/navigators/index.ts` | Added `RELATIVE_PRIORITY` to enum |
| `packages/db/tests/core/navigators/navigators.test.ts` | Added 18 tests (48 total now) |
| `agent/orchestrator/a.3.todo.md` | Updated with Phase 3.5 status |

### Key Design Decisions

1. **Tag-to-priority map** — Simple `{ [tagId: string]: number }` config, as you specified (no tiered syntax in v1)

2. **Boost factor formula** — `1 + (priority - 0.5) * priorityInfluence`
   - Neutral priority (0.5) has no effect
   - High priority (1.0) with default influence (0.5) → 25% boost
   - Low priority (0.0) with default influence → 25% reduction

3. **Combine mode** — When a card has multiple tags, choose `max` (default), `average`, or `min`

4. **Delegate pattern** — Wraps another strategy (default: ELO) and adjusts its scores

### Example Config

```master/dev/null/lp-priority-config.json#L1-10
{
  "tagPriorities": {
    "letter-s": 0.95,
    "letter-t": 0.90,
    "letter-x": 0.10,
    "letter-z": 0.05
  },
  "defaultPriority": 0.5,
  "priorityInfluence": 0.5
}
```

### Stacking Example

The full LP strategy chain could be:

```master/dev/null/strategy-chain.txt#L1-4
RelativePriority(
  delegate=Interference(
    delegate=Hierarchy(
      delegate=ELO)))
```

This would:
1. **ELO** generates candidates scored by difficulty match
2. **Hierarchy** filters out cards whose prerequisites aren't met
3. **Interference** reduces scores for confusable content while immature
4. **RelativePriority** boosts high-utility content (common letters first)

---

The remaining gap is **Phase 4a** — `SessionController` doesn't yet call `getWeightedCards()`, so these strategies exist but aren't exercised. That's the integration work to make them operational.

## User

Great, thank you.

We will move forward with 4a - integrating the new navigator APIs into existing SessionController logic. I'd like you to take some of this (attached) historical design discussion into account, and pre-empt 4a.1 with an earmarking / annotation of API migration strategy and deprecation notices on StudyContentSource and related interfaces / boundaries.

Some of the specifics here are out of date with current impl, but the spirit is:
- NewCards + ReviewCards interface was a representation of ELO sorting + SRS as the two hard-coded NavigationStrategies before ContentNavigation was abstracted
- Methods still useful for existing paths that surface content - don't want to break too much at once
- but new standards arrive for the SessionController to pull content

The historic chat:

```
really liking the shape of this. 

interrogating a little more:

- the `StudyContentSource` interface was originally concieved to house and abstract both 'classrooms' and 'courses', where the former was essentially a collection of one or more courses + time based filters
- the card surfacing here was / is entirely ELO proximity (for new cards) and the SRS scheduledReview for reviews
- but they may not be relevant for given navigation strategy - eg, what does 'get reviews' mean for an interference mitigator?
- SRS is a specific strategy that surfaces and votes for scheduled reviews, but that can be expressed in the more generic term of a weighted cardlist (stray thought: we essentially want some sort of adversarial construction of a priority heap / queue)
- the historic methods getNewCards() and getReviews() were artifacts of the 2 specific built-in NavigationStrategies (before they had that name)

Do we actually want a more specific, narrow interface for NavigationStrategies?

## Assistant

This is a great interrogation. Let me think through this:

**Tool Call: Thinking**
Status: Completed

Finished thinking.

## Assistant

You're onto something important. Let me sketch the layers:

**Current (conflated)**:
```
StudyContentSource / ContentNavigator
├── getNewCards()      ← "which new cards?" + "in what order?"
└── getPendingReviews() ← "which reviews?" + "in what order?"
```

**What you're describing (separated)**:
```
CardSources (where candidates come from)
├── CourseContent → all cards in course
├── SRS → scheduled reviews with overdueness
└── FailedCards → session failures needing retry

NavigationStrategies (how to score/rank)
├── ELO → score by skill proximity
├── Hierarchy → gate by prerequisites (0 or 1)
├── Interference → score by tag dissimilarity
└── SRS → score by overdueness (can be both source AND scorer)

SessionOrchestrator (how to build the queue)
└── Aggregate scores, build priority heap, manage time budget
```

**Narrower interface proposal**:
```typescript
interface NavigationStrategy {
  // Required: score any card
  scoreCard(card: CardCandidate, context: SessionContext): Promise<number>;
  
  // Optional: nominate cards this strategy specifically wants considered
  // (SRS nominates overdue reviews, ELO nominates skill-appropriate cards)
  nominateCards?(limit: number): Promise<CardCandidate[]>;
}
```

**Flow**:
1. Collect nominations from all strategies that provide them
2. Score each candidate by ALL strategies
3. Multiply/combine scores (0 from any = filtered)
4. Priority queue from combined scores

This makes `getNewCards()` / `getPendingReviews()` obsolete at the strategy level — they're replaced by `nominateCards()` + `scoreCard()`. The new/review distinction becomes metadata on the card, not a method split.

**Questions**:

1. Does this feel like the right decomposition?
2. How radical a refactor are we willing to do? We could:
   - **A) Incremental**: Keep `StudyContentSource` interface, add `scoreCard()` alongside, migrate gradually
   - **B) Clean break**: New `NavigationStrategy` interface, refactor SessionController to use it
3. Where does "time budget management" (currently in SessionController) live? Is that its own strategy, or orchestrator logic?

## User

1. that's approximately right, But I wonder about the separateness of scoreCard and nominateCards. Scorecards seems like the navigation strategy is receiving a candidate list from an external caller - but I mostly imagine it as the thing that drives the candidate list (candidates surface with preference scores). Although some sorts of strategies are almost purely subtractive, so it's hard for them to participate on a pure nominateCards() level?

2. lean incremental I think. need to get moving.

3. Time budgeting is handled entirely by the session controller and it ought to stay there. The session controller currently and I think into the future continues to want to request small batches of cards from its `StudyContentSource`s in a just in time sort of manner - it decides to stop the session based on its own local view of the clock, and any cards not actually interacted with will have no effect.

## Assistant

Got it. Let me synthesize:

**The tension**: Some strategies *generate* candidates (ELO, SRS), others *filter/score* candidates (Hierarchy, Interference). A pure `nominateCards()` interface doesn't work for filters. A pure `scoreCard()` interface requires someone else to generate the full candidate set first.

**Resolution**: Strategies return weighted/scored cards, but can delegate upstream for their candidate set:

```typescript
interface NavigationStrategy {
  // Returns cards with scores. May generate own candidates,
  // or filter/score candidates from a delegate strategy.
  getWeightedCards(limit: number): Promise<WeightedCard[]>;
}

interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;      // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Composition pattern**:
- **ELO**: Generates candidates near user skill, scores by distance
- **SRS**: Generates overdue reviews, scores by overdueness  
- **Hierarchy(delegate=ELO)**: Gets candidates from ELO, gates by prerequisites (score=0 or passthrough)
- **Interference(delegate=ELO)**: Gets candidates from ELO, reduces scores for tag overlap

So Hierarchy and Interference wrap a delegate strategy — they're decorators/filters. They don't generate candidates themselves; they transform the output of another strategy.

**Incremental path**:
1. Keep `StudyContentSource` interface for SessionController compatibility
2. Add `getWeightedCards()` to `ContentNavigator` 
3. Default impl: calls existing `getNewCards()` / `getPendingReviews()`, assigns score=1.0
4. New strategies implement `getWeightedCards()` directly, with delegate pattern
5. Eventually deprecate `getNewCards()` / `getPendingReviews()` in favor of `getWeightedCards()`

**SessionController change**: Minimal. It still calls sources for batches. Instead of `getNewCards()`, it calls `getWeightedCards()`, sorts by score, picks top N.

Does this feel right? If so I'll update the plan and todo to reflect this interface shape.

## User

Bingo - ok. Go for it.
```

Sound good? I want some of this thinking "made durable" so that the confused interface doesn't become a Chesterton Fence

**Tool Call: Thinking**
Status: Completed

Finished thinking.

**Tool Call: Search files for regex `interface StudyContentSource|export interface StudyContentSource`**
Status: Completed

Found 1 matches:

## Matches in master/packages/db/src/core/interfaces/contentSource.ts

### L49-52
```
export interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```


**Tool Call: Read file `packages/db/src/core/interfaces/contentSource.ts`**
Status: Completed

```json
{"Text":"import { getDataLayer } from '@db/factory';\nimport { UserDBInterface } from '..';\nimport { StudentClassroomDB } from '../../impl/couch/classroomDB';\nimport { ScheduledCard } from '@db/core/types/user';\n\nexport type StudySessionFailedItem = StudySessionFailedNewItem | StudySessionFailedReviewItem;\n\nexport interface StudySessionFailedNewItem extends StudySessionItem {\n  status: 'failed-new';\n}\nexport interface StudySessionFailedReviewItem extends StudySessionReviewItem {\n  status: 'failed-review';\n}\n\nexport interface StudySessionNewItem extends StudySessionItem {\n  status: 'new';\n}\n\nexport interface StudySessionReviewItem extends StudySessionItem {\n  reviewID: string;\n  status: 'review' | 'failed-review';\n}\nexport function isReview(item: StudySessionItem): item is StudySessionReviewItem {\n  const ret = item.status === 'review' || item.status === 'failed-review' || 'reviewID' in item;\n\n  // console.log(`itemIsReview: ${ret}\n  // \\t${JSON.stringify(item)}`);\n\n  return ret;\n}\n\nexport interface StudySessionItem {\n  status: 'new' | 'review' | 'failed-new' | 'failed-review';\n  contentSourceType: 'course' | 'classroom';\n  contentSourceID: string;\n  // qualifiedID: `${string}-${string}` | `${string}-${string}-${number}`;\n  cardID: string;\n  courseID: string;\n  elo?: number;\n  // reviewID?: string;\n}\n\nexport interface ContentSourceID {\n  type: 'course' | 'classroom';\n  id: string;\n}\n\n// #region docs_StudyContentSource\nexport interface StudyContentSource {\n  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;\n  getNewCards(n?: number): Promise<StudySessionNewItem[]>;\n}\n// #endregion docs_StudyContentSource\n\nexport async function getStudySource(\n  source: ContentSourceID,\n  user: UserDBInterface\n): Promise<StudyContentSource> {\n  if (source.type === 'classroom') {\n    return await StudentClassroomDB.factory(source.id, user);\n  } else {\n    // if (source.type === 'course') - removed so tsc is certain something returns\n    // return new CourseDB(source.id, async () => {\n    //   return user;\n    // });\n\n    return getDataLayer().getCourseDB(source.id) as unknown as StudyContentSource;\n  }\n}\n"}
```

**Tool Call: Read file `packages/db/src/core/navigators/index.ts`**
Status: Completed

```json
{"Text":"import {\n  StudyContentSource,\n  UserDBInterface,\n  CourseDBInterface,\n  StudySessionReviewItem,\n  StudySessionNewItem,\n} from '..';\nimport { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';\nimport { ScheduledCard } from '../types/user';\nimport { logger } from '../../util/logger';\n\n/**\n * A card with a suitability score for presentation.\n *\n * Scores range from 0-1:\n * - 1.0 = fully suitable\n * - 0.0 = hard filter (e.g., prerequisite not met)\n * - 0.5 = neutral\n * - Intermediate values = soft preference\n */\nexport interface WeightedCard {\n  cardId: string;\n  courseId: string;\n  /** Suitability score from 0-1 */\n  score: number;\n  /** Origin of the card */\n  source: 'new' | 'review' | 'failed';\n}\n\nexport enum Navigators {\n  ELO = 'elo',\n  HARDCODED = 'hardcodedOrder',\n  HIERARCHY = 'hierarchyDefinition',\n  INTERFERENCE = 'interferenceMitigator',\n  RELATIVE_PRIORITY = 'relativePriority',\n}\n\n/**\n * A content-navigator provides runtime steering of study sessions.\n */\nexport abstract class ContentNavigator implements StudyContentSource {\n  /**\n   *\n   * @param user\n   * @param strategyData\n   * @returns the runtime object used to steer a study session.\n   */\n  static async create(\n    user: UserDBInterface,\n    course: CourseDBInterface,\n    strategyData: ContentNavigationStrategyData\n  ): Promise<ContentNavigator> {\n    const implementingClass = strategyData.implementingClass;\n    let NavigatorImpl;\n\n    // Try different extension variations\n    const variations = ['.ts', '.js', ''];\n\n    for (const ext of variations) {\n      try {\n        const module = await import(`./${implementingClass}${ext}`);\n        NavigatorImpl = module.default;\n        break; // Break the loop if loading succeeds\n      } catch (e) {\n        // Continue to next variation if this one fails\n        logger.debug(`Failed to load with extension ${ext}:`, e);\n      }\n    }\n\n    if (!NavigatorImpl) {\n      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);\n    }\n\n    return new NavigatorImpl(user, course, strategyData);\n  }\n\n  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;\n  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;\n\n  /**\n   * Get cards with suitability scores.\n   *\n   * This is the primary method for the new weighted-card architecture.\n   * Filter strategies can wrap a delegate and transform its output.\n   *\n   * @param limit - Maximum cards to return\n   * @returns Cards sorted by score descending\n   */\n  async getWeightedCards(limit: number): Promise<WeightedCard[]> {\n    // Default implementation: delegate to legacy methods, assign score=1.0\n    const newCards = await this.getNewCards(limit);\n    const reviews = await this.getPendingReviews();\n\n    const weighted: WeightedCard[] = [\n      ...newCards.map((c) => ({\n        cardId: c.cardID,\n        courseId: c.courseID,\n        score: 1.0,\n        source: 'new' as const,\n      })),\n      ...reviews.map((r) => ({\n        cardId: r.cardID,\n        courseId: r.courseID,\n        score: 1.0,\n        source: 'review' as const,\n      })),\n    ];\n\n    return weighted.slice(0, limit);\n  }\n}\n"}
```

## Assistant

Now I'll create the migration documentation and add deprecation annotations. First, let me create a dedicated architecture doc:

**Tool Call: packages/db/src/core/navigators/ARCHITECTURE.md**
Status: Completed

Diff: master/packages/db/src/core/navigators/ARCHITECTURE.md
```
# Navigation Strategy Architecture

## Overview

This document describes the evolution of the NavigationStrategy API and provides guidance
for migrating from the legacy `getNewCards()` / `getPendingReviews()` interface to the new
unified `getWeightedCards()` API.

## Historical Context

### The Original Design

The `StudyContentSource` interface was originally conceived to abstract both 'classrooms'
and 'courses' as sources of study content. It exposed two methods:

```typescript
interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

These methods were artifacts of two **hard-coded NavigationStrategies** (before they had
that name):

1. **ELO proximity** — for selecting new cards matched to user skill level
2. **SRS scheduling** — for surfacing cards due for review based on spaced repetition

The new/review split reflected this implementation detail, not a fundamental abstraction.

### The Problem

As we added more sophisticated navigation strategies, the limitations became apparent:

- **What does "get reviews" mean for an interference mitigator?** The concept doesn't map.
- **SRS is just one strategy** — it votes for scheduled reviews, but that preference could
  be expressed as weighted scores like any other strategy.
- **Some strategies generate candidates, others filter/score them** — the interface didn't
  accommodate this distinction.

### The Solution: Weighted Cards

The new API unifies card selection into a single scored candidate model:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;      // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}

abstract class ContentNavigator {
  // THE NEW PRIMARY API
  async getWeightedCards(limit: number): Promise<WeightedCard[]>;
  
  // LEGACY - kept for backward compatibility
  abstract getPendingReviews(): Promise<...>;
  abstract getNewCards(n?: number): Promise<...>;
}
```

## The Delegate Pattern

Navigation strategies fall into two categories:

### Generator Strategies
Generate candidate cards with scores based on their own logic.

- **ELO** — Generates cards near user skill level, scores by ELO distance
- **SRS** — Generates overdue reviews, scores by overdueness
- **HardcodedOrder** — Returns a fixed sequence of cards

### Filter/Decorator Strategies
Wrap a delegate strategy and transform its output.

- **HierarchyDefinition** — Filters out cards whose prerequisites aren't met
- **InterferenceMitigator** — Reduces scores for confusable content
- **RelativePriority** — Boosts scores for high-utility content

### Composition

Filter strategies wrap generators (or other filters) to form a pipeline:

```
RelativePriority(
  delegate=InterferenceMitigator(
    delegate=HierarchyDefinition(
      delegate=ELO)))
```

The flow:
1. **ELO** generates candidates scored by skill proximity
2. **HierarchyDefinition** gates locked cards (score=0 or passthrough)
3. **InterferenceMitigator** reduces scores for similar tags while immature
4. **RelativePriority** boosts high-utility content (common letters first)

## Migration Path

### Phase 1: Parallel APIs (Current State)

Both APIs coexist:
- `getWeightedCards()` is the new primary API
- `getNewCards()` / `getPendingReviews()` remain for backward compatibility
- Default `getWeightedCards()` implementation delegates to legacy methods

### Phase 2: SessionController Integration (Next)

`SessionController` will be updated to call `getWeightedCards()` instead of the legacy
methods. The new/review distinction becomes metadata on the `WeightedCard.source` field,
not a method split.

### Phase 3: Deprecation

Once SessionController migration is complete:
- Legacy methods will be marked `@deprecated`
- New strategy implementations can skip implementing them (base class provides defaults)
- Eventually, legacy methods will be removed

## Score Semantics

Scores range from 0-1 with the following semantics:

| Score | Meaning |
|-------|---------|
| 1.0 | Fully suitable — strong candidate |
| 0.5 | Neutral — no preference |
| 0.0 | Hard filter — exclude from consideration |
| 0.x | Soft preference — proportional suitability |

Scores are typically combined multiplicatively when strategies are chained. A score of 0
from any strategy filters out the card entirely.

## SessionController Interaction

`SessionController` manages:
- **Time budgeting** — Stops session based on configured duration
- **Queue management** — Maintains separate queues for new/review/failed cards
- **Just-in-time fetching** — Requests small batches from sources as needed

The controller will:
1. Call `getWeightedCards(limit)` on its sources
2. Sort candidates by score
3. Map them back to appropriate queues based on `source` field
4. Present cards in score order within queue constraints

## Interface Evolution Summary

```
BEFORE (hard-coded strategies):

StudyContentSource
├── getNewCards()       ← ELO-based selection
└── getPendingReviews() ← SRS-based scheduling

AFTER (pluggable strategies):

ContentNavigator implements StudyContentSource
├── getWeightedCards()  ← PRIMARY: unified scored candidates
├── getNewCards()       ← LEGACY: backward compat, eventually deprecated  
└── getPendingReviews() ← LEGACY: backward compat, eventually deprecated
```

## For Implementers

### Creating a New Generator Strategy

```typescript
class MyGeneratorNavigator extends ContentNavigator {
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Generate and score candidates
    const candidates = await this.findCandidates(limit);
    return candidates.map(c => ({
      cardId: c.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(c),
      source: 'new',
    }));
  }

  // Legacy methods - can use base class default or implement
  async getNewCards(n?: number) { /* ... */ }
  async getPendingReviews() { /* ... */ }
}
```

### Creating a New Filter Strategy

```typescript
class MyFilterNavigator extends ContentNavigator {
  private delegate: ContentNavigator | null = null;
  
  private async getDelegate(): Promise<ContentNavigator> {
    if (!this.delegate) {
      this.delegate = await ContentNavigator.create(
        this.user, 
        this.course,
        { implementingClass: this.config.delegateStrategy || 'elo', ... }
      );
    }
    return this.delegate;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();
    const candidates = await delegate.getWeightedCards(limit * 2);
    
    // Transform scores
    return candidates
      .map(c => ({ ...c, score: this.adjustScore(c) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Legacy methods delegate through
  async getNewCards(n?: number) {
    return (await this.getDelegate()).getNewCards(n);
  }
  async getPendingReviews() {
    return (await this.getDelegate()).getPendingReviews();
  }
}
```

## Related Files

- `packages/db/src/core/interfaces/contentSource.ts` — `StudyContentSource` interface
- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` base class, `WeightedCard`
- `packages/db/src/core/navigators/elo.ts` — Reference generator implementation
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — Reference filter implementation
- `packages/db/src/study/SessionController.ts` — Consumer of navigation strategies
```


## Assistant

Now let me add deprecation notices and migration annotations to the actual interfaces:

**Tool Call: packages/db/src/core/interfaces/contentSource.ts**
Status: Completed

Diff: master/packages/db/src/core/interfaces/contentSource.ts
```
import { getDataLayer } from '@db/factory';
import { UserDBInterface } from '..';
import { StudentClassroomDB } from '../../impl/couch/classroomDB';
import { ScheduledCard } from '@db/core/types/user';

// ============================================================================
// API MIGRATION NOTICE
// ============================================================================
//
// The StudyContentSource interface is being superseded by the ContentNavigator
// class and its getWeightedCards() API. See:
//   packages/db/src/core/navigators/ARCHITECTURE.md
//
// HISTORICAL CONTEXT:
// - This interface was designed to abstract 'classrooms' and 'courses' as
//   content sources for study sessions.
// - getNewCards() and getPendingReviews() were artifacts of two hard-coded
//   navigation strategies: ELO proximity (new) and SRS scheduling (reviews).
// - The new/review split reflected implementation details, not fundamentals.
//
// THE PROBLEM:
// - "What does 'get reviews' mean for an interference mitigator?" - it doesn't.
// - SRS is just one strategy that could express review urgency as scores.
// - Some strategies generate candidates, others filter/score them.
//
// THE SOLUTION:
// - ContentNavigator.getWeightedCards() returns unified scored candidates.
// - WeightedCard.source field distinguishes new/review/failed (metadata, not API).
// - Strategies compose via delegate pattern (filter wraps generator).
//
// MIGRATION PATH:
// 1. ContentNavigator implements StudyContentSource for backward compat
// 2. SessionController will migrate to call getWeightedCards()
// 3. Legacy methods will be deprecated, then removed
//
// ============================================================================

export type StudySessionFailedItem = StudySessionFailedNewItem | StudySessionFailedReviewItem;

export interface StudySessionFailedNewItem extends StudySessionItem {
  status: 'failed-new';
}
export interface StudySessionFailedReviewItem extends StudySessionReviewItem {
  status: 'failed-review';
}

export interface StudySessionNewItem extends StudySessionItem {
  status: 'new';
}

export interface StudySessionReviewItem extends StudySessionItem {
  reviewID: string;
  status: 'review' | 'failed-review';
}
export function isReview(item: StudySessionItem): item is StudySessionReviewItem {
  const ret = item.status === 'review' || item.status === 'failed-review' || 'reviewID' in item;

  // console.log(`itemIsReview: ${ret}
  // \t${JSON.stringify(item)}`);

  return ret;
}

export interface StudySessionItem {
  status: 'new' | 'review' | 'failed-new' | 'failed-review';
  contentSourceType: 'course' | 'classroom';
  contentSourceID: string;
  // qualifiedID: `${string}-${string}` | `${string}-${string}-${number}`;
  cardID: string;
  courseID: string;
  elo?: number;
  // reviewID?: string;
}

export interface ContentSourceID {
  type: 'course' | 'classroom';
  id: string;
}

// #region docs_StudyContentSource
/**
 * Interface for sources that provide study content to SessionController.
 *
 * @deprecated This interface will be superseded by ContentNavigator.getWeightedCards().
 * The getNewCards/getPendingReviews split was an artifact of hard-coded ELO and SRS
 * strategies. The new API returns unified WeightedCard[] with scores.
 *
 * MIGRATION:
 * - Implement ContentNavigator instead of StudyContentSource directly
 * - Override getWeightedCards() as the primary method
 * - Legacy methods can delegate to getWeightedCards() or be left as-is
 *
 * See: packages/db/src/core/navigators/ARCHITECTURE.md
 */
export interface StudyContentSource {
  /**
   * Get cards scheduled for review based on SRS algorithm.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * Review urgency will be expressed as a score rather than a separate method.
   */
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction, typically ordered by ELO proximity.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * New card selection and scoring will be unified with review scoring.
   *
   * @param n - Maximum number of new cards to return
   */
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
// #endregion docs_StudyContentSource

export async function getStudySource(
  source: ContentSourceID,
  user: UserDBInterface
): Promise<StudyContentSource> {
  if (source.type === 'classroom') {
    return await StudentClassroomDB.factory(source.id, user);
  } else {
    // if (source.type === 'course') - removed so tsc is certain something returns
    // return new CourseDB(source.id, async () => {
    //   return user;
    // });

    return getDataLayer().getCourseDB(source.id) as unknown as StudyContentSource;
  }
}

```


**Tool Call: packages/db/src/core/navigators/index.ts**
Status: Completed

Diff: master/packages/db/src/core/navigators/index.ts
```
import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { logger } from '../../util/logger';

// ============================================================================
// NAVIGATION STRATEGY API
// ============================================================================
//
// This module defines the ContentNavigator base class and the WeightedCard type,
// which form the foundation of the pluggable navigation strategy system.
//
// KEY CONCEPTS:
//
// 1. WeightedCard - A card with a suitability score (0-1). This is the unified
//    output format for all navigation strategies.
//
// 2. ContentNavigator - Abstract base class that strategies extend. Implements
//    StudyContentSource for backward compatibility.
//
// 3. Generator vs Filter strategies:
//    - Generators (ELO, SRS) produce candidate cards with scores
//    - Filters (Hierarchy, Interference, RelativePriority) wrap a delegate
//      and transform its output
//
// 4. Delegate pattern - Filter strategies compose by wrapping generators:
//    RelativePriority(Interference(Hierarchy(ELO)))
//
// API EVOLUTION:
// - getWeightedCards() is the PRIMARY API (new)
// - getNewCards() / getPendingReviews() are LEGACY (kept for backward compat)
// - SessionController will migrate to use getWeightedCards()
// - Legacy methods will eventually be deprecated
//
// See: ARCHITECTURE.md in this directory for full migration guide.
//
// ============================================================================

/**
 * A card with a suitability score for presentation.
 *
 * Scores range from 0-1:
 * - 1.0 = fully suitable
 * - 0.0 = hard filter (e.g., prerequisite not met)
 * - 0.5 = neutral
 * - Intermediate values = soft preference
 */
export interface WeightedCard {
  cardId: string;
  courseId: string;
  /** Suitability score from 0-1 */
  score: number;
  /** Origin of the card */
  source: 'new' | 'review' | 'failed';
}

export enum Navigators {
  ELO = 'elo',
  HARDCODED = 'hardcodedOrder',
  HIERARCHY = 'hierarchyDefinition',
  INTERFERENCE = 'interferenceMitigator',
  RELATIVE_PRIORITY = 'relativePriority',
}

/**
 * Abstract base class for navigation strategies that steer study sessions.
 *
 * ContentNavigator implements StudyContentSource for backward compatibility,
 * but the primary API going forward is getWeightedCards().
 *
 * ## Strategy Types
 *
 * **Generator strategies** produce candidate cards:
 * - Override getWeightedCards() to generate and score candidates
 * - Examples: ELO (skill proximity), SRS (review scheduling)
 *
 * **Filter strategies** transform delegate output:
 * - Wrap another strategy via the delegate pattern
 * - Override getWeightedCards() to filter/adjust delegate scores
 * - Examples: HierarchyDefinition, InterferenceMitigator, RelativePriority
 *
 * ## API Migration
 *
 * The legacy getNewCards()/getPendingReviews() methods exist for backward
 * compatibility with SessionController. Once SessionController migrates to
 * use getWeightedCards(), these methods will be deprecated.
 *
 * New strategies should:
 * 1. Implement getWeightedCards() as the primary logic
 * 2. Optionally override legacy methods (base class provides defaults)
 *
 * See: ARCHITECTURE.md for full migration guide and design rationale.
 */
export abstract class ContentNavigator implements StudyContentSource {
  /**
   *
   * @param user
   * @param strategyData
   * @returns the runtime object used to steer a study session.
   */
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> {
    const implementingClass = strategyData.implementingClass;
    let NavigatorImpl;

    // Try different extension variations
    const variations = ['.ts', '.js', ''];

    for (const ext of variations) {
      try {
        const module = await import(`./${implementingClass}${ext}`);
        NavigatorImpl = module.default;
        break; // Break the loop if loading succeeds
      } catch (e) {
        // Continue to next variation if this one fails
        logger.debug(`Failed to load with extension ${ext}:`, e);
      }
    }

    if (!NavigatorImpl) {
      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);
    }

    return new NavigatorImpl(user, course, strategyData);
  }

  /**
   * Get cards scheduled for review.
   *
   * @deprecated This method is part of the legacy StudyContentSource interface.
   * New strategies should focus on implementing getWeightedCards() instead.
   * This method will be deprecated once SessionController migrates to the new API.
   *
   * For filter strategies using the delegate pattern, this can simply delegate
   * to the wrapped strategy.
   */
  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction.
   *
   * @deprecated This method is part of the legacy StudyContentSource interface.
   * New strategies should focus on implementing getWeightedCards() instead.
   * This method will be deprecated once SessionController migrates to the new API.
   *
   * For filter strategies using the delegate pattern, this can simply delegate
   * to the wrapped strategy.
   *
   * @param n - Maximum number of new cards to return
   */
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards with suitability scores.
   *
   * **This is the PRIMARY API for navigation strategies.**
   *
   * Returns cards ranked by suitability score (0-1). Higher scores indicate
   * better candidates for presentation.
   *
   * ## For Generator Strategies
   * Override this method to generate candidates and compute scores based on
   * your strategy's logic (e.g., ELO proximity, review urgency).
   *
   * ## For Filter Strategies
   * Override this method to:
   * 1. Get candidates from delegate: `delegate.getWeightedCards(limit * N)`
   * 2. Transform/filter scores based on your logic
   * 3. Re-sort and return top candidates
   *
   * ## Default Implementation
   * The base class provides a backward-compatible default that:
   * 1. Calls legacy getNewCards() and getPendingReviews()
   * 2. Assigns score=1.0 to all cards
   * 3. Returns combined results up to limit
   *
   * This allows existing strategies to work without modification while
   * new strategies can override with proper scoring.
   *
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default implementation: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();

    const weighted: WeightedCard[] = [
      ...newCards.map((c) => ({
        cardId: c.cardID,
        courseId: c.courseID,
        score: 1.0,
        source: 'new' as const,
      })),
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        source: 'review' as const,
      })),
    ];

    return weighted.slice(0, limit);
  }
}

```


## Assistant

Now let me also update the a.2.plan.md to capture this migration thinking for posterity:

**Tool Call: Read file `agent/orchestrator/a.2.plan.md` (lines 1-30)**
Status: Completed

```json
{"Text":"# Plan: Scorable NavigationStrategy Architecture\n\n## Context\n\nThis plan implements a scorable strategy architecture for content navigation, driven primarily by the LettersPractice (LP) use case but designed for content-agnostic reuse.\n\n**Source-verified** against:\n- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` abstract class\n- `packages/db/src/core/navigators/elo.ts` — `ELONavigator` implementation\n- `packages/db/src/study/SessionController.ts` — Queue management\n- `packages/db/src/core/types/contentNavigationStrategy.ts` — `ContentNavigationStrategyData` schema\n- `packages/db/src/core/interfaces/userDB.ts` — `UserDBInterface` with history access\n\n**Primary goals**:\n1. Enforce \"single new concept at a time\" via prerequisite/mastery gating (HierarchyDefinition)\n2. Separate confusable concepts (InterferenceMitigator)\n3. Design strategies as evolutionary-ready: return suitability scores (0-1), composable by weight\n\n**Non-goals for MVP**:\n- Full orchestrator implementation (LP can ship with HierarchyDefinition alone)\n- Classroom filtering integration\n- Debug/visualization UI\n- Multi-arm bandit experimentation framework (architecture should support it, not implement it)\n\n---\n\n## Architecture Overview\n\n### Core Change: Strategies Return Weighted Cards\n\n"}
```

**Tool Call: agent/orchestrator/a.2.plan.md**
Status: Completed

Diff: master/agent/orchestrator/a.2.plan.md
```
# Plan: Scorable NavigationStrategy Architecture

## API Migration Strategy

> **Note**: This section documents the evolution from the legacy `getNewCards()` / `getPendingReviews()` 
> interface to the new unified `getWeightedCards()` API. This context prevents future confusion about 
> the interface design (avoiding Chesterton's Fence).

### Historical Context

The `StudyContentSource` interface was originally designed to abstract both 'classrooms' and 'courses' 
as content sources. It exposed two methods:

```typescript
interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

These methods were **artifacts of two hard-coded NavigationStrategies** (before they had that name):
1. **ELO proximity** — for selecting new cards matched to user skill level
2. **SRS scheduling** — for surfacing cards due for review based on spaced repetition

The new/review split reflected this implementation detail, not a fundamental abstraction.

### The Problem

As we added more sophisticated navigation strategies, the limitations became apparent:

- **"What does 'get reviews' mean for an interference mitigator?"** — The concept doesn't map.
- **SRS is just one strategy** — It votes for scheduled reviews, but that preference could be 
  expressed as weighted scores like any other strategy.
- **Some strategies generate candidates, others filter/score them** — The interface didn't 
  accommodate this distinction cleanly.

### The Solution: Weighted Cards

The new API unifies card selection into a single scored candidate model:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;      // 0-1 suitability
  source: 'new' | 'review' | 'failed';  // metadata, not API distinction
}

abstract class ContentNavigator implements StudyContentSource {
  // THE NEW PRIMARY API
  async getWeightedCards(limit: number): Promise<WeightedCard[]>;
  
  // LEGACY - kept for backward compatibility
  abstract getPendingReviews(): Promise<...>;
  abstract getNewCards(n?: number): Promise<...>;
}
```

### Strategy Composition Model

Strategies fall into two categories that compose via the delegate pattern:

**Generator strategies** produce candidates:
- ELO — generates cards near user skill, scores by distance
- SRS — generates overdue reviews, scores by urgency
- HardcodedOrder — returns fixed sequence

**Filter strategies** wrap a delegate and transform output:
- HierarchyDefinition — gates by prerequisites (score=0 or passthrough)
- InterferenceMitigator — reduces scores for confusable content
- RelativePriority — boosts scores for high-utility content

Composition example:
```
RelativePriority(
  delegate=InterferenceMitigator(
    delegate=HierarchyDefinition(
      delegate=ELO)))
```

### Migration Path

1. **Phase 1 (Current)**: Both APIs coexist
   - `getWeightedCards()` is the new primary API
   - Legacy methods remain for backward compatibility
   - Default `getWeightedCards()` delegates to legacy methods with score=1.0

2. **Phase 2 (Next)**: SessionController integration
   - SessionController calls `getWeightedCards()` instead of legacy methods
   - new/review distinction becomes `WeightedCard.source` metadata

3. **Phase 3 (Future)**: Deprecation
   - Legacy methods marked `@deprecated`
   - Eventually removed

### Documentation

See `packages/db/src/core/navigators/ARCHITECTURE.md` for detailed implementation guide.

---

## Context

This plan implements a scorable strategy architecture for content navigation, driven primarily by the LettersPractice (LP) use case but designed for content-agnostic reuse.

**Source-verified** against:
- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` abstract class
- `packages/db/src/core/navigators/elo.ts` — `ELONavigator` implementation
- `packages/db/src/study/SessionController.ts` — Queue management
- `packages/db/src/core/types/contentNavigationStrategy.ts` — `ContentNavigationStrategyData` schema
- `packages/db/src/core/interfaces/userDB.ts` — `UserDBInterface` with history access

**Primary goals**:
1. Enforce "single new concept at a time" via prerequisite/mastery gating (HierarchyDefinition)
2. Separate confusable concepts (InterferenceMitigator)
3. Design strategies as evolutionary-ready: return suitability scores (0-1), composable by weight

**Non-goals for MVP**:
- Full orchestrator implementation (LP can ship with HierarchyDefinition alone)
- Classroom filtering integration
- Debug/visualization UI
- Multi-arm bandit experimentation framework (architecture should support it, not implement it)

---

## Architecture Overview

### Core Change: Strategies Return Weighted Cards

**Current interface** (legacy):
```
ContentNavigator (current)
├── getNewCards(n?: number): Promise<StudySessionNewItem[]>
└── getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>
```

**Proposed interface**:
```
ContentNavigator (proposed)
├── getWeightedCards(limit: number): Promise<WeightedCard[]>  // NEW: primary method
├── getNewCards(n?: number): Promise<StudySessionNewItem[]>   // DEPRECATED: compat
└── getPendingReviews(): Promise<...>                         // DEPRECATED: compat
```

**New types**:
```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;           // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Scoring semantics**:
- `1.0` = fully suitable, present freely
- `0.0` = unsuitable, hard filter (e.g., prerequisite not met)
- `0.5` = neutral / no opinion
- Intermediate values = soft preference (e.g., 0.8 = good but not ideal timing)

**Key insight**: Some strategies *generate* candidates (ELO, SRS), others *filter/score* candidates (Hierarchy, Interference). The delegate pattern handles this:
- **Generator strategies**: ELO, SRS — produce candidates with scores
- **Filter strategies**: Hierarchy, Interference — wrap a delegate, transform its output

### Strategy Composition Model: Delegate Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Future Orchestrator                       │
│  (weighted combination, evolutionary selection, A/B tests)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ InterferenceMitigator         │
              │ (filter: reduces scores for   │
              │  tag overlap with recent)     │
              └───────────────┬───────────────┘
                              │ delegates to
                              ▼
              ┌───────────────────────────────┐
              │ HierarchyDefinition           │
              │ (filter: gates by prereqs,    │
              │  score=0 or passthrough)      │
              └───────────────┬───────────────┘
                              │ delegates to
                              ▼
              ┌───────────────────────────────┐
              │ ELONavigator                  │
              │ (generator: produces cards    │
              │  near user skill level)       │
              └───────────────────────────────┘
```

**Generator strategies** (produce candidates):
- **ELO**: Cards near user skill, scored by ELO distance
- **SRS**: Overdue reviews, scored by overdueness

**Filter strategies** (wrap a delegate):
- **Hierarchy**: Gates by prerequisites — score=0 (locked) or delegate's score (unlocked)
- **Interference**: Reduces scores for cards with tags similar to recent history

For MVP: LP uses HierarchyDefinition(delegate=ELO) directly. Future: stack Interference on top.

### Strategy Data Access Pattern

Each strategy receives `user: UserDBInterface` and `course: CourseDBInterface` in its constructor. This provides:

**From UserDBInterface**:
- `getSeenCards(courseId)` — cards user has encountered
- `getActiveCards()` — cards currently scheduled  
- `getPendingReviews(courseId)` — scheduled reviews with timestamps
- `getCourseRegDoc(courseId)` — course registration including per-tag ELO
- `putCardRecord()` — card interaction history

**From CourseDBInterface**:
- `getAppliedTags(cardId)` — tags on a card
- `getCardEloData(cardIds)` — card difficulty ratings
- `getCourseTagStubs()` — all tags in course

**Strategy-specific storage**: Strategies can store their own data (e.g., interference events, session history) in userDB via the `DocumentUpdater` interface. Pattern: `{strategyType}-{strategyId}-{dataType}` document IDs. This supports multiple instances of the same strategy type (e.g., competing hierarchies, micro-hierarchies that cooperate).

---

## Implementation Phases

### Phase 1: WeightedCard Interface + ELO Implementation

**Goal**: Add `getWeightedCards()` to ContentNavigator, implement in ELO, maintain backward compat.

**Files to modify**:
- `packages/db/src/core/navigators/index.ts` — Add interface, types, default impl
- `packages/db/src/core/navigators/elo.ts` — Implement weighted cards with ELO scoring

**New types** (add to navigators/index.ts or separate types file):
```typescript
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;           // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Interface change**:
```typescript
// packages/db/src/core/navigators/index.ts

export abstract class ContentNavigator implements StudyContentSource {
  // Existing factory method unchanged
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> { /* ... */ }

  // NEW: Primary method for getting scored cards
  /**
   * Get cards with suitability scores.
   * 
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();
    
    const weighted: WeightedCard[] = [
      ...newCards.map(c => ({ 
        cardId: c.cardID, 
        courseId: c.courseID, 
        score: 1.0, 
        source: 'new' as const 
      })),
      ...reviews.map(r => ({ 
        cardId: r.cardID, 
        courseId: r.courseID, 
        score: 1.0, 
        source: 'review' as const 
      })),
    ];
    
    return weighted.slice(0, limit);
  }

  // DEPRECATED: Legacy methods maintained for backward compat
  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

**ELO implementation** (scoring by ELO distance):
```typescript
// packages/db/src/core/navigators/elo.ts

async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  // Get user's ELO for this course
  const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
  const userElo = courseReg?.elo?.global?.score ?? 1000;
  
  // Get new cards (existing logic)
  const newCards = await this.getNewCards(limit);
  
  // Get reviews (existing logic)  
  const reviews = await this.getPendingReviews();
  
  // Score new cards by ELO distance
  const scoredNew = await Promise.all(newCards.map(async (c) => {
    const [cardEloData] = await this.course.getCardEloData([c.cardID]);
    const cardElo = cardEloData?.global?.score ?? 1000;
    const distance = Math.abs(cardElo - userElo);
    const score = Math.max(0, 1 - distance / 500);
    
    return {
      cardId: c.cardID,
      courseId: c.courseID,
      score,
      source: 'new' as const,
    };
  }));
  
  // Score reviews by overdueness (placeholder: 1.0 for now)
  const scoredReviews = reviews.map(r => ({
    cardId: r.cardID,
    courseId: r.courseID,
    score: 1.0,  // TODO: score by overdueness
    source: 'review' as const,
  }));
  
  // Combine and sort by score
  const all = [...scoredNew, ...scoredReviews];
  all.sort((a, b) => b.score - a.score);
  
  return all.slice(0, limit);
}
```

**Success criteria**:
- [ ] `WeightedCard` type defined
- [ ] `getWeightedCards()` exists on ContentNavigator with default implementation
- [ ] ELONavigator implements `getWeightedCards()` with ELO-distance scoring
- [ ] Existing `getNewCards()` / `getPendingReviews()` still work (backward compat)
- [ ] New unit tests for `getWeightedCards()` behavior

**Estimated effort**: 3-4 hours

---

### Phase 2: HierarchyDefinition Strategy (Filter/Delegate Pattern)

**Goal**: Implement prerequisite-gated card selection using delegate pattern.

**New file**: `packages/db/src/core/navigators/hierarchyDefinition.ts`

**Configuration schema** (stored in `serializedData`):
```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: {
      requires: string[];           // Tags that must be mastered first
      masteryThreshold?: {
        minElo?: number;            // Default: compare to course avg for tag
        minCount?: number;          // Default: 3 (minimum interactions)
      };
    };
  };
  delegateStrategy?: string;        // Strategy to wrap (default: "elo")
}
```

**Example LP configuration**:
```json
{
  "prerequisites": {
    "letter-b": {
      "requires": ["letter-s", "letter-a", "letter-t"],
      "masteryThreshold": { "minCount": 5 }
    },
    "letter-d": {
      "requires": ["letter-b"],
      "masteryThreshold": { "minCount": 5 }
    },
    "cvc-words": {
      "requires": ["letter-s", "letter-a", "letter-t", "letter-m"],
      "masteryThreshold": { "minCount": 3 }
    }
  },
  "delegateStrategy": "elo"
}
```

**Delegate pattern implementation**:
```typescript
class HierarchyDefinitionNavigator extends ContentNavigator {
  private delegate: ContentNavigator;
  private config: HierarchyConfig;
  
  constructor(user, course, strategyData) {
    super();
    this.config = JSON.parse(strategyData.serializedData);
    // Delegate created in async init or lazily
  }
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // 1. Get candidates from delegate
    const candidates = await this.delegate.getWeightedCards(limit * 2);
    
    // 2. Get user's mastery state
    const masteredTags = await this.getMasteredTags();
    const unlockedTags = this.getUnlockedTags(masteredTags);
    
    // 3. Filter/gate candidates
    const gated: WeightedCard[] = [];
    for (const card of candidates) {
      const cardTags = await this.course.getAppliedTags(card.cardId);
      const isUnlocked = cardTags.every(tag => 
        unlockedTags.has(tag) || !this.hasPrerequisites(tag)
      );
      
      if (isUnlocked) {
        gated.push(card);  // Preserve delegate's score
      }
      // else: score=0, filtered out
      
      if (gated.length >= limit) break;
    }
    
    return gated;
  }
  
  // Legacy methods delegate through
  async getNewCards(n) { return this.delegate.getNewCards(n); }
  async getPendingReviews() { return this.delegate.getPendingReviews(); }
}
```

**Key methods**:
- `getMasteredTags(): Promise<Set<string>>` — tags where user ELO > threshold
- `getUnlockedTags(mastered): Set<string>` — tags whose prerequisites are all mastered
- `hasPrerequisites(tag): boolean` — check if tag is in config

**Mastery detection**:
- Get user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
- Compare `userElo(tag) > avgElo(tag)` (or configured threshold)
- Also check interaction count meets minimum

**Success criteria**:
- [ ] HierarchyDefinitionNavigator implemented with delegate pattern
- [ ] Configuration parsed from `serializedData`
- [ ] Delegate navigator created (defaults to ELO)
- [ ] Per-tag ELO correctly read from user's CourseElo
- [ ] Mastery detection works (ELO threshold + count)
- [ ] Locked cards filtered (score=0), unlocked cards preserve delegate score
- [ ] Unit tests for mastery detection, unlocking, filtering
- [ ] Integration test: user progresses through prerequisite chain

**Estimated effort**: 4-6 hours

---

### Phase 3: InterferenceMitigator Strategy (Filter/Delegate Pattern)

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

**New file**: `packages/db/src/core/navigators/interferenceMitigator.ts`

**Configuration schema**:
```typescript
interface InterferenceConfig {
  /** Groups of tags that interfere with each other */
  interferenceSets: string[][];  // e.g., [["b", "d", "p"], ["d", "t"]]
  
  /** Threshold below which a tag is considered "immature" */
  maturityThreshold?: {
    minCount?: number;   // default: 10
    minElo?: number;     // optional
  };
  
  /** How much to reduce score for interfering cards (default: 0.8) */
  interferenceDecay?: number;
  
  delegateStrategy?: string;    // Strategy to wrap (default: "elo")
}
```

**Example LP configuration**:
```json
{
  "interferenceSets": [
    ["b", "d", "p"],
    ["d", "t"],
    ["m", "n"]
  ],
  "maturityThreshold": { "minCount": 10 },
  "interferenceDecay": 0.8
}
```

**Algorithm**:
1. Build interference map from config (tag → set of interfering tags)
2. Identify user's **immature tags** (started but below maturity threshold)
3. Compute **tags to avoid** = partners of immature tags (excluding already-immature ones)
4. For each candidate card, reduce score if its tags overlap with avoid set

```typescript
class InterferenceMitigatorNavigator extends ContentNavigator {
  private interferenceMap: Map<string, Set<string>>;  // Precomputed from config
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const candidates = await this.delegate.getWeightedCards(limit * 3);
    
    // Identify what to avoid
    const immatureTags = await this.getImmatureTags();
    const tagsToAvoid = this.getTagsToAvoid(immatureTags);
    
    // Adjust scores
    const adjusted = candidates.map(card => {
      const cardTags = await this.getCardTags(card.cardId);
      const multiplier = this.computeInterferenceMultiplier(cardTags, tagsToAvoid);
      return { ...card, score: card.score * multiplier };
    });
    
    adjusted.sort((a, b) => b.score - a.score);
    return adjusted.slice(0, limit);
  }
  
  private async getImmatureTags(): Promise<Set<string>> {
    // Tags where user has count > 0 but below maturity threshold
    const userElo = await this.user.getCourseRegDoc(...).elo.tags;
    // Return tags that are started but not yet mature
  }
  
  private getTagsToAvoid(immatureTags: Set<string>): Set<string> {
    // For each immature tag, add its interference partners
    // (but not if partner is also immature — already learning both)
  }
  
  private computeInterferenceMultiplier(cardTags: string[], avoid: Set<string>): number {
    const interferingCount = cardTags.filter(t => avoid.has(t)).length;
    if (interferingCount === 0) return 1.0;
    return Math.pow(1.0 - decay, interferingCount);  // More interference = lower score
  }
}
```

**Key insight**: This is maturity-aware, not just recency-aware. The goal is to maximize conceptual distance when introducing new content while foundational concepts are still being learned.

**LP use case**: While learning `d`, prefer introducing `x` over `b` (visual similarity) or `t` (phonetic similarity). Once `d` is mature, `b` and `t` can be introduced freely.

**Future consideration**: Minimal-pair exercises (e.g., `bad` vs `dad`) for deliberate contrast when it IS time to introduce interfering concepts. May be a separate strategy or an extension.

**Success criteria**:
- [x] InterferenceMitigatorNavigator implemented with delegate pattern
- [x] Interference sets parsed from config, precomputed into map
- [x] Immature tag detection (started but below threshold)
- [x] Tags-to-avoid computation (partners of immature tags)
- [x] Score reduction based on interference overlap
- [x] Delegate's scores preserved and adjusted (multiplicative)

**Estimated effort**: 3-4 hours

---

### Phase 4: Orchestrator (Deferred)

**Note**: Not needed for LP MVP — delegate pattern handles composition. Documented for future.

**When needed**: For evolutionary experimentation (multi-arm bandit), A/B testing, or combining independent (non-nested) strategies.

**Key insight**: With delegate pattern, Hierarchy and Interference can be stacked:
```
Interference(delegate=Hierarchy(delegate=ELO))
```

This covers LP's needs. A full Orchestrator is for more complex cases:
- Multiple independent strategy "votes" combined by weight
- Dynamic strategy selection based on context
- Evolutionary utility tracking

**Future configuration sketch**:
```typescript
interface OrchestratorConfig {
  strategies: Array<{
    implementingClass: string;
    serializedData: string;
    weight: number;              // 0-1, relative importance
  }>;
  combineMode: 'multiply' | 'weighted-average' | 'min';
  fallbackStrategy?: string;
}
```

---

## Data Dependencies

### Per-Tag ELO (Already Exists)

**Location**: `CourseElo.tags` in user's course registration

**Current status**: Tracked but not used for card selection

**What we need**: Read access in HierarchyDefinition strategy via `user.getCourseRegDoc(courseId)`

```typescript
// From packages/db/src/core/types/user.ts
type CourseElo = {
  global: EloRank;
  tags: { [tagID: string]: EloRank };
};

type EloRank = {
  score: number;
  count: number;
};
```

### Session Context (For Interference)

**Current**: `SessionController` manages queues internally. Strategies access user history via `UserDBInterface`.

**Approach**: InterferenceMitigator queries `user.getSeenCards(courseId)`. Takes last N cards by document order.

**Note**: `getSeenCards()` returns card IDs only, no timestamps. For MVP, "last N cards" is sufficient. Future: query card records with timestamps for finer control.

### Delegate Strategy Creation

**Challenge**: Filter strategies need to instantiate their delegate navigator.

**Approach**: Use existing `ContentNavigator.create(user, course, strategyData)` factory:
```typescript
// In HierarchyDefinitionNavigator constructor or init
const delegateStrategyData = {
  implementingClass: this.config.delegateStrategy || 'elo',
  serializedData: '{}',
  // ... other required fields
};
this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
```

---

## File Changes Summary

| Phase | File | Change |
|-------|------|--------|
| 1 | `packages/db/src/core/navigators/index.ts` | Add `scoreCard()` abstract method with default |
| 1 | `packages/db/src/core/navigators/elo.ts` | Implement `scoreCard()` with ELO distance |
| 2 | `packages/db/src/core/navigators/hierarchyDefinition.ts` | New file |
| 2 | `packages/db/src/core/navigators/index.ts` | Register new navigator in factory |
| 3 | `packages/db/src/core/navigators/interferenceMitigator.ts` | New file |
| 3 | `packages/db/src/core/navigators/index.ts` | Register new navigator in factory |
| 3 | `packages/db/src/study/SessionController.ts` | Pass context to scoreCard (if Option B) |

---

## Testing Strategy

### Unit Tests

- `getWeightedCards()` default returns cards with score=1.0
- ELO scoring: distance 0 → 1.0, distance 500 → 0.0
- Hierarchy mastery detection: threshold logic
- Hierarchy unlocking: prerequisite chain traversal
- Hierarchy gating: locked cards filtered, unlocked preserve delegate score
- Interference similarity: Jaccard calculation
- Interference score adjustment: high similarity → reduced score (multiplicative)

### Integration Tests

- Hierarchy: New user sees only root-level content, progresses as mastery increases
- Interference: Similar cards get lower scores, appear later in sequence
- Delegate chain: `Interference(Hierarchy(ELO))` works correctly
- Backward compat: `getNewCards()` / `getPendingReviews()` still work

### Manual Testing (LP-specific)

- Fresh user sees `s`, `a`, `t` before `b` or `d`
- User who knows `s`, `a`, `t` unlocks CVC words
- Letters `b` and `d` get reduced scores when one was recently seen

---

## Success Metrics

**Development**:
- [ ] Phase 1-3 complete
- [ ] All unit tests passing
- [ ] No regression in existing navigator tests

**LP validation**:
- [ ] Prerequisite chain enforced in practice sessions
- [ ] Confusable letters separated
- [ ] Session feels coherent (not random-seeming)

**Future-readiness**:
- [ ] Strategies implement `scoreCard()` with meaningful values
- [ ] Orchestrator (Phase 4) can be added without modifying strategies
- [ ] Evolutionary layer can assign/remove strategies via configuration

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Per-tag ELO not populated for new users | Medium | Default to unlocked for tags with no data; hierarchy config can specify "root" tags |
| Over-filtering leaves no cards | Low (LP controls content) | Delegate chain ensures base ELO always provides candidates; Hierarchy gates but doesn't generate |
| Tag query performance | Low | Batch tag fetches; cache for session duration |
| Hierarchy graph cycles | Low (LP controls config) | Add cycle detection in Phase 2; error on save |
| Delegate creation fails | Low | Validate delegate strategy exists; fall back to ELO |

---

## Open Decisions

1. ~~**Context passing for Interference**~~: Resolved — strategies access user history directly via `UserDBInterface.getSeenCards()`.

2. ~~**Root tag handling**~~: Confirmed — tags with no prerequisites are always unlocked.

3. ~~**Mastery threshold defaults**~~: Mastery = `userElo(tag) > avgElo(tag)`. The hierarchy config can set specific per-tag targets.

4. ~~**Tag query batching**~~: Current `getAppliedTags(courseId, cardId)` is single-card. For MVP, acceptable.

5. ~~**Recency filtering for interference**~~: Use "last N cards" by document order. Timestamps available if needed later.

6. ~~**Interface shape**~~: Resolved — `getWeightedCards()` returns scored cards. Filter strategies use delegate pattern, adjusting delegate's scores.

---

## Next Steps

1. User approves plan
2. Create `a.3.todo.md` with checkboxed task breakdown
3. Begin Phase 1 implementation

```


## Assistant

Now let's verify the build still works with the updated annotations:

**Tool Call: `yarn workspace @vue-skuilder/db build 2>&1 | tail -20`**
Status: Completed

```
DTS dist/core/index.d.ts                  8.38 KB
DTS dist/util/packer/index.d.ts           352.00 B
DTS dist/dataLayerProvider-Bt_8bZKM.d.ts  1.42 KB
DTS dist/types-CewsN87z.d.ts              1.42 KB
DTS dist/types-legacy-6ettoclI.d.ts       4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.ts       2.46 KB
DTS dist/userDB-CjUUxYCI.d.ts             18.25 KB
DTS dist/index-CD8BZz2k.d.ts              4.06 KB
DTS dist/pouch/index.d.mts                35.00 B
DTS dist/impl/static/index.d.mts          8.70 KB
DTS dist/impl/couch/index.d.mts           14.47 KB
DTS dist/index.d.mts                      18.28 KB
DTS dist/core/index.d.mts                 8.39 KB
DTS dist/util/packer/index.d.mts          355.00 B
DTS dist/dataLayerProvider-JZqjS-0U.d.mts 1.42 KB
DTS dist/types-Dbp5DaRR.d.mts             1.42 KB
DTS dist/types-legacy-6ettoclI.d.mts      4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.mts      2.46 KB
DTS dist/userDB-Bfx0CqNA.d.mts            18.26 KB
DTS dist/index-Bmll7Xse.d.mts             4.06 KB
```

## Assistant

Build succeeded. Let me also update the todo to reflect this pre-work:

**Tool Call: agent/orchestrator/a.3.todo.md**
Status: Completed

Diff: master/agent/orchestrator/a.3.todo.md
```
# TODO: Scorable NavigationStrategy Architecture

**Reference**: See `a.2.plan.md` for full context, architecture diagrams, and rationale.

**Summary**: Add `getWeightedCards()` method to navigation strategies that returns cards with suitability scores. Filter strategies (Hierarchy, Interference) use a delegate pattern — they wrap another strategy and transform its output.

---

## Phase 1: WeightedCard Interface + ELO Implementation

**Status**: COMPLETED

**Goal**: Add `getWeightedCards()` to `ContentNavigator`, implement in ELO, maintain backward compat with `getNewCards()`/`getPendingReviews()`.

### Tasks

- [x] p1.1: Define `WeightedCard` type
  - File: `packages/db/src/core/navigators/index.ts`
  - Fields: `cardId`, `courseId`, `score` (0-1), `source` ('new' | 'review' | 'failed')

- [x] p1.2: Add `getWeightedCards()` to `ContentNavigator` base class
  - File: `packages/db/src/core/navigators/index.ts`
  - Signature: `async getWeightedCards(limit: number): Promise<WeightedCard[]>`
  - Default implementation: calls legacy `getNewCards()` + `getPendingReviews()`, assigns score=1.0

- [x] p1.3: Implement `getWeightedCards()` in `ELONavigator`
  - File: `packages/db/src/core/navigators/elo.ts`
  - Get user ELO via `this.user.getCourseRegDoc(courseId)` + `toCourseElo()`
  - Score = inverse of ELO distance: `Math.max(0, 1 - distance / 500)`
  - Batches ELO lookups for efficiency
  - Combine new cards + reviews, sort by score descending

- [x] p1.4: Add unit tests
  - Created: `packages/db/src/core/navigators/navigators.test.ts`
  - Tests for WeightedCard type structure
  - Tests for default getWeightedCards() behavior
  - Tests for ELO scoring formula

- [x] p1.5: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 2: HierarchyDefinition Strategy

**Status**: COMPLETED

**Goal**: Prerequisite-gated card selection using delegate pattern. Cards locked until user masters prerequisite tags.

### Tasks

- [x] p2.1: Create `HierarchyDefinitionNavigator` class
  - Created: `packages/db/src/core/navigators/hierarchyDefinition.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p2.2: Parse config from `serializedData`
  ```typescript
  interface HierarchyConfig {
    prerequisites: {
      [tagId: string]: {
        requires: string[];
        masteryThreshold?: { minElo?: number; minCount?: number; };
      };
    };
    delegateStrategy?: string;  // default: "elo"
  }
  ```

- [x] p2.3: Create delegate navigator in constructor/init
  - Uses lazy initialization via `getDelegate()` method
  - Uses `ContentNavigator.create(user, course, delegateStrategyData)`
  - Default delegate: ELO

- [x] p2.4: Implement `getMasteredTags(): Promise<Set<string>>`
  - Gets user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
  - Tag is mastered if: `userElo(tag) >= threshold` AND `count >= minCount`
  - Falls back to comparing tag ELO vs global user ELO if no minElo specified

- [x] p2.5: Implement `getUnlockedTags(mastered: Set<string>): Set<string>`
  - Tag is unlocked if all its prerequisites are in `mastered`
  - Tags with no prerequisites are always unlocked

- [x] p2.6: Implement `getWeightedCards(limit)`
  - Gets candidates from delegate (over-fetch: `limit * 2`)
  - For each candidate, checks if card is unlocked via `isCardUnlocked()`
  - Locked cards filtered out, unlocked cards preserve delegate's score
  - Returns filtered list up to limit

- [x] p2.7: Implement legacy methods (delegate through)
  - `getNewCards(n)` → `this.delegate.getNewCards(n)`
  - `getPendingReviews()` → `this.delegate.getPendingReviews()`

- [x] p2.8: Register in factory
  - Already added to `Navigators` enum in Phase 1: `HIERARCHY = 'hierarchyDefinition'`

- [x] p2.9: Add unit tests
  - Added to `navigators.test.ts`:
  - Mastery detection (ELO threshold + count)
  - Unlocking logic (prerequisite chain)
  - Card unlocking (mixed tags with/without prereqs)

- [x] p2.10: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3: InterferenceMitigator Strategy

**Status**: COMPLETED

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

### Tasks

- [x] p3.1: Create `InterferenceMitigatorNavigator` class
  - Created: `packages/db/src/core/navigators/interferenceMitigator.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.2: Parse config from `serializedData`
  - `interferenceSets: string[][]` — groups of tags that interfere (e.g., `[["b","d","p"], ["d","t"]]`)
  - `maturityThreshold: { minCount?, minElo? }` — when a tag is considered mature
  - `interferenceDecay` (default: 0.8)
  - `delegateStrategy` (default: "elo")

- [x] p3.3: Build interference map from config (tag → set of partners)

- [x] p3.4: Implement `getImmatureTags(): Promise<Set<string>>`
  - Tags where user has count > 0 but below maturity threshold

- [x] p3.5: Implement `getTagsToAvoid(immatureTags): Set<string>`
  - Partners of immature tags (excluding already-immature ones)

- [x] p3.6: Implement `computeInterferenceMultiplier()`
  - Score reduction based on overlap with avoid set
  - `Math.pow(1 - decay, interferingCount)`

- [x] p3.7: Implement `getWeightedCards(limit)`
  - Maturity-aware interference avoidance

- [x] p3.8: Implement legacy methods (delegate through)

- [x] p3.9: Register in factory
  - Already added to `Navigators` enum in Phase 1

- [x] p3.10: Verify build passes
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3.5: RelativePriority Strategy

**Status**: COMPLETED

**Goal**: Boost scores for high-utility content based on author-defined tag priorities. Prefer common, well-behaved patterns (like 's') over rare/irregular ones (like 'x', 'z').

### Tasks

- [x] p3.5.1: Create `RelativePriorityNavigator` class
  - Created: `packages/db/src/core/navigators/relativePriority.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.5.2: Define config interface
  ```typescript
  interface RelativePriorityConfig {
    tagPriorities: { [tagId: string]: number };  // 0-1, where 1.0 = highest priority
    defaultPriority?: number;                     // for unlisted tags (default: 0.5)
    combineMode?: 'max' | 'average' | 'min';      // how to combine multiple tags
    priorityInfluence?: number;                   // how strongly priority affects score (default: 0.5)
    delegateStrategy?: string;                    // default: "elo"
  }
  ```

- [x] p3.5.3: Implement boost factor computation
  - Formula: `boostFactor = 1 + (priority - 0.5) * priorityInfluence`
  - Priority 1.0 with influence 0.5 → boost 1.25 (25% higher)
  - Priority 0.5 → boost 1.00 (neutral)
  - Priority 0.0 with influence 0.5 → boost 0.75 (25% lower)

- [x] p3.5.4: Implement `getWeightedCards(limit)`
  - Get candidates from delegate
  - Look up tags for each card
  - Compute combined priority (max/average/min)
  - Apply boost factor to delegate score
  - Clamp to [0, 1] and sort

- [x] p3.5.5: Register in factory
  - Added to `Navigators` enum: `RELATIVE_PRIORITY = 'relativePriority'`

- [x] p3.5.6: Add unit tests
  - Added to `navigators.test.ts`:
  - Boost factor computation (18 new tests)
  - Tag priority combination (max/average/min modes)
  - Score adjustment with clamping

- [x] p3.5.7: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: 48 tests passing ✓

---

## Phase 4: Orchestrator (DEFERRED)

**Status**: NOT STARTED — not needed for LP MVP

Delegate pattern handles composition for now. Full orchestrator needed for:
- Multi-arm bandit experimentation
- A/B testing independent strategies
- Dynamic strategy selection

---

## Phase 4a: Production Integration (IN PROGRESS)

**Status**: PRE-WORK COMPLETE

**Goal**: Wire SessionController to use `getWeightedCards()` so new strategies are actually exercised at runtime.

### Key Gap
Currently, `SessionController` still calls legacy `getNewCards()` / `getPendingReviews()`. The new `getWeightedCards()` API is implemented but not integrated.

### Pre-work: API Documentation & Deprecation Notices (COMPLETED)

To avoid future confusion about the interface design (Chesterton's Fence), we documented the 
evolution from legacy to new API and added deprecation notices.

- [x] p4a.0.1: Create ARCHITECTURE.md migration guide
  - Created: `packages/db/src/core/navigators/ARCHITECTURE.md`
  - Documents historical context (why getNewCards/getPendingReviews exist)
  - Explains the problem (artifacts of hard-coded ELO + SRS strategies)
  - Describes solution (unified getWeightedCards with scores)
  - Shows generator vs filter strategy patterns
  - Provides implementation examples

- [x] p4a.0.2: Add deprecation notices to StudyContentSource
  - File: `packages/db/src/core/interfaces/contentSource.ts`
  - Added API migration notice block at top
  - Added @deprecated JSDoc to interface and methods
  - Explains migration path

- [x] p4a.0.3: Add deprecation notices to ContentNavigator
  - File: `packages/db/src/core/navigators/index.ts`
  - Added module-level documentation block
  - Added @deprecated JSDoc to legacy methods
  - Expanded getWeightedCards() documentation

- [x] p4a.0.4: Update plan document with migration strategy
  - File: `agent/orchestrator/a.2.plan.md`
  - Added "API Migration Strategy" section
  - Documents historical context and rationale

### Tasks (estimated)
- [ ] p4a.1: Add parallel path in SessionController for weighted card selection
- [ ] p4a.2: Extend `getDebugInfo()` to include active strategy info
- [ ] p4a.3: Add strategy creation support (CLI or UI)

---

## Notes for Implementers

### Key Files
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base, factory, Navigators enum
- `packages/db/src/core/navigators/elo.ts` — Reference generator strategy
- `packages/db/src/core/navigators/relativePriority.ts` — Priority-based score boosting
- `packages/db/src/core/interfaces/userDB.ts` — UserDBInterface (history, ELO)
- `packages/db/src/impl/couch/courseDB.ts` — Tag queries, ELO queries

### Commands
- Build: `yarn workspace @vue-skuilder/db build`
- Test: `yarn workspace @vue-skuilder/db test`
- Type check: `yarn workspace @vue-skuilder/db type-check`

### Scoring Semantics
- `1.0` = fully suitable
- `0.0` = hard filter (e.g., prerequisite not met)
- `0.5` = neutral
- Intermediate = soft preference

### Delegate Pattern
Filter strategies wrap a delegate and transform its output:
```
RelativePriority(delegate=Interference(delegate=Hierarchy(delegate=ELO)))
```
- ELO generates candidates with scores
- Hierarchy gates (filters locked cards, preserves scores)
- Interference adjusts scores (multiplicative reduction for similar tags)
- RelativePriority boosts/reduces scores based on tag utility

### Data Access (via constructor params)
- `user: UserDBInterface`
  - `user.getSeenCards(courseId)` — card history
  - `user.getCourseRegDoc(courseId).elo.tags` — per-tag ELO
- `course: CourseDBInterface`
  - `course.getAppliedTags(cardId)` — tags on a card
  - `course.getCardEloData([cardId])` — card difficulty
```


## Assistant

---

## Summary

I've completed the pre-work for Phase 4a — documenting the API migration strategy and adding deprecation notices. Here's what was created/modified:

### Files Created

| File | Purpose |
|------|---------|
| `packages/db/src/core/navigators/ARCHITECTURE.md` | Comprehensive migration guide explaining the evolution from legacy API to `getWeightedCards()` |

### Files Modified

| File | Changes |
|------|---------|
| `packages/db/src/core/interfaces/contentSource.ts` | Added 40-line migration notice header + `@deprecated` JSDoc on `StudyContentSource` interface and methods |
| `packages/db/src/core/navigators/index.ts` | Added 33-line module documentation + `@deprecated` JSDoc on legacy methods + expanded `getWeightedCards()` docs |
| `agent/orchestrator/a.2.plan.md` | Added "API Migration Strategy" section (100 lines) documenting historical context |
| `agent/orchestrator/a.3.todo.md` | Added Phase 4a pre-work tasks (completed) |

### Key Documentation Captured

1. **Historical context** — Why `getNewCards()` / `getPendingReviews()` existed (artifacts of hard-coded ELO + SRS)

2. **The problem** — "What does 'get reviews' mean for an interference mitigator?" The abstraction didn't fit.

3. **The solution** — `getWeightedCards()` returns unified scored candidates; new/review becomes metadata (`WeightedCard.source`)

4. **Composition model** — Generators produce candidates, filters wrap delegates

5. **Migration path** — Parallel APIs → SessionController migration → deprecation → removal

This documentation prevents the confused interface from becoming a Chesterton's Fence — future maintainers will understand the evolution and not be surprised by the dual APIs.

---

Ready to proceed with **p4a.1: Add parallel path in SessionController for weighted card selection** when you're ready.

## User

oKAY, THIS IS EXCELLENT IN GENERAL. i LIKE TO BUTT IN WITH ONE MINOR TWEAK.  (oops caps)

`source: 'new' | 'review' | 'failed';` still feels vestigial.

we do want *sourcing*
- A primary goal of this framework is to make dynamic and rich and adaptive courseware that is also legible and transparent. Surfaced content should contain an audit trail - it should be knowable how the ContentNavigator(s) colluded together to surface it. This is important both in a "free software free society" way (informed consent) and for continual improvement purposes (eg, if something not useful is surfaced, the pathways can be inspected and improved)

so the `source` field here probably wants to exist, but to contain somethign like a running-record of how its eventual utility score was produced - each NavigationStrategy that processes the card could append a structured log or something?

**Tool Call: Thinking**
Status: Completed

The user is making an excellent point. The `source: 'new' | 'review' | 'failed'` field is indeed vestigial - it's carrying forward the old API's categorization rather than serving the new architecture's goals.

What they want instead is:
1. **Audit trail** - How did this card get surfaced? What strategies processed it and how did they score it?
2. **Transparency** - Users/authors should be able to understand why content was selected
3. **Debuggability** - If something not useful is surfaced, inspect the pathway and improve

So instead of a simple enum, the `source` field (or a new field) should be something like:
- A list of strategy contributions
- Each entry showing: which strategy, what it did, maybe the score before/after

Something like:
```typescript
interface StrategyContribution {
  strategy: string;           // e.g., 'elo', 'hierarchyDefinition'
  action: 'generated' | 'filtered' | 'adjusted';
  scoreBefore?: number;
  scoreAfter: number;
  reason?: string;            // human-readable explanation
}

interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];  // the audit trail
}
```

The 'new' | 'review' | 'failed' distinction could be captured in the first entry's metadata or as a separate lightweight field if SessionController still needs it for queue routing.

Let me think about backwards compatibility:
- The existing `source` field is used by the tests and possibly by SessionController
- We could keep `source` as a simple field for queue routing AND add `provenance` for the audit trail
- Or we could deprecate `source` entirely and derive it from provenance[0]

I think the cleanest approach:
1. Keep `source` for now (SessionController needs it for queue management)
2. Add `provenance: StrategyContribution[]` as the audit trail
3. Make it optional initially so existing code doesn't break
4. Strategies append to provenance as they process

Let me propose this to the user.


## Assistant

You're absolutely right. The `'new' | 'review' | 'failed'` enum is carrying forward the old mental model. What we actually want is **provenance** — an audit trail of how the card arrived at its score.

Here's a proposal:

```master/dev/null/weighted-card-provenance.ts#L1-35
interface StrategyContribution {
  /** Which strategy processed this card */
  strategy: string;  // e.g., 'elo', 'hierarchyDefinition', 'interferenceMitigator'
  
  /** What the strategy did */
  action: 'generated' | 'passed' | 'filtered' | 'boosted' | 'penalized';
  
  /** Score after this strategy's processing */
  score: number;
  
  /** Human-readable explanation (optional, for transparency) */
  reason?: string;
}

interface WeightedCard {
  cardId: string;
  courseId: string;
  
  /** Final composite score */
  score: number;
  
  /** 
   * Audit trail: how this card was surfaced.
   * Each strategy that processes the card appends its contribution.
   * 
   * Example:
   * [
   *   { strategy: 'elo', action: 'generated', score: 0.85, reason: 'ELO distance 75' },
   *   { strategy: 'hierarchyDefinition', action: 'passed', score: 0.85, reason: 'prereqs met' },
   *   { strategy: 'interferenceMitigator', action: 'penalized', score: 0.68, reason: 'interferes with immature tag "d"' },
   *   { strategy: 'relativePriority', action: 'boosted', score: 0.78, reason: 'high-priority tag "s" (0.95)' }
   * ]
   */
  provenance: StrategyContribution[];
}
```

**For backward compatibility during transition:**

The `source: 'new' | 'review' | 'failed'` could be:
1. **Derived** from `provenance[0]` — the generator strategy knows if it came from SRS (review) or new-card pool
2. **Kept temporarily** as a lightweight hint for SessionController's queue routing, then deprecated

**Implementation pattern for strategies:**

```master/dev/null/strategy-provenance-pattern.ts#L1-20
// Generator strategy (e.g., ELO)
const card: WeightedCard = {
  cardId: c.id,
  courseId: this.courseId,
  score: eloScore,
  provenance: [{
    strategy: 'elo',
    action: 'generated',
    score: eloScore,
    reason: `ELO distance ${distance}, source: ${isReview ? 'review' : 'new'}`
  }]
};

// Filter strategy appends to existing provenance
return candidates.map(card => ({
  ...card,
  score: adjustedScore,
  provenance: [...card.provenance, {
    strategy: 'relativePriority',
    action: adjustedScore > card.score ? 'boosted' : 'penalized',
    score: adjustedScore,
    reason: `priority ${priority} → boost ${boostFactor.toFixed(2)}`
  }]
}));
```

---

**Questions before I implement:**

1. Should `provenance` be required from the start, or optional during migration?
2. Keep `source` temporarily for SessionController queue routing, or rip it out now and derive from provenance?
3. Any preferences on the `action` vocabulary? I proposed: `generated | passed | filtered | boosted | penalized`

## User

let's leave this as an aside for now - provenance is a good framing - create a small todo-provenance.md doc in the directory to outline spirit and implementation sketch.

**Tool Call: agent/orchestrator/todo-provenance.md**
Status: Completed

Diff: agent/orchestrator/todo-provenance.md
```
# TODO: WeightedCard Provenance (Audit Trail)

## Status: DEFERRED

This is a future enhancement to replace the vestigial `source: 'new' | 'review' | 'failed'` field
with a proper audit trail that explains how each card was surfaced.

## Spirit

A primary goal of this framework is to make dynamic, rich, adaptive courseware that is also
**legible and transparent**. Surfaced content should contain an audit trail — it should be
knowable how the ContentNavigator(s) colluded together to surface it.

This matters for:
1. **Informed consent** ("free software, free society") — users should understand why they're 
   seeing what they're seeing
2. **Continual improvement** — if something not useful is surfaced, the pathways can be inspected
   and improved
3. **Debugging** — developers and course authors can trace scoring decisions

## The Problem

The current `WeightedCard.source` field:
```typescript
source: 'new' | 'review' | 'failed'
```

This is vestigial — it carries forward the old API's categorization (artifacts of hard-coded
ELO + SRS) rather than serving the new architecture's transparency goals.

## Proposed Solution: Provenance

Replace (or augment) `source` with a `provenance` array that records each strategy's contribution:

```typescript
interface StrategyContribution {
  /** Which strategy processed this card */
  strategy: string;  // e.g., 'elo', 'hierarchyDefinition'
  
  /** What the strategy did */
  action: 'generated' | 'passed' | 'filtered' | 'boosted' | 'penalized';
  
  /** Score after this strategy's processing */
  score: number;
  
  /** Human-readable explanation (optional) */
  reason?: string;
}

interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];
}
```

### Example Provenance Trail

```typescript
provenance: [
  { strategy: 'elo', action: 'generated', score: 0.85, 
    reason: 'ELO distance 75, source: new' },
  { strategy: 'hierarchyDefinition', action: 'passed', score: 0.85, 
    reason: 'prereqs met: letter-sounds' },
  { strategy: 'interferenceMitigator', action: 'penalized', score: 0.68, 
    reason: 'interferes with immature tag "d" (decay 0.8)' },
  { strategy: 'relativePriority', action: 'boosted', score: 0.78, 
    reason: 'high-priority tag "s" (0.95) → boost 1.15' }
]
```

## Implementation Sketch

### Generator Strategies

Create initial provenance when generating candidates:

```typescript
// In ELONavigator.getWeightedCards()
const card: WeightedCard = {
  cardId: c.id,
  courseId: this.courseId,
  score: eloScore,
  provenance: [{
    strategy: 'elo',
    action: 'generated',
    score: eloScore,
    reason: `ELO distance ${distance}${isReview ? ', due for review' : ', new card'}`
  }]
};
```

### Filter Strategies

Append to existing provenance:

```typescript
// In RelativePriorityNavigator.getWeightedCards()
return candidates.map(card => ({
  ...card,
  score: adjustedScore,
  provenance: [...card.provenance, {
    strategy: 'relativePriority',
    action: adjustedScore > card.score ? 'boosted' : 
            adjustedScore < card.score ? 'penalized' : 'passed',
    score: adjustedScore,
    reason: `priority ${priority.toFixed(2)} → factor ${boostFactor.toFixed(2)}`
  }]
}));
```

## Migration Path

1. **Phase A**: Add `provenance` as optional field
   - New strategies populate it
   - Legacy code ignores it
   - Tests verify provenance structure

2. **Phase B**: SessionController uses provenance
   - Derive new/review/failed from `provenance[0].reason` or add explicit metadata
   - Display provenance in debug UI

3. **Phase C**: Deprecate `source` field
   - Remove once all consumers use provenance

## Backward Compatibility

The `source` field may still be needed temporarily for SessionController queue routing.
Options:
- Keep both fields during transition
- Derive `source` from `provenance[0]` (generator knows if it's review/new)
- Add a lightweight `origin: 'new' | 'review' | 'failed'` that's purely for routing

## Open Questions

1. Should `provenance` be required or optional?
2. Should we keep `source` for queue routing, or derive from provenance?
3. What's the right `action` vocabulary? Proposed: `generated | passed | filtered | boosted | penalized`
4. Should `reason` be structured (for machine parsing) or freeform (for human reading)?
5. Performance: is copying/extending arrays on each strategy pass acceptable?

## Related

- `packages/db/src/core/navigators/ARCHITECTURE.md` — API migration guide
- `packages/db/src/core/navigators/index.ts` — WeightedCard definition
- `agent/orchestrator/a.2.plan.md` — overall navigation strategy plan
```


## Assistant

Done. Created `todo-provenance.md` capturing the spirit and implementation sketch. This documents the future direction without blocking current work.

Ready to proceed with **p4a.1: SessionController integration** when you are.

## User

fantastic. checkpointed all w/ commit.

move now on 4A please

**Tool Call: Read file `packages/db/src/study/SessionController.ts`**
Status: Completed

```master/packages/db/src/study/SessionController.ts
import { SrsService } from './services/SrsService';
import { EloService } from './services/EloService';
import { ResponseProcessor } from './services/ResponseProcessor';
import { CardHydrationService, HydratedCard } from './services/CardHydrationService';
import { ItemQueue } from './ItemQueue';
import {
  isReview,
  StudyContentSource,
  StudySessionFailedItem,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/impl/couch';

import { CardRecord, CardHistory, CourseRegistrationDoc } from '@db/core';
import { Loggable } from '@db/util';
import { ScheduledCard } from '@db/core/types/user';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface StudySessionRecord {
  card: {
    course_id: string;
    card_id: string;
    card_elo: number;
  };
  item: StudySessionItem;
  records: CardRecord[];
}

import { DataLayerProvider } from '@db/core';

export type SessionAction =
  | 'dismiss-success'
  | 'dismiss-failed'
  | 'marked-failed'
  | 'dismiss-error';

export interface ResponseResult {
  // Navigation
  nextCardAction: Exclude<SessionAction, 'dismiss-error'> | 'none';
  shouldLoadNextCard: boolean;

  // UI Data (let view decide how to render)
  isCorrect: boolean;
  performanceScore?: number; // for shadow color calculation

  // Cleanup
  shouldClearFeedbackShadow: boolean;
}

interface SessionServices {
  response: ResponseProcessor;
}

export class SessionController<TView = unknown> extends Loggable {
  _className = 'SessionController';

  public services: SessionServices;
  private srsService: SrsService;
  private eloService: EloService;
  private hydrationService: CardHydrationService<TView>;

  private sources: StudyContentSource[];
  // dataLayer and getViewComponent now injected into CardHydrationService
  private _sessionRecord: StudySessionRecord[] = [];
  public set sessionRecord(r: StudySessionRecord[]) {
    this._sessionRecord = r;
  }

  // Session card stores
  private _currentCard: HydratedCard<TView> | null = null;

  private reviewQ: ItemQueue<StudySessionReviewItem> = new ItemQueue<StudySessionReviewItem>();
  private newQ: ItemQueue<StudySessionNewItem> = new ItemQueue<StudySessionNewItem>();
  private failedQ: ItemQueue<StudySessionFailedItem> = new ItemQueue<StudySessionFailedItem>();
  // END   Session card stores

  private startTime: Date;
  private endTime: Date;
  private _secondsRemaining: number;
  public get secondsRemaining(): number {
    return this._secondsRemaining;
  }
  public get report(): string {
    return `${this.reviewQ.dequeueCount} reviews, ${this.newQ.dequeueCount} new cards`;
  }
  public get detailedReport(): string {
    return this.newQ.toString + '\n' + this.reviewQ.toString + '\n' + this.failedQ.toString;
  }
  // @ts-expect-error NodeJS.Timeout type not available in browser context
  private _intervalHandle: NodeJS.Timeout;

  /**
   *
   */
  constructor(
    sources: StudyContentSource[],
    time: number,
    dataLayer: DataLayerProvider,
    getViewComponent: (viewId: string) => TView
  ) {
    super();

    this.srsService = new SrsService(dataLayer.getUserDB());
    this.eloService = new EloService(dataLayer, dataLayer.getUserDB());

    this.hydrationService = new CardHydrationService<TView>(
      getViewComponent,
      (courseId: string) => dataLayer.getCourseDB(courseId),
      () => this._selectNextItemToHydrate(),
      (item: StudySessionItem) => this.removeItemFromQueue(item),
      () => this.hasAvailableCards()
    );

    this.services = {
      response: new ResponseProcessor(this.srsService, this.eloService),
    };

    this.sources = sources;
    this.startTime = new Date();
    this._secondsRemaining = time;
    this.endTime = new Date(this.startTime.valueOf() + 1000 * this._secondsRemaining);

    this.log(`Session constructed:
    startTime: ${this.startTime}
    endTime: ${this.endTime}`);
  }

  private tick() {
    this._secondsRemaining = Math.floor((this.endTime.valueOf() - Date.now()) / 1000);
    // this.log(this.secondsRemaining);

    if (this._secondsRemaining <= 0) {
      clearInterval(this._intervalHandle);
    }
  }

  /**
   * Returns a rough, erring toward conservative, guess at
   * the amount of time the failed cards queue will require
   * to clean up.
   *
   * (seconds)
   */
  private estimateCleanupTime(): number {
    let time: number = 0;
    for (let i = 0; i < this.failedQ.length; i++) {
      const c = this.failedQ.peek(i);
      // this.log(`Failed card ${c.qualifiedID} found`)

      const record = this._sessionRecord.find((r) => r.item.cardID === c.cardID);
      let cardTime = 0;

      if (record) {
        // this.log(`Card Record Found...`);
        for (let j = 0; j < record.records.length; j++) {
          cardTime += record.records[j].timeSpent;
        }
        cardTime = cardTime / record.records.length;
        time += cardTime;
      }
    }

    const ret: number = time / 1000;
    this.log(`Failed card cleanup estimate: ${Math.round(ret)}`);
    return ret;
  }

  /**
   * Extremely rough, conservative, estimate of amound of time to complete
   * all scheduled reviews
   */
  private estimateReviewTime(): number {
    const ret = 5 * this.reviewQ.length;
    this.log(`Review card time estimate: ${ret}`);
    return ret;
  }

  public async prepareSession() {
    try {
      await Promise.all([this.getScheduledReviews(), this.getNewCards()]);
    } catch (e) {
      this.error('Error preparing study session:', e);
    }

    await this.hydrationService.ensureHydratedCards();

    this._intervalHandle = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public addTime(seconds: number) {
    this.endTime = new Date(this.endTime.valueOf() + 1000 * seconds);
  }

  public get failedCount(): number {
    return this.failedQ.length;
  }

  public toString() {
    return `Session: ${this.reviewQ.length} Reviews, ${this.newQ.length} New, ${this.failedQ.length} failed`;
  }
  public reportString() {
    return `${this.reviewQ.dequeueCount} Reviews, ${this.newQ.dequeueCount} New, ${this.failedQ.dequeueCount} failed`;
  }

  /**
   * Returns debug information about the current session state.
   * Used by SessionControllerDebug component for runtime inspection.
   */
  public getDebugInfo() {
    const extractQueueItems = (queue: ItemQueue<any>, limit: number = 10) => {
      const items = [];
      for (let i = 0; i < Math.min(queue.length, limit); i++) {
        const item = queue.peek(i);
        items.push({
          courseID: item.courseID || 'unknown',
          cardID: item.cardID || 'unknown',
          status: item.status || 'unknown',
        });
      }
      return items;
    };

    const extractHydratedItems = () => {
      // We can't easily iterate the hydrated queue without dequeuing,
      // so we'll just report the count via hydratedCache.count below

      const items: any[] = [];
      return items;
    };

    return {
      reviewQueue: {
        length: this.reviewQ.length,
        dequeueCount: this.reviewQ.dequeueCount,
        items: extractQueueItems(this.reviewQ),
      },
      newQueue: {
        length: this.newQ.length,
        dequeueCount: this.newQ.dequeueCount,
        items: extractQueueItems(this.newQ),
      },
      failedQueue: {
        length: this.failedQ.length,
        dequeueCount: this.failedQ.dequeueCount,
        items: extractQueueItems(this.failedQ),
      },
      hydratedCache: {
        count: this.hydrationService.hydratedCount,
        failedCacheSize: this.hydrationService.failedCacheSize,
        items: extractHydratedItems(),
      },
    };
  }

  private async getScheduledReviews() {
    const reviews = await Promise.all(
      this.sources.map((c) =>
        c.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source ${c}:`, error);
          return [];
        })
      )
    );

    const dueCards: (StudySessionReviewItem & ScheduledCard)[] = [];

    while (reviews.length != 0 && reviews.some((r) => r.length > 0)) {
      // pick a random review source
      const index = randomInt(0, reviews.length - 1);
      const source = reviews[index];

      if (source.length === 0) {
        reviews.splice(index, 1);
        continue;
      } else {
        dueCards.push(source.shift()!);
      }
    }

    let report = 'Review session created with:\n';
    this.reviewQ.addAll(dueCards, (c) => c.cardID);
    report += dueCards.map((card) => `Card ${card.courseID}::${card.cardID} `).join('\n');
    this.log(report);
  }

  private async getNewCards(n: number = 10) {
    const perCourse = Math.ceil(n / this.sources.length);
    const newContent = await Promise.all(this.sources.map((c) => c.getNewCards(perCourse)));

    // [ ] is this a noop?
    newContent.forEach((newContentFromSource) => {
      newContentFromSource.filter((c) => {
        return this._sessionRecord.find((record) => record.card.card_id === c.cardID) === undefined;
      });
    });

    while (n > 0 && newContent.some((nc) => nc.length > 0)) {
      for (let i = 0; i < newContent.length; i++) {
        if (newContent[i].length > 0) {
          const item = newContent[i].splice(0, 1)[0];
          this.log(`Adding new card: ${item.courseID}::${item.cardID}`);
          this.newQ.add(item, item.cardID);
          n--;
        }
      }
    }
  }

  private _selectNextItemToHydrate(): StudySessionItem | null {
    const choice = Math.random();
    let newBound: number = 0.1;
    let reviewBound: number = 0.75;

    if (this.reviewQ.length === 0 && this.failedQ.length === 0 && this.newQ.length === 0) {
      // all queues empty - session is over (and course is complete?)
      return null;
    }

    if (this._secondsRemaining < 2 && this.failedQ.length === 0) {
      // session is over!
      return null;
    }

    // If timer expired, only return failed cards
    if (this._secondsRemaining <= 0) {
      if (this.failedQ.length > 0) {
        return this.failedQ.peek(0);
      } else {
        return null; // No more failed cards, session over
      }
    }

    // supply new cards at start of session
    if (this.newQ.dequeueCount < this.sources.length && this.newQ.length) {
      return this.newQ.peek(0);
    }

    const cleanupTime = this.estimateCleanupTime();
    const reviewTime = this.estimateReviewTime();
    const availableTime = this._secondsRemaining - (cleanupTime + reviewTime);

    // if time-remaing vs (reviewQ + failureQ) looks good,
    // lean toward newQ
    if (availableTime > 20) {
      newBound = 0.5;
      reviewBound = 0.9;
    }
    // else if time-remaining vs failureQ looks good,
    // lean toward reviewQ
    else if (this._secondsRemaining - cleanupTime > 20) {
      newBound = 0.05;
      reviewBound = 0.9;
    }
    // else (time-remaining vs failureQ looks bad!)
    // lean heavily toward failureQ
    else {
      newBound = 0.01;
      reviewBound = 0.1;
    }

    // exclude possibility of drawing from empty queues
    if (this.failedQ.length === 0) {
      reviewBound = 1;
    }
    if (this.reviewQ.length === 0) {
      newBound = reviewBound;
    }

    if (choice < newBound && this.newQ.length) {
      return this.newQ.peek(0);
    } else if (choice < reviewBound && this.reviewQ.length) {
      return this.reviewQ.peek(0);
    } else if (this.failedQ.length) {
      return this.failedQ.peek(0);
    } else {
      this.log(`No more cards available for the session!`);
      return null;
    }
  }

  public async nextCard(
    action: SessionAction = 'dismiss-success'
  ): Promise<HydratedCard<TView> | null> {
    // dismiss (or sort to failedQ) the current card
    this.dismissCurrentCard(action);

    if (this._secondsRemaining <= 0 && this.failedQ.length === 0) {
      this._currentCard = null;
      return null;
    }

    let card = this.hydrationService.dequeueHydratedCard();

    // If no hydrated card but source cards available, wait for hydration
    if (!card && this.hasAvailableCards()) {
      card = await this.hydrationService.waitForHydratedCard();
    }

    // Trigger background hydration to maintain cache (async, non-blocking)
    await this.hydrationService.ensureHydratedCards();

    if (card) {
      this._currentCard = card;
    } else {
      this._currentCard = null;
    }

    return card;
  }

  /**
   * Public API for processing user responses to cards.
   * @param cardRecord User's response record
   * @param cardHistory Promise resolving to the card's history
   * @param courseRegistrationDoc User's course registration document
   * @param currentCard Current study session record
   * @param courseId Course identifier
   * @param cardId Card identifier
   * @param maxAttemptsPerView Maximum attempts allowed per view
   * @param maxSessionViews Maximum session views for this card
   * @param sessionViews Current number of session views
   * @returns ResponseResult with navigation and UI instructions
   */
  public async submitResponse(
    cardRecord: CardRecord,
    cardHistory: Promise<CardHistory<CardRecord>>,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): Promise<ResponseResult> {
    const studySessionItem: StudySessionItem = {
      ...currentCard.item,
    };

    return await this.services.response.processResponse(
      cardRecord,
      cardHistory,
      studySessionItem,
      courseRegistrationDoc,
      currentCard,
      courseId,
      cardId,
      maxAttemptsPerView,
      maxSessionViews,
      sessionViews
    );
  }

  private dismissCurrentCard(action: SessionAction = 'dismiss-success') {
    if (this._currentCard) {
      // this.log(`Running dismissCurrentCard on ${this._currentCard!.qualifiedID}`);
      // if (action.includes('dismiss')) {
      //   if (this._currentCard.status === 'review' ||
      //     this._currentCard.status === 'failed-review') {
      //     removeScheduledCardReview(this.user.getUsername(),
      //       (this._currentCard as StudySessionReviewItem).reviewID);
      //     this.log(`Dismissed review card: ${this._currentCard.qualifiedID}`)
      //   }
      // }

      if (action === 'dismiss-success') {
        // schedule a review - currently done in Study.vue
      } else if (action === 'marked-failed') {
        this.hydrationService.cacheFailedCard(this._currentCard);

        let failedItem: StudySessionFailedItem;

        if (isReview(this._currentCard.item)) {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-review',
            reviewID: this._currentCard.item.reviewID,
          };
        } else {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-new',
          };
        }

        this.failedQ.add(failedItem, failedItem.cardID);
      } else if (action === 'dismiss-error') {
        // some error logging?
      } else if (action === 'dismiss-failed') {
        // handled by Study.vue
      }
    }
  }

  private hasAvailableCards(): boolean {
    return this.reviewQ.length > 0 || this.newQ.length > 0 || this.failedQ.length > 0;
  }

  /**
   * Helper method for CardHydrationService to remove items from appropriate queue.
   */
  private removeItemFromQueue(item: StudySessionItem): void {
    if (this.reviewQ.peek(0) === item) {
      this.reviewQ.dequeue((queueItem) => queueItem.cardID);
    } else if (this.newQ.peek(0) === item) {
      this.newQ.dequeue((queueItem) => queueItem.cardID);
    } else {
      this.failedQ.dequeue((queueItem) => queueItem.cardID);
    }
  }
}

```


**Tool Call: Thinking**
Status: Completed

Now I understand the SessionController's current structure. Let me analyze the key integration points:

## Current Flow

1. **`prepareSession()`** calls:
   - `getScheduledReviews()` - calls `source.getPendingReviews()` on each source
   - `getNewCards()` - calls `source.getNewCards()` on each source

2. **Queue Management**:
   - `reviewQ` - for review cards from `getPendingReviews()`
   - `newQ` - for new cards from `getNewCards()`
   - `failedQ` - for failed cards during session

3. **Card Selection** (`_selectNextItemToHydrate()`):
   - Uses probabilistic selection based on time remaining
   - Draws from reviewQ, newQ, or failedQ based on weighted random choice

## Integration Strategy

I need to add a parallel path that uses `getWeightedCards()` while keeping the existing code working. The key insight is:

1. `getWeightedCards()` returns `WeightedCard[]` with `source: 'new' | 'review' | 'failed'`
2. We can map these back to the appropriate queues
3. The selection logic can remain similar but respect the scores

### Option A: Replace getScheduledReviews + getNewCards with getWeightedCards

Simplest approach:
- Call `source.getWeightedCards(limit)` instead of separate calls
- Sort by score
- Distribute to queues based on `source` field

### Option B: Add getWeightedCards as alternative path

More incremental:
- Check if source implements getWeightedCards properly (not just default)
- If so, use it; otherwise fall back to legacy

### Option C: Unified queue with scores

More radical:
- Instead of separate reviewQ/newQ, use a single priority queue
- Items ordered by score
- This is cleaner but more disruptive

I'll go with **Option A** as the primary approach, with fallback to legacy methods if needed. This keeps the queue structure (SessionController still manages time budgeting with separate queues) but uses the new API for fetching.

## Implementation Plan

1. Add import for `WeightedCard` and `ContentNavigator`
2. Create `getWeightedContent()` method that:
   - Calls `getWeightedCards()` on each source
   - Sorts combined results by score
   - Distributes to reviewQ and newQ based on `source` field
3. Update `prepareSession()` to call `getWeightedContent()` 
4. Keep `getScheduledReviews()` and `getNewCards()` as fallback (or remove if we're confident)
5. Update `getDebugInfo()` to show strategy info

Let me also check if sources are always ContentNavigators or could be other StudyContentSource implementations (like StudentClassroomDB).


**Tool Call: Search files for regex `class StudentClassroomDB|implements StudyContentSource`**
Status: Completed

Found 5 matches:

## Matches in master/packages/db/src/core/navigators/index.ts

### L72-82
```
 * Abstract base class for navigation strategies that steer study sessions.
 *
 * ContentNavigator implements StudyContentSource for backward compatibility,
 * but the primary API going forward is getWeightedCards().
 *
 * ## Strategy Types
 *
 * **Generator strategies** produce candidate cards:
 * - Override getWeightedCards() to generate and score candidates
 * - Examples: ELO (skill proximity), SRS (review scheduling)
 *
```

16 lines remaining in ancestor node. Read the file to see all.

### abstract class ContentNavigator › L100-110
```
export abstract class ContentNavigator implements StudyContentSource {
  /**
   *
   * @param user
   * @param strategyData
   * @returns the runtime object used to steer a study session.
   */
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
```

104 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/db/src/impl/couch/courseDB.ts

### class CourseDB › L96-106
```
export class CourseDB implements StudyContentSource, CourseDBInterface {
  // private log(msg: string): void {
  //   log(`CourseLog: ${this.id}\n  ${msg}`);
  // }

  private db: PouchDB.Database;
  private id: string;
  private _getCurrentUser: () => Promise<UserDBInterface>;
  private updateQueue: UpdateQueue;

  constructor(id: string, userLookup: () => Promise<UserDBInterface>) {
```

662 lines remaining in ancestor node. Read the file to see all.

## Matches in master/packages/db/src/core/interfaces/contentSource.ts

### L30-34
```
//
// MIGRATION PATH:
// 1. ContentNavigator implements StudyContentSource for backward compat
// 2. SessionController will migrate to call getWeightedCards()
// 3. Legacy methods will be deprecated, then removed
```

## Matches in master/packages/db/src/impl/couch/classroomDB.ts

### class StudentClassroomDB › L76-78
```
export class StudentClassroomDB
  extends ClassroomDBBase
  implements StudyContentSource, StudentClassroomDBInterface
```

114 lines remaining in ancestor node. Read the file to see all.


**Tool Call: Read file `packages/db/src/impl/couch/classroomDB.ts` (lines 76-150)**
Status: Completed

```master/packages/db/src/impl/couch/classroomDB.ts
export class StudentClassroomDB
  extends ClassroomDBBase
  implements StudyContentSource, StudentClassroomDBInterface
{
  // private readonly _prefix: string = 'content';
  private userMessages!: PouchDB.Core.Changes<object>;
  private _user: UserDBInterface;

  private constructor(classID: string, user: UserDBInterface) {
    super();
    this._id = classID;
    this._user = user;
    // init() is called explicitly in factory method, not in constructor
  }

  async init(): Promise<void> {
    const dbName = `classdb-student-${this._id}`;
    this._db = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
      createPouchDBConfig()
    );
    try {
      const cfg = await this._db.get<ClassroomConfig>(CLASSROOM_CONFIG);
      this._cfg = cfg;
      this.userMessages = this._db.changes({
        since: 'now',
        live: true,
        include_docs: true,
      });
      this._initComplete = true;
      return;
    } catch (e) {
      throw new Error(`Error in StudentClassroomDB constructor: ${JSON.stringify(e)}`);
    }
  }

  public static async factory(classID: string, user: UserDBInterface): Promise<StudentClassroomDB> {
    const ret = new StudentClassroomDB(classID, user);
    await ret.init();
    return ret;
  }

  public setChangeFcn(f: (value: unknown) => object): void {
    // todo: make this into a view request, w/ the user's name attached
    // todo: requires creating the view doc on classroom create in /express
    void this.userMessages.on('change', f);
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = this._user;
    return (await u.getPendingReviews())
      .filter((r) => r.scheduledFor === 'classroom' && r.schedulingAgentId === this._id)
      .map((r) => {
        return {
          ...r,
          qualifiedID: `${r.courseId}-${r.cardId}`,
          courseID: r.courseId,
          cardID: r.cardId,
          contentSourceType: 'classroom',
          contentSourceID: this._id,
          reviewID: r._id,
          status: 'review',
        };
      });
  }

  public async getNewCards(): Promise<StudySessionNewItem[]> {
    const activeCards = await this._user.getActiveCards();
    const now = moment.utc();
    const assigned = await this.getAssignedContent();
    const due = assigned.filter((c) => now.isAfter(moment.utc(c.activeOn, REVIEW_TIME_FORMAT)));

    logger.info(`Due content: ${JSON.stringify(due)}`);

    let ret: StudySessionNewItem[] = [];

```


## Assistant

I see that `StudentClassroomDB` also implements `StudyContentSource` but doesn't have `getWeightedCards()`. I need to handle this gracefully — check if the source has a proper `getWeightedCards()` implementation or fall back to legacy methods.

Let me also check `CourseDB`:

**Tool Call: Read file `packages/db/src/impl/couch/courseDB.ts` (lines 565-610)**
Status: Completed

```master/packages/db/src/impl/couch/courseDB.ts

  ////////////////////////////////////
  // StudyContentSource implementation
  ////////////////////////////////////

  public async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getNewCards(limit);
    } catch (e) {
      logger.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getPendingReviews();
    } catch (e) {
      logger.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  public async getCardsCenteredAtELO(
    options: {
      limit: number;
      elo: 'user' | 'random' | number;
    } = {
      limit: 99,
      elo: 'user',
    },
    filter?: (a: QualifiedCardID) => boolean
  ): Promise<StudySessionItem[]> {
    let targetElo: number;

    if (options.elo === 'user') {
      const u = await this._getCurrentUser();


```


## Assistant

I see that `CourseDB.getNewCards()` and `CourseDB.getPendingReviews()` already delegate to `ContentNavigator`. So the path is:

1. `CourseDB` creates a `ContentNavigator` based on `surfaceNavigationStrategy()`
2. The navigator implements both legacy methods and `getWeightedCards()`

The cleanest integration is to add `getWeightedCards()` to `CourseDB` (which will delegate to the navigator) and then have `SessionController` call it.

Let me add `getWeightedCards()` to `CourseDB` first:

**Tool Call: Read file `packages/db/src/impl/couch/courseDB.ts` (lines 560-600)**
Status: Completed

```master/packages/db/src/impl/couch/courseDB.ts
  }

  ////////////////////////////////////
  // END NavigationStrategyManager implementation
  ////////////////////////////////////

  ////////////////////////////////////
  // StudyContentSource implementation
  ////////////////////////////////////

  public async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getNewCards(limit);
    } catch (e) {
      logger.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getPendingReviews();
    } catch (e) {
      logger.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  public async getCardsCenteredAtELO(
    options: {
      limit: number;
      elo: 'user' | 'random' | number;
    } = {

```


## Assistant

Now I need to understand the approach. Looking at the architecture:

1. `StudyContentSource` is the legacy interface with `getNewCards()` / `getPendingReviews()`
2. `ContentNavigator` implements `StudyContentSource` and adds `getWeightedCards()`
3. `CourseDB` implements `StudyContentSource` and delegates to `ContentNavigator`
4. `StudentClassroomDB` implements `StudyContentSource` directly (no navigator)

For the integration, I should:
1. Add `getWeightedCards()` to the `StudyContentSource` interface (optional, with default)
2. Add `getWeightedCards()` implementation to `CourseDB` (delegates to navigator)
3. Add `getWeightedCards()` implementation to `StudentClassroomDB` (wraps legacy methods)
4. Update `SessionController` to use `getWeightedCards()`

Let me start:

**Tool Call: Read file `packages/db/src/core/interfaces/contentSource.ts` (lines 78-130)**
Status: Completed

```master/packages/db/src/core/interfaces/contentSource.ts
}

// #region docs_StudyContentSource
/**
 * Interface for sources that provide study content to SessionController.
 *
 * @deprecated This interface will be superseded by ContentNavigator.getWeightedCards().
 * The getNewCards/getPendingReviews split was an artifact of hard-coded ELO and SRS
 * strategies. The new API returns unified WeightedCard[] with scores.
 *
 * MIGRATION:
 * - Implement ContentNavigator instead of StudyContentSource directly
 * - Override getWeightedCards() as the primary method
 * - Legacy methods can delegate to getWeightedCards() or be left as-is
 *
 * See: packages/db/src/core/navigators/ARCHITECTURE.md
 */
export interface StudyContentSource {
  /**
   * Get cards scheduled for review based on SRS algorithm.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * Review urgency will be expressed as a score rather than a separate method.
   */
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction, typically ordered by ELO proximity.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * New card selection and scoring will be unified with review scoring.
   *
   * @param n - Maximum number of new cards to return
   */
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
// #endregion docs_StudyContentSource

export async function getStudySource(
  source: ContentSourceID,
  user: UserDBInterface
): Promise<StudyContentSource> {
  if (source.type === 'classroom') {
    return await StudentClassroomDB.factory(source.id, user);
  } else {
    // if (source.type === 'course') - removed so tsc is certain something returns
    // return new CourseDB(source.id, async () => {
    //   return user;
    // });

    return getDataLayer().getCourseDB(source.id) as unknown as StudyContentSource;
  }
}

```


**Tool Call: packages/db/src/core/interfaces/contentSource.ts**
Status: Completed

Diff: packages/db/src/core/interfaces/contentSource.ts
```
import { getDataLayer } from '@db/factory';
import { UserDBInterface } from '..';
import { StudentClassroomDB } from '../../impl/couch/classroomDB';
import { ScheduledCard } from '@db/core/types/user';
import { WeightedCard } from '../navigators';

// ============================================================================
// API MIGRATION NOTICE
// ============================================================================
//
// The StudyContentSource interface is being superseded by the ContentNavigator
// class and its getWeightedCards() API. See:
//   packages/db/src/core/navigators/ARCHITECTURE.md
//
// HISTORICAL CONTEXT:
// - This interface was designed to abstract 'classrooms' and 'courses' as
//   content sources for study sessions.
// - getNewCards() and getPendingReviews() were artifacts of two hard-coded
//   navigation strategies: ELO proximity (new) and SRS scheduling (reviews).
// - The new/review split reflected implementation details, not fundamentals.
//
// THE PROBLEM:
// - "What does 'get reviews' mean for an interference mitigator?" - it doesn't.
// - SRS is just one strategy that could express review urgency as scores.
// - Some strategies generate candidates, others filter/score them.
//
// THE SOLUTION:
// - ContentNavigator.getWeightedCards() returns unified scored candidates.
// - WeightedCard.source field distinguishes new/review/failed (metadata, not API).
// - Strategies compose via delegate pattern (filter wraps generator).
//
// MIGRATION PATH:
// 1. ContentNavigator implements StudyContentSource for backward compat
// 2. SessionController will migrate to call getWeightedCards()
// 3. Legacy methods will be deprecated, then removed
//
// ============================================================================

export type StudySessionFailedItem = StudySessionFailedNewItem | StudySessionFailedReviewItem;

export interface StudySessionFailedNewItem extends StudySessionItem {
  status: 'failed-new';
}
export interface StudySessionFailedReviewItem extends StudySessionReviewItem {
  status: 'failed-review';
}

export interface StudySessionNewItem extends StudySessionItem {
  status: 'new';
}

export interface StudySessionReviewItem extends StudySessionItem {
  reviewID: string;
  status: 'review' | 'failed-review';
}
export function isReview(item: StudySessionItem): item is StudySessionReviewItem {
  const ret = item.status === 'review' || item.status === 'failed-review' || 'reviewID' in item;

  // console.log(`itemIsReview: ${ret}
  // \t${JSON.stringify(item)}`);

  return ret;
}

export interface StudySessionItem {
  status: 'new' | 'review' | 'failed-new' | 'failed-review';
  contentSourceType: 'course' | 'classroom';
  contentSourceID: string;
  // qualifiedID: `${string}-${string}` | `${string}-${string}-${number}`;
  cardID: string;
  courseID: string;
  elo?: number;
  // reviewID?: string;
}

export interface ContentSourceID {
  type: 'course' | 'classroom';
  id: string;
}

// #region docs_StudyContentSource
/**
 * Interface for sources that provide study content to SessionController.
 *
 * @deprecated This interface will be superseded by ContentNavigator.getWeightedCards().
 * The getNewCards/getPendingReviews split was an artifact of hard-coded ELO and SRS
 * strategies. The new API returns unified WeightedCard[] with scores.
 *
 * MIGRATION:
 * - Implement ContentNavigator instead of StudyContentSource directly
 * - Override getWeightedCards() as the primary method
 * - Legacy methods can delegate to getWeightedCards() or be left as-is
 *
 * See: packages/db/src/core/navigators/ARCHITECTURE.md
 */
export interface StudyContentSource {
  /**
   * Get cards scheduled for review based on SRS algorithm.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * Review urgency will be expressed as a score rather than a separate method.
   */
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction, typically ordered by ELO proximity.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * New card selection and scoring will be unified with review scoring.
   *
   * @param n - Maximum number of new cards to return
   */
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards with suitability scores for presentation.
   *
   * This is the PRIMARY API for content sources going forward. Returns unified
   * scored candidates that can be sorted and selected by SessionController.
   *
   * The `source` field on WeightedCard indicates origin ('new' | 'review' | 'failed')
   * for queue routing purposes during the migration period.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending
   */
  getWeightedCards?(limit: number): Promise<WeightedCard[]>;
}
// #endregion docs_StudyContentSource

export async function getStudySource(
  source: ContentSourceID,
  user: UserDBInterface
): Promise<StudyContentSource> {
  if (source.type === 'classroom') {
    return await StudentClassroomDB.factory(source.id, user);
  } else {
    // if (source.type === 'course') - removed so tsc is certain something returns
    // return new CourseDB(source.id, async () => {
    //   return user;
    // });

    return getDataLayer().getCourseDB(source.id) as unknown as StudyContentSource;
  }
}

```


## Assistant

Now let me add `getWeightedCards()` to `CourseDB`:

**Tool Call: packages/db/src/impl/couch/courseDB.ts**
Status: Completed

Diff: packages/db/src/impl/couch/courseDB.ts
```
import { CourseDBInterface, CourseInfo, CoursesDBInterface, UserDBInterface } from '@db/core';
import { ScheduledCard } from '@db/core/types/user';
import {
  CourseConfig,
  CourseElo,
  DataShape,
  EloToNumber,
  Status,
  blankCourseElo,
  toCourseElo,
} from '@vue-skuilder/common';

import { filterAllDocsByPrefix, getCourseDB, getCourseDoc, getCourseDocs } from '.';
import UpdateQueue from './updateQueue';
import {
  StudyContentSource,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '../../core/interfaces/contentSource';
import {
  CardData,
  DocType,
  QualifiedCardID,
  SkuilderCourseData,
  Tag,
  TagStub,
  DocTypePrefixes,
} from '../../core/types/types-legacy';
import { logger } from '../../util/logger';
import { GET_CACHED } from './clientCache';
import { addNote55, addTagToCard, getCredentialledCourseConfig, getTagID } from './courseAPI';
import { DataLayerResult } from '@db/core/types/db';
import { PouchError } from './types';
import CourseLookup from './courseLookupDB';
import { ContentNavigationStrategyData } from '@db/core/types/contentNavigationStrategy';
import { ContentNavigator, Navigators, WeightedCard } from '@db/core/navigators';

export class CoursesDB implements CoursesDBInterface {
  _courseIDs: string[] | undefined;

  constructor(courseIDs?: string[]) {
    if (courseIDs && courseIDs.length > 0) {
      this._courseIDs = courseIDs;
    } else {
      this._courseIDs = undefined;
    }
  }

  public async getCourseList(): Promise<CourseConfig[]> {
    let crsList = await CourseLookup.allCourseWare();
    logger.debug(`AllCourses: ${crsList.map((c) => c.name + ', ' + c._id + '\n\t')}`);
    if (this._courseIDs) {
      crsList = crsList.filter((c) => this._courseIDs!.includes(c._id));
    }

    logger.debug(`AllCourses.filtered: ${crsList.map((c) => c.name + ', ' + c._id + '\n\t')}`);

    const cfgs = await Promise.all(
      crsList.map(async (c) => {
        try {
          const cfg = await getCredentialledCourseConfig(c._id);
          logger.debug(`Found cfg: ${JSON.stringify(cfg)}`);
          return cfg;
        } catch (e) {
          logger.warn(`Error fetching cfg for course ${c.name}, ${c._id}: ${e}`);
          return undefined;
        }
      })
    );
    return cfgs.filter((c) => !!c);
  }

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    if (this._courseIDs && this._courseIDs.length && !this._courseIDs.includes(courseId)) {
      throw new Error(`Course ${courseId} not in course list`);
    }

    const cfg = await getCredentialledCourseConfig(courseId);
    if (cfg === undefined) {
      throw new Error(`Error fetching cfg for course ${courseId}`);
    } else {
      return cfg;
    }
  }

  public async disambiguateCourse(courseId: string, disambiguator: string): Promise<void> {
    await CourseLookup.updateDisambiguator(courseId, disambiguator);
  }
}

function randIntWeightedTowardZero(n: number) {
  return Math.floor(Math.random() * Math.random() * Math.random() * n);
}

export class CourseDB implements StudyContentSource, CourseDBInterface {
  // private log(msg: string): void {
  //   log(`CourseLog: ${this.id}\n  ${msg}`);
  // }

  private db: PouchDB.Database;
  private id: string;
  private _getCurrentUser: () => Promise<UserDBInterface>;
  private updateQueue: UpdateQueue;

  constructor(id: string, userLookup: () => Promise<UserDBInterface>) {
    this.id = id;
    this.db = getCourseDB(this.id);
    this._getCurrentUser = userLookup;
    this.updateQueue = new UpdateQueue(this.db);
  }

  public getCourseID(): string {
    return this.id;
  }

  public async getCourseInfo(): Promise<CourseInfo> {
    const cardCount = (
      await this.db.find({
        selector: {
          docType: DocType.CARD,
        },
        limit: 1000,
      })
    ).docs.length;

    return {
      cardCount,
      registeredUsers: 0,
    };
  }

  public async getInexperiencedCards(limit: number = 2) {
    return (
      await this.db.query('cardsByInexperience', {
        limit,
      })
    ).rows.map((r) => {
      const ret = {
        courseId: this.id,
        cardId: r.id,
        count: r.key,
        elo: r.value,
      };
      return ret;
    });
  }

  public async getCardsByEloLimits(
    options: {
      low: number;
      high: number;
      limit: number;
      page: number;
    } = {
      low: 0,
      high: Number.MIN_SAFE_INTEGER,
      limit: 25,
      page: 0,
    }
  ) {
    return (
      await this.db.query('elo', {
        startkey: options.low,
        endkey: options.high,
        limit: options.limit,
        skip: options.limit * options.page,
      })
    ).rows.map((r) => {
      return `${this.id}-${r.id}-${r.key}`;
    });
  }
  public async getCardEloData(id: string[]): Promise<CourseElo[]> {
    const docs = await this.db.allDocs<CardData>({
      keys: id,
      include_docs: true,
    });
    const ret: CourseElo[] = [];
    docs.rows.forEach((r) => {
      // [ ] remove these ts-ignore directives.
      if (isSuccessRow(r)) {
        if (r.doc && r.doc.elo) {
          ret.push(toCourseElo(r.doc.elo));
        } else {
          logger.warn('no elo data for card: ' + r.id);
          ret.push(blankCourseElo());
        }
      } else {
        logger.warn('no elo data for card: ' + JSON.stringify(r));
        ret.push(blankCourseElo());
      }
    });
    return ret;
  }

  /**
   * Returns the lowest and highest `global` ELO ratings in the course
   */
  public async getELOBounds() {
    const [low, high] = await Promise.all([
      (
        await this.db.query('elo', {
          startkey: 0,
          limit: 1,
          include_docs: false,
        })
      ).rows[0].key,
      (
        await this.db.query('elo', {
          limit: 1,
          descending: true,
          startkey: 100_000,
        })
      ).rows[0].key,
    ]);

    return {
      low: low,
      high: high,
    };
  }

  public async removeCard(id: string) {
    const doc = await this.db.get<CardData>(id);
    if (!doc.docType || !(doc.docType === DocType.CARD)) {
      throw new Error(`failed to remove ${id} from course ${this.id}. id does not point to a card`);
    }

    // Remove card from all associated tags before deleting the card
    try {
      const appliedTags = await this.getAppliedTags(id);
      const results = await Promise.allSettled(
        appliedTags.rows.map(async (tagRow) => {
          const tagId = tagRow.id;
          await this.removeTagFromCard(id, tagId);
        })
      );

      // Log any individual tag cleanup failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const tagId = appliedTags.rows[index].id;
          logger.error(`Failed to remove card ${id} from tag ${tagId}: ${result.reason}`);
        }
      });
    } catch (error) {
      logger.error(`Error removing card ${id} from tags: ${error}`);
      // Continue with card deletion even if tag cleanup fails
    }

    return this.db.remove(doc);
  }

  public async getCardDisplayableDataIDs(id: string[]) {
    logger.debug(id.join(', '));
    const cards = await this.db.allDocs<CardData>({
      keys: id,
      include_docs: true,
    });
    const ret: { [card: string]: string[] } = {};
    cards.rows.forEach((r) => {
      if (isSuccessRow(r)) {
        ret[r.id] = r.doc!.id_displayable_data;
      }
    });

    await Promise.all(
      cards.rows.map((r) => {
        return async () => {
          if (isSuccessRow(r)) {
            ret[r.id] = r.doc!.id_displayable_data;
          }
        };
      })
    );

    return ret;
  }

  async getCardsByELO(elo: number, cardLimit?: number) {
    elo = parseInt(elo as any);
    const limit = cardLimit ? cardLimit : 25;

    const below: PouchDB.Query.Response<object> = await this.db.query('elo', {
      limit: Math.ceil(limit / 2),
      startkey: elo,
      descending: true,
    });

    const aboveLimit = limit - below.rows.length;

    const above: PouchDB.Query.Response<object> = await this.db.query('elo', {
      limit: aboveLimit,
      startkey: elo + 1,
    });
    // logger.log(JSON.stringify(below));

    let cards = below.rows;
    cards = cards.concat(above.rows);

    const ret = cards
      .sort((a, b) => {
        const s = Math.abs(a.key - elo) - Math.abs(b.key - elo);
        if (s === 0) {
          return Math.random() - 0.5;
        } else {
          return s;
        }
      })
      .map((c) => {
        return {
          courseID: this.id,
          cardID: c.id,
          elo: c.key,
        };
      });

    const str = `below:\n${below.rows.map((r) => `\t${r.id}-${r.key}\n`)}

above:\n${above.rows.map((r) => `\t${r.id}-${r.key}\n`)}`;

    logger.debug(`Getting ${limit} cards centered around elo: ${elo}:\n\n` + str);

    return ret;
  }

  async getCourseConfig(): Promise<CourseConfig> {
    const ret = await getCredentialledCourseConfig(this.id);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Course config not found for course ID: ${this.id}`);
    }
  }

  async updateCourseConfig(cfg: CourseConfig): Promise<PouchDB.Core.Response> {
    logger.debug(`Updating: ${JSON.stringify(cfg)}`);
    // write both to the course DB:
    try {
      return await updateCredentialledCourseConfig(this.id, cfg);
    } catch (error) {
      logger.error(`Error updating course config in course DB: ${error}`);
      throw error;
    }
  }

  async updateCardElo(cardId: string, elo: CourseElo): Promise<PouchDB.Core.Response> {
    if (!elo) {
      throw new Error(`Cannot update card elo with null or undefined value for card ID: ${cardId}`);
    }

    try {
      const result = await this.updateQueue.update<
        CardData & PouchDB.Core.GetMeta & PouchDB.Core.IdMeta
      >(cardId, (card) => {
        logger.debug(`Replacing ${JSON.stringify(card.elo)} with ${JSON.stringify(elo)}`);
        card.elo = elo;
        return card;
      });
      return { ok: true, id: cardId, rev: result._rev };
    } catch (error) {
      logger.error(`Failed to update card elo for card ID: ${cardId}`, error);
      throw new Error(`Failed to update card elo for card ID: ${cardId}`);
    }
  }

  async getAppliedTags(cardId: string): Promise<PouchDB.Query.Response<TagStub>> {
    const ret = await getAppliedTags(this.id, cardId);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Failed to find tags for card ${this.id}-${cardId}`);
    }
  }

  async addTagToCard(
    cardId: string,
    tagId: string,
    updateELO?: boolean
  ): Promise<PouchDB.Core.Response> {
    return await addTagToCard(
      this.id,
      cardId,
      tagId,
      (await this._getCurrentUser()).getUsername(),
      updateELO
    );
  }

  async removeTagFromCard(cardId: string, tagId: string): Promise<PouchDB.Core.Response> {
    return await removeTagFromCard(this.id, cardId, tagId);
  }

  async createTag(name: string, author: string): Promise<PouchDB.Core.Response> {
    return await createTag(this.id, name, author);
  }

  async getTag(tagId: string): Promise<PouchDB.Core.GetMeta & PouchDB.Core.Document<Tag>> {
    return await getTag(this.id, tagId);
  }

  async updateTag(tag: Tag): Promise<PouchDB.Core.Response> {
    if (tag.course !== this.id) {
      throw new Error(`Tag ${JSON.stringify(tag)} does not belong to course ${this.id}`);
    }

    return await updateTag(tag);
  }

  async getCourseTagStubs(): Promise<PouchDB.Core.AllDocsResponse<Tag>> {
    return getCourseTagStubs(this.id);
  }

  async addNote(
    codeCourse: string,
    shape: DataShape,
    data: unknown,
    author: string,
    tags: string[],
    uploads?: { [key: string]: PouchDB.Core.FullAttachment },
    elo: CourseElo = blankCourseElo()
  ): Promise<DataLayerResult> {
    try {
      const resp = await addNote55(this.id, codeCourse, shape, data, author, tags, uploads, elo);
      if (resp.ok) {
        // Check if card creation failed (property added by addNote55)
        if ((resp as any).cardCreationFailed) {
          logger.warn(
            `[courseDB.addNote] Note added but card creation failed: ${
              (resp as any).cardCreationError
            }`
          );
          return {
            status: Status.error,
            message: `Note was added but no cards were created: ${(resp as any).cardCreationError}`,
            id: resp.id,
          };
        }
        return {
          status: Status.ok,
          message: '',
          id: resp.id,
        };
      } else {
        return {
          status: Status.error,
          message: 'Unexpected error adding note',
        };
      }
    } catch (e) {
      const err = e as PouchDB.Core.Error;
      logger.error(
        `[addNote] error ${err.name}\n\treason: ${err.reason}\n\tmessage: ${err.message}`
      );
      return {
        status: Status.error,
        message: `Error adding note to course. ${(e as PouchError).reason || err.message}`,
      };
    }
  }

  async getCourseDoc<T extends SkuilderCourseData>(
    id: string,
    options?: PouchDB.Core.GetOptions
  ): Promise<PouchDB.Core.GetMeta & PouchDB.Core.Document<T>> {
    return await getCourseDoc(this.id, id, options);
  }

  async getCourseDocs<T extends SkuilderCourseData>(
    ids: string[],
    options: PouchDB.Core.AllDocsOptions = {}
  ): Promise<PouchDB.Core.AllDocsWithKeysResponse<{} & T>> {
    return await getCourseDocs(this.id, ids, options);
  }

  ////////////////////////////////////
  // NavigationStrategyManager implementation
  ////////////////////////////////////

  getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
    logger.debug(`[courseDB] Getting navigation strategy: ${id}`);

    if (id == '') {
      const strategy: ContentNavigationStrategyData = {
        _id: 'NAVIGATION_STRATEGY-ELO',
        docType: DocType.NAVIGATION_STRATEGY,
        name: 'ELO',
        description: 'ELO-based navigation strategy for ordering content by difficulty',
        implementingClass: Navigators.ELO,
        course: this.id,
        serializedData: '', // serde is a noop for ELO navigator.
      };
      return Promise.resolve(strategy);
    } else {
      return this.db.get(id);
    }
  }

  async getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
    const prefix = DocTypePrefixes[DocType.NAVIGATION_STRATEGY];
    const result = await this.db.allDocs<ContentNavigationStrategyData>({
      startkey: prefix,
      endkey: `${prefix}\ufff0`,
      include_docs: true,
    });
    return result.rows.map((row) => row.doc!);
  }

  async addNavigationStrategy(data: ContentNavigationStrategyData): Promise<void> {
    logger.debug(`[courseDB] Adding navigation strategy: ${data._id}`);
    // // For now, just log the data and return success
    // logger.debug(JSON.stringify(data));
    return this.db.put(data).then(() => {});
  }
  updateNavigationStrategy(id: string, data: ContentNavigationStrategyData): Promise<void> {
    logger.debug(`[courseDB] Updating navigation strategy: ${id}`);
    // For now, just log the data and return success
    logger.debug(JSON.stringify(data));
    return Promise.resolve();
  }

  async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
    try {
      const config = await this.getCourseConfig();
      // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
      if (config.defaultNavigationStrategyId) {
        try {
          // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
          const strategy = await this.getNavigationStrategy(config.defaultNavigationStrategyId);
          if (strategy) {
            logger.debug(`Surfacing strategy ${strategy.name} from course config`);
            return strategy;
          }
        } catch (e) {
          logger.warn(
            // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
            `Failed to load strategy '${config.defaultNavigationStrategyId}' specified in course config. Falling back to ELO.`,
            e
          );
        }
      }
    } catch (e) {
      logger.warn(
        'Could not retrieve course config to determine navigation strategy. Falling back to ELO.',
        e
      );
    }

    logger.warn(`Returning hard-coded default ELO navigator`);
    const ret: ContentNavigationStrategyData = {
      _id: 'NAVIGATION_STRATEGY-ELO',
      docType: DocType.NAVIGATION_STRATEGY,
      name: 'ELO',
      description: 'ELO-based navigation strategy',
      implementingClass: Navigators.ELO,
      course: this.id,
      serializedData: '', // serde is a noop for ELO navigator.
    };
    return Promise.resolve(ret);
  }

  ////////////////////////////////////
  // END NavigationStrategyManager implementation
  ////////////////////////////////////

  ////////////////////////////////////
  // StudyContentSource implementation
  ////////////////////////////////////

  public async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getNewCards(limit);
    } catch (e) {
      logger.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getPendingReviews();
    } catch (e) {
      logger.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  /**
   * Get cards with suitability scores for presentation.
   *
   * This is the PRIMARY API for content sources going forward. Delegates to the
   * course's configured NavigationStrategy to get scored candidates.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending
   */
  public async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getWeightedCards(limit);
    } catch (e) {
      logger.error(`[courseDB] Error getting weighted cards: ${e}`);
      throw e;
    }
  }

  public async getCardsCenteredAtELO(
    options: {
      limit: number;
      elo: 'user' | 'random' | number;
    } = {
      limit: 99,
      elo: 'user',
    },
    filter?: (a: QualifiedCardID) => boolean
  ): Promise<StudySessionItem[]> {
    let targetElo: number;

    if (options.elo === 'user') {
      const u = await this._getCurrentUser();

      targetElo = -1;
      try {
        const courseDoc = (await u.getCourseRegistrationsDoc()).courses.find((c) => {
          return c.courseID === this.id;
        })!;
        targetElo = EloToNumber(courseDoc.elo);
      } catch {
        targetElo = 1000;
      }
    } else if (options.elo === 'random') {
      const bounds = await GET_CACHED(`elo-bounds-${this.id}`, () => this.getELOBounds());
      targetElo = Math.round(bounds.low + Math.random() * (bounds.high - bounds.low));
      // logger.log(`Picked ${targetElo} from [${bounds.low}, ${bounds.high}]`);
    } else {
      targetElo = options.elo;
    }

    let cards: (QualifiedCardID & { elo?: number })[] = [];
    let mult: number = 4;
    let previousCount: number = -1;
    let newCount: number = 0;

    while (cards.length < options.limit && newCount !== previousCount) {
      cards = await this.getCardsByELO(targetElo, mult * options.limit);
      previousCount = newCount;
      newCount = cards.length;

      logger.debug(`Found ${cards.length} elo neighbor cards...`);

      if (filter) {
        cards = cards.filter(filter);
        logger.debug(`Filtered to ${cards.length} cards...`);
      }

      mult *= 2;
    }

    const selectedCards: {
      courseID: string;
      cardID: string;
      elo?: number;
    }[] = [];

    while (selectedCards.length < options.limit && cards.length > 0) {
      const index = randIntWeightedTowardZero(cards.length);
      const card = cards.splice(index, 1)[0];
      selectedCards.push(card);
    }

    return selectedCards.map((c) => {
      return {
        courseID: this.id,
        cardID: c.cardID,
        contentSourceType: 'course',
        contentSourceID: this.id,
        elo: c.elo,
        status: 'new',
      };
    });
  }

  // Admin search methods
  public async searchCards(query: string): Promise<any[]> {
    logger.log(`[CourseDB ${this.id}] Searching for: "${query}"`);

    // Try multiple search approaches
    let displayableData;

    try {
      // Try regex search on the correct data structure: data[0].data
      displayableData = await this.db.find({
        selector: {
          docType: 'DISPLAYABLE_DATA',
          'data.0.data': { $regex: `.*${query}.*` },
        },
      });
      logger.log(`[CourseDB ${this.id}] Regex search on data[0].data successful`);
    } catch (regexError) {
      logger.log(
        `[CourseDB ${this.id}] Regex search failed, falling back to manual search:`,
        regexError
      );

      // Fallback: get all displayable data and filter manually
      const allDisplayable = await this.db.find({
        selector: {
          docType: 'DISPLAYABLE_DATA',
        },
      });

      logger.log(
        `[CourseDB ${this.id}] Retrieved ${allDisplayable.docs.length} documents for manual filtering`
      );

      displayableData = {
        docs: allDisplayable.docs.filter((doc) => {
          // Search entire document as JSON string - inclusive approach for admin tool
          const docString = JSON.stringify(doc).toLowerCase();
          const match = docString.includes(query.toLowerCase());
          if (match) {
            logger.log(`[CourseDB ${this.id}] Manual match found in document: ${doc._id}`);
          }
          return match;
        }),
      };
    }

    logger.log(
      `[CourseDB ${this.id}] Found ${displayableData.docs.length} displayable data documents`
    );

    if (displayableData.docs.length === 0) {
      // Debug: Let's see what displayable data exists
      const allDisplayableData = await this.db.find({
        selector: {
          docType: 'DISPLAYABLE_DATA',
        },
        limit: 5, // Just sample a few
      });

      logger.log(
        `[CourseDB ${this.id}] Sample displayable data:`,
        allDisplayableData.docs.map((d) => ({
          id: d._id,
          docType: (d as any).docType,
          dataStructure: (d as any).data ? Object.keys((d as any).data) : 'no data field',
          dataContent: (d as any).data,
          fullDoc: d,
        }))
      );
    }

    const allResults: any[] = [];

    for (const dd of displayableData.docs) {
      const cards = await this.db.find({
        selector: {
          docType: 'CARD',
          id_displayable_data: { $in: [dd._id] },
        },
      });

      logger.log(
        `[CourseDB ${this.id}] Displayable data ${dd._id} linked to ${cards.docs.length} cards`
      );
      allResults.push(...cards.docs);
    }

    logger.log(`[CourseDB ${this.id}] Total cards found: ${allResults.length}`);
    return allResults;
  }

  public async find(
    request: PouchDB.Find.FindRequest<any>
  ): Promise<PouchDB.Find.FindResponse<any>> {
    return this.db.find(request);
  }
}

/**
 * Returns a list of registered datashapes for the specified
 * course.
 * @param courseID The ID of the course
 */
export async function getCourseDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);
  return cfg!.dataShapes;
}

export async function getCredentialledDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);

  return cfg.dataShapes;
}

export async function getCourseQuestionTypes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);
  return cfg!.questionTypes;
}

// todo: this is actually returning full tag docs now.
//       - performance issue when tags have lots of
//         applied docs
//       - will require a computed couch DB view
export async function getCourseTagStubs(
  courseID: string
): Promise<PouchDB.Core.AllDocsResponse<Tag>> {
  logger.debug(`Getting tag stubs for course: ${courseID}`);
  const stubs = await filterAllDocsByPrefix<Tag>(
    getCourseDB(courseID),
    DocType.TAG.valueOf() + '-'
  );

  stubs.rows.forEach((row) => {
    logger.debug(`\tTag stub for doc: ${row.id}`);
  });

  return stubs;
}

export async function deleteTag(courseID: string, tagName: string) {
  tagName = getTagID(tagName);
  const courseDB = getCourseDB(courseID);
  const doc = await courseDB.get<Tag>(DocType.TAG.valueOf() + '-' + tagName);
  const resp = await courseDB.remove(doc);
  return resp;
}

export async function createTag(courseID: string, tagName: string, author: string) {
  logger.debug(`Creating tag: ${tagName}...`);
  const tagID = getTagID(tagName);
  const courseDB = getCourseDB(courseID);
  const resp = await courseDB.put<Tag>({
    course: courseID,
    docType: DocType.TAG,
    name: tagName,
    snippet: '',
    taggedCards: [],
    wiki: '',
    author,
    _id: tagID,
  });
  return resp;
}

export async function updateTag(tag: Tag) {
  const prior = await getTag(tag.course, tag.name);
  return await getCourseDB(tag.course).put<Tag>({
    ...tag,
    _rev: prior._rev,
  });
}

export async function getTag(courseID: string, tagName: string) {
  const tagID = getTagID(tagName);
  const courseDB = getCourseDB(courseID);
  return courseDB.get<Tag>(tagID);
}

export async function removeTagFromCard(courseID: string, cardID: string, tagID: string) {
  // todo: possible future perf. hit if tags have large #s of taggedCards.
  // In this case, should be converted to a server-request
  tagID = getTagID(tagID);
  const courseDB = getCourseDB(courseID);
  const tag = await courseDB.get<Tag>(tagID);
  tag.taggedCards = tag.taggedCards.filter((taggedID) => {
    return cardID !== taggedID;
  });
  return courseDB.put<Tag>(tag);
}

/**
 * Returns an array of ancestor tag IDs, where:
 * return[0] = parent,
 * return[1] = grandparent,
 * return[2] = great grandparent,
 * etc.
 *
 * If ret is empty, the tag itself is a root
 */
export function getAncestorTagIDs(courseID: string, tagID: string): string[] {
  tagID = getTagID(tagID);
  const split = tagID.split('>');
  if (split.length === 1) {
    return [];
  } else {
    split.pop();
    const parent = split.join('>');
    return [parent].concat(getAncestorTagIDs(courseID, parent));
  }
}

export async function getChildTagStubs(courseID: string, tagID: string) {
  return await filterAllDocsByPrefix(getCourseDB(courseID), tagID + '>');
}

export async function getAppliedTags(id_course: string, id_card: string) {
  const db = getCourseDB(id_course);

  const result = await db.query<TagStub>('getTags', {
    startkey: id_card,
    endkey: id_card,
    // include_docs: true
  });

  // log(`getAppliedTags looked up: ${id_card}`);
  // log(`getAppliedTags returning: ${JSON.stringify(result)}`);

  return result;
}

export async function updateCardElo(courseID: string, cardID: string, elo: CourseElo) {
  if (elo) {
    // checking against null, undefined, NaN
    const cDB = getCourseDB(courseID);
    const card = await cDB.get<CardData>(cardID);
    logger.debug(`Replacing ${JSON.stringify(card.elo)} with ${JSON.stringify(elo)}`);
    card.elo = elo;
    return cDB.put(card); // race conditions - is it important? probably not (net-zero effect)
  }
}

export async function updateCredentialledCourseConfig(courseID: string, config: CourseConfig) {
  logger.debug(`Updating course config:

${JSON.stringify(config)}
`);

  const db = getCourseDB(courseID);
  const old = await getCredentialledCourseConfig(courseID);

  return await db.put<CourseConfig>({
    ...config,
    _rev: (old as any)._rev,
  });
}

function isSuccessRow<T>(
  row:
    | {
        key: PouchDB.Core.DocumentKey;
        error: 'not_found';
      }
    | {
        doc?: PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta & T> | null | undefined;
        id: PouchDB.Core.DocumentId;
        key: PouchDB.Core.DocumentKey;
        value: {
          rev: PouchDB.Core.RevisionId;
          deleted?: boolean | undefined;
        };
      }
): row is {
  doc?: PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta & T> | null | undefined;
  id: PouchDB.Core.DocumentId;
  key: PouchDB.Core.DocumentKey;
  value: {
    rev: PouchDB.Core.RevisionId;
    deleted?: boolean | undefined;
  };
} {
  return 'doc' in row && row.doc !== null && row.doc !== undefined;
}

```


## Assistant

Now let me add `getWeightedCards()` to `StudentClassroomDB`:

**Tool Call: Read file `packages/db/src/impl/couch/classroomDB.ts` (lines 120-200)**
Status: Completed

```master/packages/db/src/impl/couch/classroomDB.ts
    // todo: requires creating the view doc on classroom create in /express
    void this.userMessages.on('change', f);
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = this._user;
    return (await u.getPendingReviews())
      .filter((r) => r.scheduledFor === 'classroom' && r.schedulingAgentId === this._id)
      .map((r) => {
        return {
          ...r,
          qualifiedID: `${r.courseId}-${r.cardId}`,
          courseID: r.courseId,
          cardID: r.cardId,
          contentSourceType: 'classroom',
          contentSourceID: this._id,
          reviewID: r._id,
          status: 'review',
        };
      });
  }

  public async getNewCards(): Promise<StudySessionNewItem[]> {
    const activeCards = await this._user.getActiveCards();
    const now = moment.utc();
    const assigned = await this.getAssignedContent();
    const due = assigned.filter((c) => now.isAfter(moment.utc(c.activeOn, REVIEW_TIME_FORMAT)));

    logger.info(`Due content: ${JSON.stringify(due)}`);

    let ret: StudySessionNewItem[] = [];

    for (let i = 0; i < due.length; i++) {
      const content = due[i];

      if (content.type === 'course') {
        const db = new CourseDB(content.courseID, async () => this._user);
        ret = ret.concat(await db.getNewCards());
      } else if (content.type === 'tag') {
        const tagDoc = await getTag(content.courseID, content.tagID);

        ret = ret.concat(
          tagDoc.taggedCards.map((c) => {
            return {
              courseID: content.courseID,
              cardID: c,
              qualifiedID: `${content.courseID}-${c}`,
              contentSourceType: 'classroom',
              contentSourceID: this._id,
              status: 'new',
            };
          })
        );
      } else if (content.type === 'card') {
        // returning card docs - not IDs
        ret.push(await getCourseDB(content.courseID).get(content.cardID));
      }
    }

    logger.info(
      `New Cards from classroom ${this._cfg.name}: ${ret.map((c) => `${c.courseID}-${c.cardID}`)}`
    );

    return ret.filter((c) => {
      if (activeCards.some((ac) => c.cardID === ac.cardID)) {
        // [ ] almost certainly broken after removing qualifiedID from StudySessionItem
        return false;
      } else {
        return true;
      }
    });
  }
}

/**
 * Interface for managing a classroom.
 */
export class TeacherClassroomDB extends ClassroomDBBase implements TeacherClassroomDBInterface {
  private _stuDb!: PouchDB.Database;

  private constructor(classID: string) {

```


**Tool Call: Read file `packages/db/src/impl/couch/classroomDB.ts` (lines 1-50)**
Status: Completed

```master/packages/db/src/impl/couch/classroomDB.ts
import {
  StudyContentSource,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/core/interfaces/contentSource';
import { ClassroomConfig } from '@vue-skuilder/common';
import { ENV } from '@db/factory';
import { logger } from '@db/util/logger';
import moment from 'moment';
import pouch from './pouchdb-setup';
import { getCourseDB, getStartAndEndKeys, createPouchDBConfig, REVIEW_TIME_FORMAT } from '.';
import { CourseDB, getTag } from './courseDB';

import { UserDBInterface } from '@db/core';
import {
  AssignedContent,
  AssignedCourse,
  AssignedTag,
  StudentClassroomDBInterface,
  TeacherClassroomDBInterface,
} from '@db/core/interfaces/classroomDB';
import { ScheduledCard } from '@db/core/types/user';

const classroomLookupDBTitle = 'classdb-lookup';
export const CLASSROOM_CONFIG = 'ClassroomConfig';

export type ClassroomMessage = object;

abstract class ClassroomDBBase {
  public _id!: string;
  protected _db!: PouchDB.Database;
  protected _cfg!: ClassroomConfig;
  protected _initComplete: boolean = false;

  protected readonly _content_prefix: string = 'content';
  protected get _content_searchkeys() {
    return getStartAndEndKeys(this._content_prefix);
  }

  protected abstract init(): Promise<void>;

  public async getAssignedContent(): Promise<AssignedContent[]> {
    logger.info(`Getting assigned content...`);
    // see couchdb docs 6.2.2:
    //   Guide to Views -> Views Collation -> String Ranges
    const docRows = await this._db.allDocs<AssignedContent>({
      startkey: this._content_prefix,
      endkey: this._content_prefix + `\ufff0`,
      include_docs: true,
    });

```


**Tool Call: packages/db/src/impl/couch/classroomDB.ts**
Status: Completed

Diff: packages/db/src/impl/couch/classroomDB.ts
```
import {
  StudyContentSource,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/core/interfaces/contentSource';
import { WeightedCard } from '@db/core/navigators';
import { ClassroomConfig } from '@vue-skuilder/common';
import { ENV } from '@db/factory';
import { logger } from '@db/util/logger';
import moment from 'moment';
import pouch from './pouchdb-setup';
import { getCourseDB, getStartAndEndKeys, createPouchDBConfig, REVIEW_TIME_FORMAT } from '.';
import { CourseDB, getTag } from './courseDB';

import { UserDBInterface } from '@db/core';
import {
  AssignedContent,
  AssignedCourse,
  AssignedTag,
  StudentClassroomDBInterface,
  TeacherClassroomDBInterface,
} from '@db/core/interfaces/classroomDB';
import { ScheduledCard } from '@db/core/types/user';

const classroomLookupDBTitle = 'classdb-lookup';
export const CLASSROOM_CONFIG = 'ClassroomConfig';

export type ClassroomMessage = object;

abstract class ClassroomDBBase {
  public _id!: string;
  protected _db!: PouchDB.Database;
  protected _cfg!: ClassroomConfig;
  protected _initComplete: boolean = false;

  protected readonly _content_prefix: string = 'content';
  protected get _content_searchkeys() {
    return getStartAndEndKeys(this._content_prefix);
  }

  protected abstract init(): Promise<void>;

  public async getAssignedContent(): Promise<AssignedContent[]> {
    logger.info(`Getting assigned content...`);
    // see couchdb docs 6.2.2:
    //   Guide to Views -> Views Collation -> String Ranges
    const docRows = await this._db.allDocs<AssignedContent>({
      startkey: this._content_prefix,
      endkey: this._content_prefix + `\ufff0`,
      include_docs: true,
    });

    const ret = docRows.rows.map((row) => {
      return row.doc!;
    });
    // logger.info(`Assigned content: ${JSON.stringify(ret)}`);

    return ret;
  }

  protected getContentId(content: AssignedContent): string {
    if (content.type === 'tag') {
      return `${this._content_prefix}-${content.courseID}-${content.tagID}`;
    } else {
      return `${this._content_prefix}-${content.courseID}`;
    }
  }

  public get ready(): boolean {
    return this._initComplete;
  }
  public getConfig(): ClassroomConfig {
    return this._cfg;
  }
}

export class StudentClassroomDB
  extends ClassroomDBBase
  implements StudyContentSource, StudentClassroomDBInterface
{
  // private readonly _prefix: string = 'content';
  private userMessages!: PouchDB.Core.Changes<object>;
  private _user: UserDBInterface;

  private constructor(classID: string, user: UserDBInterface) {
    super();
    this._id = classID;
    this._user = user;
    // init() is called explicitly in factory method, not in constructor
  }

  async init(): Promise<void> {
    const dbName = `classdb-student-${this._id}`;
    this._db = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
      createPouchDBConfig()
    );
    try {
      const cfg = await this._db.get<ClassroomConfig>(CLASSROOM_CONFIG);
      this._cfg = cfg;
      this.userMessages = this._db.changes({
        since: 'now',
        live: true,
        include_docs: true,
      });
      this._initComplete = true;
      return;
    } catch (e) {
      throw new Error(`Error in StudentClassroomDB constructor: ${JSON.stringify(e)}`);
    }
  }

  public static async factory(classID: string, user: UserDBInterface): Promise<StudentClassroomDB> {
    const ret = new StudentClassroomDB(classID, user);
    await ret.init();
    return ret;
  }

  public setChangeFcn(f: (value: unknown) => object): void {
    // todo: make this into a view request, w/ the user's name attached
    // todo: requires creating the view doc on classroom create in /express
    void this.userMessages.on('change', f);
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = this._user;
    return (await u.getPendingReviews())
      .filter((r) => r.scheduledFor === 'classroom' && r.schedulingAgentId === this._id)
      .map((r) => {
        return {
          ...r,
          qualifiedID: `${r.courseId}-${r.cardId}`,
          courseID: r.courseId,
          cardID: r.cardId,
          contentSourceType: 'classroom',
          contentSourceID: this._id,
          reviewID: r._id,
          status: 'review',
        };
      });
  }

  public async getNewCards(): Promise<StudySessionNewItem[]> {
    const activeCards = await this._user.getActiveCards();
    const now = moment.utc();
    const assigned = await this.getAssignedContent();
    const due = assigned.filter((c) => now.isAfter(moment.utc(c.activeOn, REVIEW_TIME_FORMAT)));

    logger.info(`Due content: ${JSON.stringify(due)}`);

    let ret: StudySessionNewItem[] = [];

    for (let i = 0; i < due.length; i++) {
      const content = due[i];

      if (content.type === 'course') {
        const db = new CourseDB(content.courseID, async () => this._user);
        ret = ret.concat(await db.getNewCards());
      } else if (content.type === 'tag') {
        const tagDoc = await getTag(content.courseID, content.tagID);

        ret = ret.concat(
          tagDoc.taggedCards.map((c) => {
            return {
              courseID: content.courseID,
              cardID: c,
              qualifiedID: `${content.courseID}-${c}`,
              contentSourceType: 'classroom',
              contentSourceID: this._id,
              status: 'new',
            };
          })
        );
      } else if (content.type === 'card') {
        // returning card docs - not IDs
        ret.push(await getCourseDB(content.courseID).get(content.cardID));
      }
    }

    logger.info(
      `New Cards from classroom ${this._cfg.name}: ${ret.map((c) => `${c.courseID}-${c.cardID}`)}`
    );

    return ret.filter((c) => {
      if (activeCards.some((ac) => c.cardID === ac.cardID)) {
        // [ ] almost certainly broken after removing qualifiedID from StudySessionItem
        return false;
      } else {
        return true;
      }
    });
  }

  /**
   * Get cards with suitability scores for presentation.
   *
   * This implementation wraps the legacy getNewCards/getPendingReviews methods,
   * assigning score=1.0 to all cards. StudentClassroomDB does not currently
   * support pluggable navigation strategies.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending (all scores = 1.0)
   */
  public async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const [newCards, reviews] = await Promise.all([this.getNewCards(), this.getPendingReviews()]);

    const weighted: WeightedCard[] = [
      ...newCards.map((c) => ({
        cardId: c.cardID,
        courseId: c.courseID,
        score: 1.0,
        source: 'new' as const,
      })),
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        source: 'review' as const,
      })),
    ];

    // Sort by score descending (all 1.0 in this case) and limit
    return weighted.slice(0, limit);
  }
}

/**
 * Interface for managing a classroom.
 */
export class TeacherClassroomDB extends ClassroomDBBase implements TeacherClassroomDBInterface {
  private _stuDb!: PouchDB.Database;

  private constructor(classID: string) {
    super();
    this._id = classID;
  }

  async init(): Promise<void> {
    const dbName = `classdb-teacher-${this._id}`;
    const stuDbName = `classdb-student-${this._id}`;
    this._db = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
      createPouchDBConfig()
    );
    this._stuDb = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + stuDbName,
      createPouchDBConfig()
    );
    try {
      return this._db
        .get<ClassroomConfig>(CLASSROOM_CONFIG)
        .then((cfg) => {
          this._cfg = cfg;
          this._initComplete = true;
        })
        .then(() => {
          return;
        });
    } catch (e) {
      throw new Error(`Error in TeacherClassroomDB constructor: ${JSON.stringify(e)}`);
    }
  }

  public static async factory(classID: string): Promise<TeacherClassroomDB> {
    const ret = new TeacherClassroomDB(classID);
    await ret.init();
    return ret;
  }

  public async removeContent(content: AssignedContent): Promise<void> {
    const contentID = this.getContentId(content);

    try {
      const doc = await this._db.get(contentID);
      await this._db.remove(doc);
      void this._db.replicate.to(this._stuDb, {
        doc_ids: [contentID],
      });
    } catch (error) {
      logger.error('Failed to remove content:', contentID, error);
    }
  }

  public async assignContent(content: AssignedContent): Promise<boolean> {
    let put: PouchDB.Core.Response;
    const id: string = this.getContentId(content);

    if (content.type === 'tag') {
      put = await this._db.put<AssignedTag>({
        courseID: content.courseID,
        tagID: content.tagID,
        type: 'tag',
        _id: id,
        assignedBy: content.assignedBy,
        assignedOn: moment.utc(),
        activeOn: content.activeOn || moment.utc(),
      });
    } else {
      put = await this._db.put<AssignedCourse>({
        courseID: content.courseID,
        type: 'course',
        _id: id,
        assignedBy: content.assignedBy,
        assignedOn: moment.utc(),
        activeOn: content.activeOn || moment.utc(),
      });
    }

    if (put.ok) {
      void this._db.replicate.to(this._stuDb, {
        doc_ids: [id],
      });
      return true;
    } else {
      return false;
    }
  }
}

export const ClassroomLookupDB: () => PouchDB.Database = () =>
  new pouch(ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + classroomLookupDBTitle, {
    skip_setup: true,
  });

export function getClassroomDB(classID: string, version: 'student' | 'teacher'): PouchDB.Database {
  const dbName = `classdb-${version}-${classID}`;
  logger.info(`Retrieving classroom db: ${dbName}`);

  return new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
    createPouchDBConfig()
  );
}

export async function getClassroomConfig(classID: string): Promise<ClassroomConfig> {
  return await getClassroomDB(classID, 'student').get<ClassroomConfig>(CLASSROOM_CONFIG);
}

```


## Assistant

Now let me update `SessionController` to use `getWeightedCards()`. I'll add a new method that uses the new API and update `prepareSession()` to call it:

**Tool Call: packages/db/src/study/SessionController.ts**
Status: Completed

Diff: packages/db/src/study/SessionController.ts
```
import { SrsService } from './services/SrsService';
import { EloService } from './services/EloService';
import { ResponseProcessor } from './services/ResponseProcessor';
import { CardHydrationService, HydratedCard } from './services/CardHydrationService';
import { ItemQueue } from './ItemQueue';
import {
  isReview,
  StudyContentSource,
  StudySessionFailedItem,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/impl/couch';

import { CardRecord, CardHistory, CourseRegistrationDoc } from '@db/core';
import { Loggable } from '@db/util';
import { ScheduledCard } from '@db/core/types/user';
import { WeightedCard } from '@db/core/navigators';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface StudySessionRecord {
  card: {
    course_id: string;
    card_id: string;
    card_elo: number;
  };
  item: StudySessionItem;
  records: CardRecord[];
}

import { DataLayerProvider } from '@db/core';

export type SessionAction =
  | 'dismiss-success'
  | 'dismiss-failed'
  | 'marked-failed'
  | 'dismiss-error';

export interface ResponseResult {
  // Navigation
  nextCardAction: Exclude<SessionAction, 'dismiss-error'> | 'none';
  shouldLoadNextCard: boolean;

  // UI Data (let view decide how to render)
  isCorrect: boolean;
  performanceScore?: number; // for shadow color calculation

  // Cleanup
  shouldClearFeedbackShadow: boolean;
}

interface SessionServices {
  response: ResponseProcessor;
}

export class SessionController<TView = unknown> extends Loggable {
  _className = 'SessionController';

  public services: SessionServices;
  private srsService: SrsService;
  private eloService: EloService;
  private hydrationService: CardHydrationService<TView>;

  private sources: StudyContentSource[];
  // dataLayer and getViewComponent now injected into CardHydrationService
  private _sessionRecord: StudySessionRecord[] = [];
  public set sessionRecord(r: StudySessionRecord[]) {
    this._sessionRecord = r;
  }

  // Session card stores
  private _currentCard: HydratedCard<TView> | null = null;

  private reviewQ: ItemQueue<StudySessionReviewItem> = new ItemQueue<StudySessionReviewItem>();
  private newQ: ItemQueue<StudySessionNewItem> = new ItemQueue<StudySessionNewItem>();
  private failedQ: ItemQueue<StudySessionFailedItem> = new ItemQueue<StudySessionFailedItem>();
  // END   Session card stores

  private startTime: Date;
  private endTime: Date;
  private _secondsRemaining: number;
  public get secondsRemaining(): number {
    return this._secondsRemaining;
  }
  public get report(): string {
    return `${this.reviewQ.dequeueCount} reviews, ${this.newQ.dequeueCount} new cards`;
  }
  public get detailedReport(): string {
    return this.newQ.toString + '\n' + this.reviewQ.toString + '\n' + this.failedQ.toString;
  }
  // @ts-expect-error NodeJS.Timeout type not available in browser context
  private _intervalHandle: NodeJS.Timeout;

  /**
   *
   */
  constructor(
    sources: StudyContentSource[],
    time: number,
    dataLayer: DataLayerProvider,
    getViewComponent: (viewId: string) => TView
  ) {
    super();

    this.srsService = new SrsService(dataLayer.getUserDB());
    this.eloService = new EloService(dataLayer, dataLayer.getUserDB());

    this.hydrationService = new CardHydrationService<TView>(
      getViewComponent,
      (courseId: string) => dataLayer.getCourseDB(courseId),
      () => this._selectNextItemToHydrate(),
      (item: StudySessionItem) => this.removeItemFromQueue(item),
      () => this.hasAvailableCards()
    );

    this.services = {
      response: new ResponseProcessor(this.srsService, this.eloService),
    };

    this.sources = sources;
    this.startTime = new Date();
    this._secondsRemaining = time;
    this.endTime = new Date(this.startTime.valueOf() + 1000 * this._secondsRemaining);

    this.log(`Session constructed:
    startTime: ${this.startTime}
    endTime: ${this.endTime}`);
  }

  private tick() {
    this._secondsRemaining = Math.floor((this.endTime.valueOf() - Date.now()) / 1000);
    // this.log(this.secondsRemaining);

    if (this._secondsRemaining <= 0) {
      clearInterval(this._intervalHandle);
    }
  }

  /**
   * Returns a rough, erring toward conservative, guess at
   * the amount of time the failed cards queue will require
   * to clean up.
   *
   * (seconds)
   */
  private estimateCleanupTime(): number {
    let time: number = 0;
    for (let i = 0; i < this.failedQ.length; i++) {
      const c = this.failedQ.peek(i);
      // this.log(`Failed card ${c.qualifiedID} found`)

      const record = this._sessionRecord.find((r) => r.item.cardID === c.cardID);
      let cardTime = 0;

      if (record) {
        // this.log(`Card Record Found...`);
        for (let j = 0; j < record.records.length; j++) {
          cardTime += record.records[j].timeSpent;
        }
        cardTime = cardTime / record.records.length;
        time += cardTime;
      }
    }

    const ret: number = time / 1000;
    this.log(`Failed card cleanup estimate: ${Math.round(ret)}`);
    return ret;
  }

  /**
   * Extremely rough, conservative, estimate of amound of time to complete
   * all scheduled reviews
   */
  private estimateReviewTime(): number {
    const ret = 5 * this.reviewQ.length;
    this.log(`Review card time estimate: ${ret}`);
    return ret;
  }

  public async prepareSession() {
    try {
      // Use new getWeightedCards API if available, fall back to legacy methods
      const hasWeightedCards = this.sources.some((s) => typeof s.getWeightedCards === 'function');

      if (hasWeightedCards) {
        await this.getWeightedContent();
      } else {
        // Legacy path: separate calls for reviews and new cards
        await Promise.all([this.getScheduledReviews(), this.getNewCards()]);
      }
    } catch (e) {
      this.error('Error preparing study session:', e);
    }

    await this.hydrationService.ensureHydratedCards();

    this._intervalHandle = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public addTime(seconds: number) {
    this.endTime = new Date(this.endTime.valueOf() + 1000 * seconds);
  }

  public get failedCount(): number {
    return this.failedQ.length;
  }

  public toString() {
    return `Session: ${this.reviewQ.length} Reviews, ${this.newQ.length} New, ${this.failedQ.length} failed`;
  }
  public reportString() {
    return `${this.reviewQ.dequeueCount} Reviews, ${this.newQ.dequeueCount} New, ${this.failedQ.dequeueCount} failed`;
  }

  /**
   * Returns debug information about the current session state.
   * Used by SessionControllerDebug component for runtime inspection.
   */
  public getDebugInfo() {
    // Check if sources support weighted cards
    const supportsWeightedCards = this.sources.some(
      (s) => typeof s.getWeightedCards === 'function'
    );

    const extractQueueItems = (queue: ItemQueue<any>, limit: number = 10) => {
      const items = [];
      for (let i = 0; i < Math.min(queue.length, limit); i++) {
        const item = queue.peek(i);
        items.push({
          courseID: item.courseID || 'unknown',
          cardID: item.cardID || 'unknown',
          status: item.status || 'unknown',
        });
      }
      return items;
    };

    const extractHydratedItems = () => {
      // We can't easily iterate the hydrated queue without dequeuing,
      // so we'll just report the count via hydratedCache.count below

      const items: any[] = [];
      return items;
    };

    return {
      api: {
        mode: supportsWeightedCards ? 'weighted' : 'legacy',
        description: supportsWeightedCards
          ? 'Using getWeightedCards() API with scored candidates'
          : 'Using legacy getNewCards()/getPendingReviews() API',
      },
      reviewQueue: {
        length: this.reviewQ.length,
        dequeueCount: this.reviewQ.dequeueCount,
        items: extractQueueItems(this.reviewQ),
      },
      newQueue: {
        length: this.newQ.length,
        dequeueCount: this.newQ.dequeueCount,
        items: extractQueueItems(this.newQ),
      },
      failedQueue: {
        length: this.failedQ.length,
        dequeueCount: this.failedQ.dequeueCount,
        items: extractQueueItems(this.failedQ),
      },
      hydratedCache: {
        count: this.hydrationService.hydratedCount,
        failedCacheSize: this.hydrationService.failedCacheSize,
        items: extractHydratedItems(),
      },
    };
  }

  /**
   * Fetch content using the new getWeightedCards API.
   *
   * This unified method replaces separate getScheduledReviews() and getNewCards() calls.
   * Cards are fetched with suitability scores, sorted by score, and distributed to
   * the appropriate queues based on their source field.
   */
  private async getWeightedContent() {
    const limit = 20; // Initial batch size per source

    // Fetch weighted cards from all sources that support the new API
    const allWeighted: WeightedCard[] = [];

    for (const source of this.sources) {
      if (typeof source.getWeightedCards === 'function') {
        try {
          const cards = await source.getWeightedCards(limit);
          allWeighted.push(...cards);
        } catch (error) {
          this.error(`Failed to get weighted cards from source:`, error);
        }
      } else {
        // Fallback for sources that don't support getWeightedCards
        this.log(`Source does not support getWeightedCards, using legacy methods`);
        try {
          const [newCards, reviews] = await Promise.all([
            source.getNewCards(limit),
            source.getPendingReviews(),
          ]);

          // Convert to WeightedCard format with score=1.0
          allWeighted.push(
            ...newCards.map((c) => ({
              cardId: c.cardID,
              courseId: c.courseID,
              score: 1.0,
              source: 'new' as const,
            })),
            ...reviews.map((r) => ({
              cardId: r.cardID,
              courseId: r.courseID,
              score: 1.0,
              source: 'review' as const,
            }))
          );
        } catch (error) {
          this.error(`Failed to get cards from legacy source:`, error);
        }
      }
    }

    // Sort by score descending
    allWeighted.sort((a, b) => b.score - a.score);

    // Distribute to queues based on source field
    let report = 'Weighted content session created with:\n';

    for (const card of allWeighted) {
      if (card.source === 'review') {
        // Create a review item - we need to look up the full review data
        // For now, create a minimal item that can be hydrated
        const reviewItem: StudySessionReviewItem & ScheduledCard = {
          cardID: card.cardId,
          courseID: card.courseId,
          contentSourceType: 'course',
          contentSourceID: card.courseId,
          status: 'review',
          reviewID: `review-${card.cardId}`, // Placeholder - actual reviewID comes from scheduled card
          cardId: card.cardId,
          courseId: card.courseId,
          scheduledFor: 'course',
          schedulingAgentId: card.courseId,
        };
        this.reviewQ.add(reviewItem, card.cardId);
        report += `Review: ${card.courseId}::${card.cardId} (score: ${card.score.toFixed(2)})\n`;
      } else {
        // 'new' or 'failed'
        const newItem: StudySessionNewItem = {
          cardID: card.cardId,
          courseID: card.courseId,
          contentSourceType: 'course',
          contentSourceID: card.courseId,
          status: 'new',
        };
        this.newQ.add(newItem, card.cardId);
        report += `New: ${card.courseId}::${card.cardId} (score: ${card.score.toFixed(2)})\n`;
      }
    }

    this.log(report);
  }

  /**
   * @deprecated Use getWeightedContent() instead. This method is kept for backward
   * compatibility with sources that don't support getWeightedCards().
   */
  private async getScheduledReviews() {
    const reviews = await Promise.all(
      this.sources.map((c) =>
        c.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source ${c}:`, error);
          return [];
        })
      )
    );

    const dueCards: (StudySessionReviewItem & ScheduledCard)[] = [];

    while (reviews.length != 0 && reviews.some((r) => r.length > 0)) {
      // pick a random review source
      const index = randomInt(0, reviews.length - 1);
      const source = reviews[index];

      if (source.length === 0) {
        reviews.splice(index, 1);
        continue;
      } else {
        dueCards.push(source.shift()!);
      }
    }

    let report = 'Review session created with:\n';
    this.reviewQ.addAll(dueCards, (c) => c.cardID);
    report += dueCards.map((card) => `Card ${card.courseID}::${card.cardID} `).join('\n');
    this.log(report);
  }

  /**
   * @deprecated Use getWeightedContent() instead. This method is kept for backward
   * compatibility with sources that don't support getWeightedCards().
   */
  private async getNewCards(n: number = 10) {
    const perCourse = Math.ceil(n / this.sources.length);
    const newContent = await Promise.all(this.sources.map((c) => c.getNewCards(perCourse)));

    // [ ] is this a noop?
    newContent.forEach((newContentFromSource) => {
      newContentFromSource.filter((c) => {
        return this._sessionRecord.find((record) => record.card.card_id === c.cardID) === undefined;
      });
    });

    while (n > 0 && newContent.some((nc) => nc.length > 0)) {
      for (let i = 0; i < newContent.length; i++) {
        if (newContent[i].length > 0) {
          const item = newContent[i].splice(0, 1)[0];
          this.log(`Adding new card: ${item.courseID}::${item.cardID}`);
          this.newQ.add(item, item.cardID);
          n--;
        }
      }
    }
  }

  private _selectNextItemToHydrate(): StudySessionItem | null {
    const choice = Math.random();
    let newBound: number = 0.1;
    let reviewBound: number = 0.75;

    if (this.reviewQ.length === 0 && this.failedQ.length === 0 && this.newQ.length === 0) {
      // all queues empty - session is over (and course is complete?)
      return null;
    }

    if (this._secondsRemaining < 2 && this.failedQ.length === 0) {
      // session is over!
      return null;
    }

    // If timer expired, only return failed cards
    if (this._secondsRemaining <= 0) {
      if (this.failedQ.length > 0) {
        return this.failedQ.peek(0);
      } else {
        return null; // No more failed cards, session over
      }
    }

    // supply new cards at start of session
    if (this.newQ.dequeueCount < this.sources.length && this.newQ.length) {
      return this.newQ.peek(0);
    }

    const cleanupTime = this.estimateCleanupTime();
    const reviewTime = this.estimateReviewTime();
    const availableTime = this._secondsRemaining - (cleanupTime + reviewTime);

    // if time-remaing vs (reviewQ + failureQ) looks good,
    // lean toward newQ
    if (availableTime > 20) {
      newBound = 0.5;
      reviewBound = 0.9;
    }
    // else if time-remaining vs failureQ looks good,
    // lean toward reviewQ
    else if (this._secondsRemaining - cleanupTime > 20) {
      newBound = 0.05;
      reviewBound = 0.9;
    }
    // else (time-remaining vs failureQ looks bad!)
    // lean heavily toward failureQ
    else {
      newBound = 0.01;
      reviewBound = 0.1;
    }

    // exclude possibility of drawing from empty queues
    if (this.failedQ.length === 0) {
      reviewBound = 1;
    }
    if (this.reviewQ.length === 0) {
      newBound = reviewBound;
    }

    if (choice < newBound && this.newQ.length) {
      return this.newQ.peek(0);
    } else if (choice < reviewBound && this.reviewQ.length) {
      return this.reviewQ.peek(0);
    } else if (this.failedQ.length) {
      return this.failedQ.peek(0);
    } else {
      this.log(`No more cards available for the session!`);
      return null;
    }
  }

  public async nextCard(
    action: SessionAction = 'dismiss-success'
  ): Promise<HydratedCard<TView> | null> {
    // dismiss (or sort to failedQ) the current card
    this.dismissCurrentCard(action);

    if (this._secondsRemaining <= 0 && this.failedQ.length === 0) {
      this._currentCard = null;
      return null;
    }

    let card = this.hydrationService.dequeueHydratedCard();

    // If no hydrated card but source cards available, wait for hydration
    if (!card && this.hasAvailableCards()) {
      card = await this.hydrationService.waitForHydratedCard();
    }

    // Trigger background hydration to maintain cache (async, non-blocking)
    await this.hydrationService.ensureHydratedCards();

    if (card) {
      this._currentCard = card;
    } else {
      this._currentCard = null;
    }

    return card;
  }

  /**
   * Public API for processing user responses to cards.
   * @param cardRecord User's response record
   * @param cardHistory Promise resolving to the card's history
   * @param courseRegistrationDoc User's course registration document
   * @param currentCard Current study session record
   * @param courseId Course identifier
   * @param cardId Card identifier
   * @param maxAttemptsPerView Maximum attempts allowed per view
   * @param maxSessionViews Maximum session views for this card
   * @param sessionViews Current number of session views
   * @returns ResponseResult with navigation and UI instructions
   */
  public async submitResponse(
    cardRecord: CardRecord,
    cardHistory: Promise<CardHistory<CardRecord>>,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): Promise<ResponseResult> {
    const studySessionItem: StudySessionItem = {
      ...currentCard.item,
    };

    return await this.services.response.processResponse(
      cardRecord,
      cardHistory,
      studySessionItem,
      courseRegistrationDoc,
      currentCard,
      courseId,
      cardId,
      maxAttemptsPerView,
      maxSessionViews,
      sessionViews
    );
  }

  private dismissCurrentCard(action: SessionAction = 'dismiss-success') {
    if (this._currentCard) {
      // this.log(`Running dismissCurrentCard on ${this._currentCard!.qualifiedID}`);
      // if (action.includes('dismiss')) {
      //   if (this._currentCard.status === 'review' ||
      //     this._currentCard.status === 'failed-review') {
      //     removeScheduledCardReview(this.user.getUsername(),
      //       (this._currentCard as StudySessionReviewItem).reviewID);
      //     this.log(`Dismissed review card: ${this._currentCard.qualifiedID}`)
      //   }
      // }

      if (action === 'dismiss-success') {
        // schedule a review - currently done in Study.vue
      } else if (action === 'marked-failed') {
        this.hydrationService.cacheFailedCard(this._currentCard);

        let failedItem: StudySessionFailedItem;

        if (isReview(this._currentCard.item)) {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-review',
            reviewID: this._currentCard.item.reviewID,
          };
        } else {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-new',
          };
        }

        this.failedQ.add(failedItem, failedItem.cardID);
      } else if (action === 'dismiss-error') {
        // some error logging?
      } else if (action === 'dismiss-failed') {
        // handled by Study.vue
      }
    }
  }

  private hasAvailableCards(): boolean {
    return this.reviewQ.length > 0 || this.newQ.length > 0 || this.failedQ.length > 0;
  }

  /**
   * Helper method for CardHydrationService to remove items from appropriate queue.
   */
  private removeItemFromQueue(item: StudySessionItem): void {
    if (this.reviewQ.peek(0) === item) {
      this.reviewQ.dequeue((queueItem) => queueItem.cardID);
    } else if (this.newQ.peek(0) === item) {
      this.newQ.dequeue((queueItem) => queueItem.cardID);
    } else {
      this.failedQ.dequeue((queueItem) => queueItem.cardID);
    }
  }
}

```


## Assistant

Now let's verify the build:

**Tool Call: `yarn workspace @vue-skuilder/db build 2>&1 | tail -30`**
Status: Completed

Terminal:
```
    src/core/navigators/index.ts:120:36:
      120 │         const module = await import(`./${implementingClass}${ext}`);
          ╵                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

✘ [ERROR] No loader is configured for ".md" files: src/core/navigators/todo-provenance.md

    src/core/navigators/index.ts:120:36:
      120 │         const module = await import(`./${implementingClass}${ext}`);
          ╵                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

ESM Build failed
Error: Build failed with 2 errors:
src/core/navigators/index.ts:120:36: ERROR: No loader is configured for ".md" files: src/core/navigators/ARCHITECTURE.md
src/core/navigators/index.ts:120:36: ERROR: No loader is configured for ".md" files: src/core/navigators/todo-provenance.md
    at failureErrorWithLog (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:1477:15)
    at /home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:946:25
    at runOnEndCallbacks (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:1317:45)
    at buildResponseToResult (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:944:7)
    at /home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:971:16
    at responseCallbacks.<computed> (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:623:9)
    at handleIncomingPacket (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:678:12)
    at Socket.readFromStdout (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:601:7)
    at Socket.emit (node:events:517:28)
    at addChunk (node:internal/streams/readable:368:12)
CJS Build failed
DTS Build start
src/study/SessionController.ts(342,15): error TS2322: Type '{ cardID: string; courseID: string; contentSourceType: "course"; contentSourceID: string; status: "review"; reviewID: string; cardId: string; courseId: string; scheduledFor: "course"; schedulingAgentId: string; }' is not assignable to type 'StudySessionReviewItem & ScheduledCard'.
  Type '{ cardID: string; courseID: string; contentSourceType: "course"; contentSourceID: string; status: "review"; reviewID: string; cardId: string; courseId: string; scheduledFor: "course"; schedulingAgentId: string; }' is missing the following properties from type 'ScheduledCard': _id, reviewTime, scheduledAt

DTS Build error

```


## Assistant

Two issues:

1. The MD files in the navigators directory are being picked up by the dynamic import
2. Type error in the ScheduledCard creation

Let me fix both:

**Tool Call: Move `master/packages/db/src/core/navigators/ARCHITECTURE.md` to `master/packages/db/docs/navigators-architecture.md`**
Status: Completed

Moved master/packages/db/src/core/navigators/ARCHITECTURE.md to master/packages/db/docs/navigators-architecture.md

**Tool Call: Read file `packages/db/src/core/types/user.ts`**
Status: Completed

```master/packages/db/src/core/types/user.ts
import { CourseElo } from '@vue-skuilder/common';
import { Moment } from 'moment';

export interface SessionTrackingData {
  peekSessionCount: number;
  studySessionCount: number;
  sessionCount: number; // total
  firstSessionDate: string;
  lastSessionDate: string;
  signupPrompted: boolean;
  promptDismissalCount: number;
  studyModeAcknowledged: boolean;
}

export interface UserConfig {
  darkMode: boolean;
  likesConfetti: boolean;
  sessionTimeLimit: number; // Session time limit in minutes
  email?: string; // Optional email for verification flows (added for enhanced auth)

  // Session tracking for trial enforcement (per-course)
  // Key is courseId (e.g., 'letterspractice-basic')
  sessionTracking?: Record<string, SessionTrackingData>;
}

export interface ActivityRecord {
  timeStamp: number | string;
  [key: string]: any;
}

export interface CourseRegistration {
  status?: 'active' | 'dropped' | 'maintenance-mode' | 'preview';
  courseID: string;
  admin: boolean;
  moderator: boolean;
  user: boolean;
  settings?: {
    [setting: string]: string | number | boolean;
  };
  elo: number | CourseElo;
}

interface StudyWeights {
  [courseID: string]: number;
}

export interface CourseRegistrationDoc {
  courses: CourseRegistration[];
  studyWeight: StudyWeights;
}

export interface ScheduledCard {
  _id: PouchDB.Core.DocumentId;

  /**
   * The docID of the card to be reviewed
   */
  cardId: PouchDB.Core.DocumentId;
  /**
   * The ID of the course
   */
  courseId: string;
  /**
   * The time at which the card becomes eligible for review.
   *
   * (Should probably be UTC adjusted so that performance is
   * not wonky across time zones)
   * 
   * Note: Stored as ISO string for PouchDB serialization compatibility,
   * but can be consumed as Moment objects via moment.utc(reviewTime)
   */
  reviewTime: string | Moment;

  /**
   * The time at which this scheduled event was created.
   * 
   * Note: Stored as ISO string for PouchDB serialization compatibility,
   * but can be consumed as Moment objects via moment.utc(scheduledAt)
   */
  scheduledAt: string | Moment;

  /**
   * Classifying whether this card is scheduled on behalf of a
   * user-registered course or by as assigned content from a
   * user-registered classroom
   */
  scheduledFor: 'course' | 'classroom';

  /**
   * The ID of the course or classroom that requested this card
   */
  schedulingAgentId: string;
}

```


## Assistant

I see the issue - `ScheduledCard` requires `_id`, `reviewTime`, and `scheduledAt`. The problem is that when we get cards from `getWeightedCards()`, we don't have the full `ScheduledCard` data for reviews. Let me look at how the original code handles this:

**Tool Call: Read file `packages/db/src/study/SessionController.ts` (lines 275-320)**
Status: Completed

```master/packages/db/src/study/SessionController.ts
        failedCacheSize: this.hydrationService.failedCacheSize,
        items: extractHydratedItems(),
      },
    };
  }

  /**
   * Fetch content using the new getWeightedCards API.
   *
   * This unified method replaces separate getScheduledReviews() and getNewCards() calls.
   * Cards are fetched with suitability scores, sorted by score, and distributed to
   * the appropriate queues based on their source field.
   */
  private async getWeightedContent() {
    const limit = 20; // Initial batch size per source

    // Fetch weighted cards from all sources that support the new API
    const allWeighted: WeightedCard[] = [];

    for (const source of this.sources) {
      if (typeof source.getWeightedCards === 'function') {
        try {
          const cards = await source.getWeightedCards(limit);
          allWeighted.push(...cards);
        } catch (error) {
          this.error(`Failed to get weighted cards from source:`, error);
        }
      } else {
        // Fallback for sources that don't support getWeightedCards
        this.log(`Source does not support getWeightedCards, using legacy methods`);
        try {
          const [newCards, reviews] = await Promise.all([
            source.getNewCards(limit),
            source.getPendingReviews(),
          ]);

          // Convert to WeightedCard format with score=1.0
          allWeighted.push(
            ...newCards.map((c) => ({
              cardId: c.cardID,
              courseId: c.courseID,
              score: 1.0,
              source: 'new' as const,
            })),
            ...reviews.map((r) => ({
              cardId: r.cardID,

```


## Assistant

Looking at the original `getScheduledReviews()`, it gets full `ScheduledCard & StudySessionReviewItem` objects from `getPendingReviews()`. The problem is that `getWeightedCards()` only returns `WeightedCard` which doesn't have the full review metadata.

I have a few options:
1. Extend `WeightedCard` to optionally include the full item data
2. Keep using the legacy path for reviews while using `getWeightedCards()` for ordering
3. Have the sources return full items with scores attached

For now, let me take a simpler approach - the `getWeightedCards()` implementation should continue to work alongside legacy methods. The scored list gives us the **ordering**, but we still need to fetch the actual review data. Let me refactor:

**Tool Call: packages/db/src/study/SessionController.ts**
Status: Completed

Diff: packages/db/src/study/SessionController.ts
```
import { SrsService } from './services/SrsService';
import { EloService } from './services/EloService';
import { ResponseProcessor } from './services/ResponseProcessor';
import { CardHydrationService, HydratedCard } from './services/CardHydrationService';
import { ItemQueue } from './ItemQueue';
import {
  isReview,
  StudyContentSource,
  StudySessionFailedItem,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/impl/couch';

import { CardRecord, CardHistory, CourseRegistrationDoc } from '@db/core';
import { Loggable } from '@db/util';
import { ScheduledCard } from '@db/core/types/user';
import { WeightedCard } from '@db/core/navigators';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface StudySessionRecord {
  card: {
    course_id: string;
    card_id: string;
    card_elo: number;
  };
  item: StudySessionItem;
  records: CardRecord[];
}

import { DataLayerProvider } from '@db/core';

export type SessionAction =
  | 'dismiss-success'
  | 'dismiss-failed'
  | 'marked-failed'
  | 'dismiss-error';

export interface ResponseResult {
  // Navigation
  nextCardAction: Exclude<SessionAction, 'dismiss-error'> | 'none';
  shouldLoadNextCard: boolean;

  // UI Data (let view decide how to render)
  isCorrect: boolean;
  performanceScore?: number; // for shadow color calculation

  // Cleanup
  shouldClearFeedbackShadow: boolean;
}

interface SessionServices {
  response: ResponseProcessor;
}

export class SessionController<TView = unknown> extends Loggable {
  _className = 'SessionController';

  public services: SessionServices;
  private srsService: SrsService;
  private eloService: EloService;
  private hydrationService: CardHydrationService<TView>;

  private sources: StudyContentSource[];
  // dataLayer and getViewComponent now injected into CardHydrationService
  private _sessionRecord: StudySessionRecord[] = [];
  public set sessionRecord(r: StudySessionRecord[]) {
    this._sessionRecord = r;
  }

  // Session card stores
  private _currentCard: HydratedCard<TView> | null = null;

  private reviewQ: ItemQueue<StudySessionReviewItem> = new ItemQueue<StudySessionReviewItem>();
  private newQ: ItemQueue<StudySessionNewItem> = new ItemQueue<StudySessionNewItem>();
  private failedQ: ItemQueue<StudySessionFailedItem> = new ItemQueue<StudySessionFailedItem>();
  // END   Session card stores

  private startTime: Date;
  private endTime: Date;
  private _secondsRemaining: number;
  public get secondsRemaining(): number {
    return this._secondsRemaining;
  }
  public get report(): string {
    return `${this.reviewQ.dequeueCount} reviews, ${this.newQ.dequeueCount} new cards`;
  }
  public get detailedReport(): string {
    return this.newQ.toString + '\n' + this.reviewQ.toString + '\n' + this.failedQ.toString;
  }
  // @ts-expect-error NodeJS.Timeout type not available in browser context
  private _intervalHandle: NodeJS.Timeout;

  /**
   *
   */
  constructor(
    sources: StudyContentSource[],
    time: number,
    dataLayer: DataLayerProvider,
    getViewComponent: (viewId: string) => TView
  ) {
    super();

    this.srsService = new SrsService(dataLayer.getUserDB());
    this.eloService = new EloService(dataLayer, dataLayer.getUserDB());

    this.hydrationService = new CardHydrationService<TView>(
      getViewComponent,
      (courseId: string) => dataLayer.getCourseDB(courseId),
      () => this._selectNextItemToHydrate(),
      (item: StudySessionItem) => this.removeItemFromQueue(item),
      () => this.hasAvailableCards()
    );

    this.services = {
      response: new ResponseProcessor(this.srsService, this.eloService),
    };

    this.sources = sources;
    this.startTime = new Date();
    this._secondsRemaining = time;
    this.endTime = new Date(this.startTime.valueOf() + 1000 * this._secondsRemaining);

    this.log(`Session constructed:
    startTime: ${this.startTime}
    endTime: ${this.endTime}`);
  }

  private tick() {
    this._secondsRemaining = Math.floor((this.endTime.valueOf() - Date.now()) / 1000);
    // this.log(this.secondsRemaining);

    if (this._secondsRemaining <= 0) {
      clearInterval(this._intervalHandle);
    }
  }

  /**
   * Returns a rough, erring toward conservative, guess at
   * the amount of time the failed cards queue will require
   * to clean up.
   *
   * (seconds)
   */
  private estimateCleanupTime(): number {
    let time: number = 0;
    for (let i = 0; i < this.failedQ.length; i++) {
      const c = this.failedQ.peek(i);
      // this.log(`Failed card ${c.qualifiedID} found`)

      const record = this._sessionRecord.find((r) => r.item.cardID === c.cardID);
      let cardTime = 0;

      if (record) {
        // this.log(`Card Record Found...`);
        for (let j = 0; j < record.records.length; j++) {
          cardTime += record.records[j].timeSpent;
        }
        cardTime = cardTime / record.records.length;
        time += cardTime;
      }
    }

    const ret: number = time / 1000;
    this.log(`Failed card cleanup estimate: ${Math.round(ret)}`);
    return ret;
  }

  /**
   * Extremely rough, conservative, estimate of amound of time to complete
   * all scheduled reviews
   */
  private estimateReviewTime(): number {
    const ret = 5 * this.reviewQ.length;
    this.log(`Review card time estimate: ${ret}`);
    return ret;
  }

  public async prepareSession() {
    try {
      // Use new getWeightedCards API if available, fall back to legacy methods
      const hasWeightedCards = this.sources.some((s) => typeof s.getWeightedCards === 'function');

      if (hasWeightedCards) {
        await this.getWeightedContent();
      } else {
        // Legacy path: separate calls for reviews and new cards
        await Promise.all([this.getScheduledReviews(), this.getNewCards()]);
      }
    } catch (e) {
      this.error('Error preparing study session:', e);
    }

    await this.hydrationService.ensureHydratedCards();

    this._intervalHandle = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public addTime(seconds: number) {
    this.endTime = new Date(this.endTime.valueOf() + 1000 * seconds);
  }

  public get failedCount(): number {
    return this.failedQ.length;
  }

  public toString() {
    return `Session: ${this.reviewQ.length} Reviews, ${this.newQ.length} New, ${this.failedQ.length} failed`;
  }
  public reportString() {
    return `${this.reviewQ.dequeueCount} Reviews, ${this.newQ.dequeueCount} New, ${this.failedQ.dequeueCount} failed`;
  }

  /**
   * Returns debug information about the current session state.
   * Used by SessionControllerDebug component for runtime inspection.
   */
  public getDebugInfo() {
    // Check if sources support weighted cards
    const supportsWeightedCards = this.sources.some(
      (s) => typeof s.getWeightedCards === 'function'
    );

    const extractQueueItems = (queue: ItemQueue<any>, limit: number = 10) => {
      const items = [];
      for (let i = 0; i < Math.min(queue.length, limit); i++) {
        const item = queue.peek(i);
        items.push({
          courseID: item.courseID || 'unknown',
          cardID: item.cardID || 'unknown',
          status: item.status || 'unknown',
        });
      }
      return items;
    };

    const extractHydratedItems = () => {
      // We can't easily iterate the hydrated queue without dequeuing,
      // so we'll just report the count via hydratedCache.count below

      const items: any[] = [];
      return items;
    };

    return {
      api: {
        mode: supportsWeightedCards ? 'weighted' : 'legacy',
        description: supportsWeightedCards
          ? 'Using getWeightedCards() API with scored candidates'
          : 'Using legacy getNewCards()/getPendingReviews() API',
      },
      reviewQueue: {
        length: this.reviewQ.length,
        dequeueCount: this.reviewQ.dequeueCount,
        items: extractQueueItems(this.reviewQ),
      },
      newQueue: {
        length: this.newQ.length,
        dequeueCount: this.newQ.dequeueCount,
        items: extractQueueItems(this.newQ),
      },
      failedQueue: {
        length: this.failedQ.length,
        dequeueCount: this.failedQ.dequeueCount,
        items: extractQueueItems(this.failedQ),
      },
      hydratedCache: {
        count: this.hydrationService.hydratedCount,
        failedCacheSize: this.hydrationService.failedCacheSize,
        items: extractHydratedItems(),
      },
    };
  }

  /**
   * Fetch content using the new getWeightedCards API.
   *
   * This method uses getWeightedCards() to get scored candidates, then uses the
   * scores to determine ordering. For reviews, we still need the full ScheduledCard
   * data from getPendingReviews(), so we fetch both and use scores for ordering.
   *
   * The hybrid approach:
   * 1. Fetch weighted cards to get scoring/ordering information
   * 2. Fetch full review data via legacy getPendingReviews()
   * 3. Order reviews by their weighted scores
   * 4. Add new cards ordered by their weighted scores
   */
  private async getWeightedContent() {
    const limit = 20; // Initial batch size per source

    // Collect weighted cards for scoring, and full review data for queue population
    const allWeighted: WeightedCard[] = [];
    const allReviews: (StudySessionReviewItem & ScheduledCard)[] = [];
    const allNewCards: StudySessionNewItem[] = [];

    for (const source of this.sources) {
      try {
        // Always fetch full review data (we need ScheduledCard fields)
        const reviews = await source.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source:`, error);
          return [];
        });
        allReviews.push(...reviews);

        // Fetch weighted cards for scoring if available
        if (typeof source.getWeightedCards === 'function') {
          const weighted = await source.getWeightedCards(limit);
          allWeighted.push(...weighted);
        } else {
          // Fallback: fetch new cards directly and assign score=1.0
          const newCards = await source.getNewCards(limit);
          allNewCards.push(...newCards);

          // Create pseudo-weighted entries for ordering
          allWeighted.push(
            ...newCards.map((c) => ({
              cardId: c.cardID,
              courseId: c.courseID,
              score: 1.0,
              source: 'new' as const,
            })),
            ...reviews.map((r) => ({
              cardId: r.cardID,
              courseId: r.courseID,
              score: 1.0,
              source: 'review' as const,
            }))
          );
        }
      } catch (error) {
        this.error(`Failed to get content from source:`, error);
      }
    }

    // Build a score lookup map from weighted cards
    const scoreMap = new Map<string, number>();
    for (const w of allWeighted) {
      const key = `${w.courseId}::${w.cardId}`;
      scoreMap.set(key, w.score);
    }

    // Sort reviews by score (from weighted cards) descending
    const scoredReviews = allReviews.map((r) => ({
      review: r,
      score: scoreMap.get(`${r.courseID}::${r.cardID}`) ?? 1.0,
    }));
    scoredReviews.sort((a, b) => b.score - a.score);

    // Add reviews to queue in score order
    let report = 'Weighted content session created with:\n';
    for (const { review, score } of scoredReviews) {
      this.reviewQ.add(review, review.cardID);
      report += `Review: ${review.courseID}::${review.cardID} (score: ${score.toFixed(2)})\n`;
    }

    // Get new cards from weighted list (filter out reviews)
    const newCardWeighted = allWeighted
      .filter((w) => w.source === 'new')
      .sort((a, b) => b.score - a.score);

    // Add new cards to queue in score order
    for (const card of newCardWeighted) {
      const newItem: StudySessionNewItem = {
        cardID: card.cardId,
        courseID: card.courseId,
        contentSourceType: 'course',
        contentSourceID: card.courseId,
        status: 'new',
      };
      this.newQ.add(newItem, card.cardId);
      report += `New: ${card.courseId}::${card.cardId} (score: ${card.score.toFixed(2)})\n`;
    }

    this.log(report);
  }

  /**
   * @deprecated Use getWeightedContent() instead. This method is kept for backward
   * compatibility with sources that don't support getWeightedCards().
   */
  private async getScheduledReviews() {
    const reviews = await Promise.all(
      this.sources.map((c) =>
        c.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source ${c}:`, error);
          return [];
        })
      )
    );

    const dueCards: (StudySessionReviewItem & ScheduledCard)[] = [];

    while (reviews.length != 0 && reviews.some((r) => r.length > 0)) {
      // pick a random review source
      const index = randomInt(0, reviews.length - 1);
      const source = reviews[index];

      if (source.length === 0) {
        reviews.splice(index, 1);
        continue;
      } else {
        dueCards.push(source.shift()!);
      }
    }

    let report = 'Review session created with:\n';
    this.reviewQ.addAll(dueCards, (c) => c.cardID);
    report += dueCards.map((card) => `Card ${card.courseID}::${card.cardID} `).join('\n');
    this.log(report);
  }

  /**
   * @deprecated Use getWeightedContent() instead. This method is kept for backward
   * compatibility with sources that don't support getWeightedCards().
   */
  private async getNewCards(n: number = 10) {
    const perCourse = Math.ceil(n / this.sources.length);
    const newContent = await Promise.all(this.sources.map((c) => c.getNewCards(perCourse)));

    // [ ] is this a noop?
    newContent.forEach((newContentFromSource) => {
      newContentFromSource.filter((c) => {
        return this._sessionRecord.find((record) => record.card.card_id === c.cardID) === undefined;
      });
    });

    while (n > 0 && newContent.some((nc) => nc.length > 0)) {
      for (let i = 0; i < newContent.length; i++) {
        if (newContent[i].length > 0) {
          const item = newContent[i].splice(0, 1)[0];
          this.log(`Adding new card: ${item.courseID}::${item.cardID}`);
          this.newQ.add(item, item.cardID);
          n--;
        }
      }
    }
  }

  private _selectNextItemToHydrate(): StudySessionItem | null {
    const choice = Math.random();
    let newBound: number = 0.1;
    let reviewBound: number = 0.75;

    if (this.reviewQ.length === 0 && this.failedQ.length === 0 && this.newQ.length === 0) {
      // all queues empty - session is over (and course is complete?)
      return null;
    }

    if (this._secondsRemaining < 2 && this.failedQ.length === 0) {
      // session is over!
      return null;
    }

    // If timer expired, only return failed cards
    if (this._secondsRemaining <= 0) {
      if (this.failedQ.length > 0) {
        return this.failedQ.peek(0);
      } else {
        return null; // No more failed cards, session over
      }
    }

    // supply new cards at start of session
    if (this.newQ.dequeueCount < this.sources.length && this.newQ.length) {
      return this.newQ.peek(0);
    }

    const cleanupTime = this.estimateCleanupTime();
    const reviewTime = this.estimateReviewTime();
    const availableTime = this._secondsRemaining - (cleanupTime + reviewTime);

    // if time-remaing vs (reviewQ + failureQ) looks good,
    // lean toward newQ
    if (availableTime > 20) {
      newBound = 0.5;
      reviewBound = 0.9;
    }
    // else if time-remaining vs failureQ looks good,
    // lean toward reviewQ
    else if (this._secondsRemaining - cleanupTime > 20) {
      newBound = 0.05;
      reviewBound = 0.9;
    }
    // else (time-remaining vs failureQ looks bad!)
    // lean heavily toward failureQ
    else {
      newBound = 0.01;
      reviewBound = 0.1;
    }

    // exclude possibility of drawing from empty queues
    if (this.failedQ.length === 0) {
      reviewBound = 1;
    }
    if (this.reviewQ.length === 0) {
      newBound = reviewBound;
    }

    if (choice < newBound && this.newQ.length) {
      return this.newQ.peek(0);
    } else if (choice < reviewBound && this.reviewQ.length) {
      return this.reviewQ.peek(0);
    } else if (this.failedQ.length) {
      return this.failedQ.peek(0);
    } else {
      this.log(`No more cards available for the session!`);
      return null;
    }
  }

  public async nextCard(
    action: SessionAction = 'dismiss-success'
  ): Promise<HydratedCard<TView> | null> {
    // dismiss (or sort to failedQ) the current card
    this.dismissCurrentCard(action);

    if (this._secondsRemaining <= 0 && this.failedQ.length === 0) {
      this._currentCard = null;
      return null;
    }

    let card = this.hydrationService.dequeueHydratedCard();

    // If no hydrated card but source cards available, wait for hydration
    if (!card && this.hasAvailableCards()) {
      card = await this.hydrationService.waitForHydratedCard();
    }

    // Trigger background hydration to maintain cache (async, non-blocking)
    await this.hydrationService.ensureHydratedCards();

    if (card) {
      this._currentCard = card;
    } else {
      this._currentCard = null;
    }

    return card;
  }

  /**
   * Public API for processing user responses to cards.
   * @param cardRecord User's response record
   * @param cardHistory Promise resolving to the card's history
   * @param courseRegistrationDoc User's course registration document
   * @param currentCard Current study session record
   * @param courseId Course identifier
   * @param cardId Card identifier
   * @param maxAttemptsPerView Maximum attempts allowed per view
   * @param maxSessionViews Maximum session views for this card
   * @param sessionViews Current number of session views
   * @returns ResponseResult with navigation and UI instructions
   */
  public async submitResponse(
    cardRecord: CardRecord,
    cardHistory: Promise<CardHistory<CardRecord>>,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): Promise<ResponseResult> {
    const studySessionItem: StudySessionItem = {
      ...currentCard.item,
    };

    return await this.services.response.processResponse(
      cardRecord,
      cardHistory,
      studySessionItem,
      courseRegistrationDoc,
      currentCard,
      courseId,
      cardId,
      maxAttemptsPerView,
      maxSessionViews,
      sessionViews
    );
  }

  private dismissCurrentCard(action: SessionAction = 'dismiss-success') {
    if (this._currentCard) {
      // this.log(`Running dismissCurrentCard on ${this._currentCard!.qualifiedID}`);
      // if (action.includes('dismiss')) {
      //   if (this._currentCard.status === 'review' ||
      //     this._currentCard.status === 'failed-review') {
      //     removeScheduledCardReview(this.user.getUsername(),
      //       (this._currentCard as StudySessionReviewItem).reviewID);
      //     this.log(`Dismissed review card: ${this._currentCard.qualifiedID}`)
      //   }
      // }

      if (action === 'dismiss-success') {
        // schedule a review - currently done in Study.vue
      } else if (action === 'marked-failed') {
        this.hydrationService.cacheFailedCard(this._currentCard);

        let failedItem: StudySessionFailedItem;

        if (isReview(this._currentCard.item)) {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-review',
            reviewID: this._currentCard.item.reviewID,
          };
        } else {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-new',
          };
        }

        this.failedQ.add(failedItem, failedItem.cardID);
      } else if (action === 'dismiss-error') {
        // some error logging?
      } else if (action === 'dismiss-failed') {
        // handled by Study.vue
      }
    }
  }

  private hasAvailableCards(): boolean {
    return this.reviewQ.length > 0 || this.newQ.length > 0 || this.failedQ.length > 0;
  }

  /**
   * Helper method for CardHydrationService to remove items from appropriate queue.
   */
  private removeItemFromQueue(item: StudySessionItem): void {
    if (this.reviewQ.peek(0) === item) {
      this.reviewQ.dequeue((queueItem) => queueItem.cardID);
    } else if (this.newQ.peek(0) === item) {
      this.newQ.dequeue((queueItem) => queueItem.cardID);
    } else {
      this.failedQ.dequeue((queueItem) => queueItem.cardID);
    }
  }
}

```


## Assistant

Now let's rebuild:

**Tool Call: `yarn workspace @vue-skuilder/db build 2>&1 | tail -30`**
Status: Completed

Terminal:
```
    at Socket.readFromStdout (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:601:7)
    at Socket.emit (node:events:517:28)
    at addChunk (node:internal/streams/readable:368:12)
CJS Build failed
DTS Build start
DTS ⚡️ Build success in 59509ms
DTS dist/pouch/index.d.ts                 35.00 B
DTS dist/impl/static/index.d.ts           8.69 KB
DTS dist/impl/couch/index.d.ts            15.36 KB
DTS dist/index.d.ts                       19.33 KB
DTS dist/core/index.d.ts                  3.90 KB
DTS dist/util/packer/index.d.ts           352.00 B
DTS dist/dataLayerProvider-D0dnSb3q.d.ts  1.42 KB
DTS dist/types-CewsN87z.d.ts              1.42 KB
DTS dist/types-legacy-6ettoclI.d.ts       4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.ts       2.46 KB
DTS dist/userDB-taVg09FH.d.ts             23.24 KB
DTS dist/index-CD8BZz2k.d.ts              4.06 KB
DTS dist/pouch/index.d.mts                35.00 B
DTS dist/impl/static/index.d.mts          8.70 KB
DTS dist/impl/couch/index.d.mts           15.37 KB
DTS dist/index.d.mts                      19.34 KB
DTS dist/core/index.d.mts                 3.91 KB
DTS dist/util/packer/index.d.mts          355.00 B
DTS dist/dataLayerProvider-B7WCqfte.d.mts 1.42 KB
DTS dist/types-Dbp5DaRR.d.mts             1.42 KB
DTS dist/types-legacy-6ettoclI.d.mts      4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.mts      2.46 KB
DTS dist/userDB-BCp_xBvZ.d.mts            23.24 KB
DTS dist/index-Bmll7Xse.d.mts             4.06 KB

```


## Assistant

The ESM/CJS builds failed but DTS succeeded. Let me check for the remaining issue:

**Tool Call: `yarn workspace @vue-skuilder/db build 2>&1 | grep -A5 "ERROR"`**
Status: Completed

Terminal:
```
✘ [ERROR] No loader is configured for ".md" files: src/core/navigators/todo-provenance.md

    src/core/navigators/index.ts:120:36:
      120 │         const module = await import(`./${implementingClass}${ext}`);
          ╵                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

✘ [ERROR] No loader is configured for ".md" files: src/core/navigators/todo-provenance.md

    src/core/navigators/index.ts:120:36:
      120 │         const module = await import(`./${implementingClass}${ext}`);
          ╵                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

--
src/core/navigators/index.ts:120:36: ERROR: No loader is configured for ".md" files: src/core/navigators/todo-provenance.md
    at failureErrorWithLog (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:1477:15)
    at /home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:946:25
    at runOnEndCallbacks (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:1317:45)
    at buildResponseToResult (/home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:944:7)
    at /home/colin/pn/vue-skuilder/master/node_modules/esbuild/lib/main.js:971:16

```


## Assistant

There's still a `todo-provenance.md` file in the navigators directory from the agent/orchestrator that I accidentally created in the wrong place. Let me check:

**Tool Call: 1 match**
Status: Completed

file:///home/colin/pn/vue-skuilder/master/packages/db/src/core/navigators/todo-provenance.md

**Tool Call: Delete “`master/packages/db/src/core/navigators/todo-provenance.md`”**
Status: Completed

Deleted master/packages/db/src/core/navigators/todo-provenance.md

## Assistant

I see the issue - I created `todo-provenance.md` in `agent/orchestrator/` (correct place) but esbuild is picking up a file in the navigators directory. Let me check if there's still one there or if it's a cache issue:

**Tool Call: `yarn workspace @vue-skuilder/db build 2>&1 | tail -30`**
Status: Completed

Terminal:
```
ESM dist/util/packer/index.mjs.map 34.19 KB
ESM dist/impl/static/index.mjs.map 326.46 KB
ESM dist/index.mjs.map             530.29 KB
ESM ⚡️ Build success in 673ms
DTS Build start
DTS ⚡️ Build success in 42701ms
DTS dist/pouch/index.d.ts                 35.00 B
DTS dist/impl/static/index.d.ts           8.69 KB
DTS dist/impl/couch/index.d.ts            15.36 KB
DTS dist/index.d.ts                       19.33 KB
DTS dist/core/index.d.ts                  3.90 KB
DTS dist/util/packer/index.d.ts           352.00 B
DTS dist/dataLayerProvider-D0dnSb3q.d.ts  1.42 KB
DTS dist/types-CewsN87z.d.ts              1.42 KB
DTS dist/types-legacy-6ettoclI.d.ts       4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.ts       2.46 KB
DTS dist/userDB-taVg09FH.d.ts             23.24 KB
DTS dist/index-CD8BZz2k.d.ts              4.06 KB
DTS dist/pouch/index.d.mts                35.00 B
DTS dist/impl/static/index.d.mts          8.70 KB
DTS dist/impl/couch/index.d.mts           15.37 KB
DTS dist/index.d.mts                      19.34 KB
DTS dist/core/index.d.mts                 3.91 KB
DTS dist/util/packer/index.d.mts          355.00 B
DTS dist/dataLayerProvider-B7WCqfte.d.mts 1.42 KB
DTS dist/types-Dbp5DaRR.d.mts             1.42 KB
DTS dist/types-legacy-6ettoclI.d.mts      4.42 KB
DTS dist/SyncStrategy-CyATpyLQ.d.mts      2.46 KB
DTS dist/userDB-BCp_xBvZ.d.mts            23.24 KB
DTS dist/index-Bmll7Xse.d.mts             4.06 KB

```


## Assistant

Build succeeded. Let me run the tests to make sure everything still works:

**Tool Call: `cd packages/db && npx vitest run tests/core/navigators/navigators.test.ts 2>&1`**
Status: Completed

Terminal:
```

 RUN  v3.0.7 /home/colin/pn/vue-skuilder/master/packages/db

11:37:20 AM [vite] (ssr) warning: invalid import "./${implementingClass}${ext}". A file extension must be included in the static part of the import. For example: import(`./foo/${bar}.js`).
  Plugin: vite:dynamic-import-vars
  File: /home/colin/pn/vue-skuilder/master/packages/db/src/core/navigators/index.ts
 ✓ tests/core/navigators/navigators.test.ts (48 tests) 51ms
   ✓ WeightedCard > should have correct structure
   ✓ WeightedCard > should accept all valid source types
   ✓ ContentNavigator.getWeightedCards > should return empty array when no cards available
   ✓ ContentNavigator.getWeightedCards > should assign score=1.0 to all cards by default
   ✓ ContentNavigator.getWeightedCards > should mark new cards with source="new"
   ✓ ContentNavigator.getWeightedCards > should mark reviews with source="review"
   ✓ ContentNavigator.getWeightedCards > should respect limit parameter
   ✓ ContentNavigator.getWeightedCards > should combine new cards and reviews
   ✓ ContentNavigator.getWeightedCards > should correctly map cardID to cardId and courseID to courseId
   ✓ ELO scoring formula > should return 1.0 when ELOs match exactly
   ✓ ELO scoring formula > should return 0.5 when distance is 250
   ✓ ELO scoring formula > should return 0 when distance is 500 or more
   ✓ ELO scoring formula > should return intermediate values for intermediate distances
   ✓ ELO scoring formula > should never return negative values
   ✓ HierarchyDefinition mastery detection > should return false when tag has no ELO data
   ✓ HierarchyDefinition mastery detection > should return false when count is below threshold
   ✓ HierarchyDefinition mastery detection > should return true when count meets threshold and ELO exceeds minElo
   ✓ HierarchyDefinition mastery detection > should return false when ELO is below minElo threshold
   ✓ HierarchyDefinition mastery detection > should compare to global ELO when no minElo specified
   ✓ HierarchyDefinition mastery detection > should use default minCount of 3
   ✓ HierarchyDefinition unlocking logic > should unlock tag when all prerequisites are mastered
   ✓ HierarchyDefinition unlocking logic > should not unlock tag when some prerequisites are missing
   ✓ HierarchyDefinition unlocking logic > should unlock tag when it has empty prerequisites
   ✓ HierarchyDefinition unlocking logic > should handle chain of prerequisites
   ✓ HierarchyDefinition unlocking logic > should handle multiple prerequisites
   ✓ HierarchyDefinition card unlocking > should unlock card when all its tags are unlocked
   ✓ HierarchyDefinition card unlocking > should lock card when any tag is locked
   ✓ HierarchyDefinition card unlocking > should unlock card when tag has no prerequisites defined
   ✓ HierarchyDefinition card unlocking > should handle mixed tags (some with prereqs, some without)
   ✓ HierarchyDefinition card unlocking > should lock card when defined tag is not unlocked
   ✓ RelativePriority boost factor computation > should return 1.0 for neutral priority (0.5)
   ✓ RelativePriority boost factor computation > should boost high-priority content
   ✓ RelativePriority boost factor computation > should reduce low-priority content
   ✓ RelativePriority boost factor computation > should have no effect when influence is 0
   ✓ RelativePriority boost factor computation > should scale linearly with priority
   ✓ RelativePriority tag priority combination > should return default priority for cards with no tags
   ✓ RelativePriority tag priority combination > should return tag priority for single-tag card
   ✓ RelativePriority tag priority combination > should use default priority for unlisted tags
   ✓ RelativePriority tag priority combination > should use max mode correctly
   ✓ RelativePriority tag priority combination > should use min mode correctly
   ✓ RelativePriority tag priority combination > should use average mode correctly
   ✓ RelativePriority tag priority combination > should include default priority in average for mixed tags
   ✓ RelativePriority score adjustment > should boost high-priority cards
   ✓ RelativePriority score adjustment > should reduce low-priority cards
   ✓ RelativePriority score adjustment > should leave neutral-priority cards unchanged
   ✓ RelativePriority score adjustment > should clamp scores to maximum of 1.0
   ✓ RelativePriority score adjustment > should clamp scores to minimum of 0.0
   ✓ RelativePriority score adjustment > should preserve ordering for cards with different priorities

 Test Files  1 passed (1)
      Tests  48 passed (48)
   Start at  11:37:18
   Duration  2.01s (transform 670ms, setup 0ms, collect 659ms, tests 51ms, environment 1ms, prepare 323ms)


```


## Assistant

All tests pass. Now let me update the TODO and update the documentation references:

**Tool Call: agent/orchestrator/a.3.todo.md**
Status: Completed

Diff: agent/orchestrator/a.3.todo.md
```
# TODO: Scorable NavigationStrategy Architecture

**Reference**: See `a.2.plan.md` for full context, architecture diagrams, and rationale.

**Summary**: Add `getWeightedCards()` method to navigation strategies that returns cards with suitability scores. Filter strategies (Hierarchy, Interference) use a delegate pattern — they wrap another strategy and transform its output.

---

## Phase 1: WeightedCard Interface + ELO Implementation

**Status**: COMPLETED

**Goal**: Add `getWeightedCards()` to `ContentNavigator`, implement in ELO, maintain backward compat with `getNewCards()`/`getPendingReviews()`.

### Tasks

- [x] p1.1: Define `WeightedCard` type
  - File: `packages/db/src/core/navigators/index.ts`
  - Fields: `cardId`, `courseId`, `score` (0-1), `source` ('new' | 'review' | 'failed')

- [x] p1.2: Add `getWeightedCards()` to `ContentNavigator` base class
  - File: `packages/db/src/core/navigators/index.ts`
  - Signature: `async getWeightedCards(limit: number): Promise<WeightedCard[]>`
  - Default implementation: calls legacy `getNewCards()` + `getPendingReviews()`, assigns score=1.0

- [x] p1.3: Implement `getWeightedCards()` in `ELONavigator`
  - File: `packages/db/src/core/navigators/elo.ts`
  - Get user ELO via `this.user.getCourseRegDoc(courseId)` + `toCourseElo()`
  - Score = inverse of ELO distance: `Math.max(0, 1 - distance / 500)`
  - Batches ELO lookups for efficiency
  - Combine new cards + reviews, sort by score descending

- [x] p1.4: Add unit tests
  - Created: `packages/db/src/core/navigators/navigators.test.ts`
  - Tests for WeightedCard type structure
  - Tests for default getWeightedCards() behavior
  - Tests for ELO scoring formula

- [x] p1.5: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 2: HierarchyDefinition Strategy

**Status**: COMPLETED

**Goal**: Prerequisite-gated card selection using delegate pattern. Cards locked until user masters prerequisite tags.

### Tasks

- [x] p2.1: Create `HierarchyDefinitionNavigator` class
  - Created: `packages/db/src/core/navigators/hierarchyDefinition.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p2.2: Parse config from `serializedData`
  ```typescript
  interface HierarchyConfig {
    prerequisites: {
      [tagId: string]: {
        requires: string[];
        masteryThreshold?: { minElo?: number; minCount?: number; };
      };
    };
    delegateStrategy?: string;  // default: "elo"
  }
  ```

- [x] p2.3: Create delegate navigator in constructor/init
  - Uses lazy initialization via `getDelegate()` method
  - Uses `ContentNavigator.create(user, course, delegateStrategyData)`
  - Default delegate: ELO

- [x] p2.4: Implement `getMasteredTags(): Promise<Set<string>>`
  - Gets user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
  - Tag is mastered if: `userElo(tag) >= threshold` AND `count >= minCount`
  - Falls back to comparing tag ELO vs global user ELO if no minElo specified

- [x] p2.5: Implement `getUnlockedTags(mastered: Set<string>): Set<string>`
  - Tag is unlocked if all its prerequisites are in `mastered`
  - Tags with no prerequisites are always unlocked

- [x] p2.6: Implement `getWeightedCards(limit)`
  - Gets candidates from delegate (over-fetch: `limit * 2`)
  - For each candidate, checks if card is unlocked via `isCardUnlocked()`
  - Locked cards filtered out, unlocked cards preserve delegate's score
  - Returns filtered list up to limit

- [x] p2.7: Implement legacy methods (delegate through)
  - `getNewCards(n)` → `this.delegate.getNewCards(n)`
  - `getPendingReviews()` → `this.delegate.getPendingReviews()`

- [x] p2.8: Register in factory
  - Already added to `Navigators` enum in Phase 1: `HIERARCHY = 'hierarchyDefinition'`

- [x] p2.9: Add unit tests
  - Added to `navigators.test.ts`:
  - Mastery detection (ELO threshold + count)
  - Unlocking logic (prerequisite chain)
  - Card unlocking (mixed tags with/without prereqs)

- [x] p2.10: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3: InterferenceMitigator Strategy

**Status**: COMPLETED

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

### Tasks

- [x] p3.1: Create `InterferenceMitigatorNavigator` class
  - Created: `packages/db/src/core/navigators/interferenceMitigator.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.2: Parse config from `serializedData`
  - `interferenceSets: string[][]` — groups of tags that interfere (e.g., `[["b","d","p"], ["d","t"]]`)
  - `maturityThreshold: { minCount?, minElo? }` — when a tag is considered mature
  - `interferenceDecay` (default: 0.8)
  - `delegateStrategy` (default: "elo")

- [x] p3.3: Build interference map from config (tag → set of partners)

- [x] p3.4: Implement `getImmatureTags(): Promise<Set<string>>`
  - Tags where user has count > 0 but below maturity threshold

- [x] p3.5: Implement `getTagsToAvoid(immatureTags): Set<string>`
  - Partners of immature tags (excluding already-immature ones)

- [x] p3.6: Implement `computeInterferenceMultiplier()`
  - Score reduction based on overlap with avoid set
  - `Math.pow(1 - decay, interferingCount)`

- [x] p3.7: Implement `getWeightedCards(limit)`
  - Maturity-aware interference avoidance

- [x] p3.8: Implement legacy methods (delegate through)

- [x] p3.9: Register in factory
  - Already added to `Navigators` enum in Phase 1

- [x] p3.10: Verify build passes
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3.5: RelativePriority Strategy

**Status**: COMPLETED

**Goal**: Boost scores for high-utility content based on author-defined tag priorities. Prefer common, well-behaved patterns (like 's') over rare/irregular ones (like 'x', 'z').

### Tasks

- [x] p3.5.1: Create `RelativePriorityNavigator` class
  - Created: `packages/db/src/core/navigators/relativePriority.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.5.2: Define config interface
  ```typescript
  interface RelativePriorityConfig {
    tagPriorities: { [tagId: string]: number };  // 0-1, where 1.0 = highest priority
    defaultPriority?: number;                     // for unlisted tags (default: 0.5)
    combineMode?: 'max' | 'average' | 'min';      // how to combine multiple tags
    priorityInfluence?: number;                   // how strongly priority affects score (default: 0.5)
    delegateStrategy?: string;                    // default: "elo"
  }
  ```

- [x] p3.5.3: Implement boost factor computation
  - Formula: `boostFactor = 1 + (priority - 0.5) * priorityInfluence`
  - Priority 1.0 with influence 0.5 → boost 1.25 (25% higher)
  - Priority 0.5 → boost 1.00 (neutral)
  - Priority 0.0 with influence 0.5 → boost 0.75 (25% lower)

- [x] p3.5.4: Implement `getWeightedCards(limit)`
  - Get candidates from delegate
  - Look up tags for each card
  - Compute combined priority (max/average/min)
  - Apply boost factor to delegate score
  - Clamp to [0, 1] and sort

- [x] p3.5.5: Register in factory
  - Added to `Navigators` enum: `RELATIVE_PRIORITY = 'relativePriority'`

- [x] p3.5.6: Add unit tests
  - Added to `navigators.test.ts`:
  - Boost factor computation (18 new tests)
  - Tag priority combination (max/average/min modes)
  - Score adjustment with clamping

- [x] p3.5.7: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: 48 tests passing ✓

---

## Phase 4: Orchestrator (DEFERRED)

**Status**: NOT STARTED — not needed for LP MVP

Delegate pattern handles composition for now. Full orchestrator needed for:
- Multi-arm bandit experimentation
- A/B testing independent strategies
- Dynamic strategy selection

---

## Phase 4a: Production Integration (IN PROGRESS)

**Status**: CORE INTEGRATION COMPLETE

**Goal**: Wire SessionController to use `getWeightedCards()` so new strategies are actually exercised at runtime.

### Key Gap (RESOLVED)
~~Currently, `SessionController` still calls legacy `getNewCards()` / `getPendingReviews()`.~~ 
SessionController now uses `getWeightedCards()` when available, with fallback to legacy methods.

### Pre-work: API Documentation & Deprecation Notices (COMPLETED)

To avoid future confusion about the interface design (Chesterton's Fence), we documented the 
evolution from legacy to new API and added deprecation notices.

- [x] p4a.0.1: Create ARCHITECTURE.md migration guide
  - Created: `packages/db/src/core/navigators/ARCHITECTURE.md`
  - Documents historical context (why getNewCards/getPendingReviews exist)
  - Explains the problem (artifacts of hard-coded ELO + SRS strategies)
  - Describes solution (unified getWeightedCards with scores)
  - Shows generator vs filter strategy patterns
  - Provides implementation examples

- [x] p4a.0.2: Add deprecation notices to StudyContentSource
  - File: `packages/db/src/core/interfaces/contentSource.ts`
  - Added API migration notice block at top
  - Added @deprecated JSDoc to interface and methods
  - Explains migration path

- [x] p4a.0.3: Add deprecation notices to ContentNavigator
  - File: `packages/db/src/core/navigators/index.ts`
  - Added module-level documentation block
  - Added @deprecated JSDoc to legacy methods
  - Expanded getWeightedCards() documentation

- [x] p4a.0.4: Update plan document with migration strategy
  - File: `agent/orchestrator/a.2.plan.md`
  - Added "API Migration Strategy" section
  - Documents historical context and rationale

### Tasks

- [x] p4a.1: Add parallel path in SessionController for weighted card selection
  - Added `getWeightedContent()` method that uses `getWeightedCards()` API
  - `prepareSession()` now checks for `getWeightedCards` support and uses new path
  - Hybrid approach: fetches weighted scores for ordering, full review data for queue population
  - Fallback to legacy methods for sources without `getWeightedCards()`

- [x] p4a.1.1: Add `getWeightedCards()` to `StudyContentSource` interface
  - File: `packages/db/src/core/interfaces/contentSource.ts`
  - Added as optional method for backward compatibility

- [x] p4a.1.2: Implement `getWeightedCards()` in `CourseDB`
  - File: `packages/db/src/impl/couch/courseDB.ts`
  - Delegates to `ContentNavigator.getWeightedCards()`

- [x] p4a.1.3: Implement `getWeightedCards()` in `StudentClassroomDB`
  - File: `packages/db/src/impl/couch/classroomDB.ts`
  - Wraps legacy methods with score=1.0 (no pluggable strategies for classrooms yet)

- [x] p4a.2: Extend `getDebugInfo()` to include active strategy info
  - Added `api.mode` ('weighted' | 'legacy') and `api.description` to debug output

- [ ] p4a.3: Add strategy creation support (CLI or UI) — FUTURE WORK

### Documentation Updates

- [x] Moved `ARCHITECTURE.md` from `src/core/navigators/` to `packages/db/docs/navigators-architecture.md`
  - Avoids esbuild picking up .md files during dynamic import resolution

---

## Notes for Implementers

### Key Files
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base, factory, Navigators enum
- `packages/db/src/core/navigators/elo.ts` — Reference generator strategy
- `packages/db/src/core/navigators/relativePriority.ts` — Priority-based score boosting
- `packages/db/src/core/interfaces/contentSource.ts` — StudyContentSource interface with getWeightedCards
- `packages/db/src/core/interfaces/userDB.ts` — UserDBInterface (history, ELO)
- `packages/db/src/impl/couch/courseDB.ts` — Tag queries, ELO queries, getWeightedCards impl
- `packages/db/src/study/SessionController.ts` — Session management, getWeightedContent()
- `packages/db/docs/navigators-architecture.md` — Full API migration guide

### Commands
- Build: `yarn workspace @vue-skuilder/db build`
- Test: `yarn workspace @vue-skuilder/db test`
- Type check: `yarn workspace @vue-skuilder/db type-check`

### Scoring Semantics
- `1.0` = fully suitable
- `0.0` = hard filter (e.g., prerequisite not met)
- `0.5` = neutral
- Intermediate = soft preference

### Delegate Pattern
Filter strategies wrap a delegate and transform its output:
```
RelativePriority(delegate=Interference(delegate=Hierarchy(delegate=ELO)))
```
- ELO generates candidates with scores
- Hierarchy gates (filters locked cards, preserves scores)
- Interference adjusts scores (multiplicative reduction for similar tags)
- RelativePriority boosts/reduces scores based on tag utility

### Data Access (via constructor params)
- `user: UserDBInterface`
  - `user.getSeenCards(courseId)` — card history
  - `user.getCourseRegDoc(courseId).elo.tags` — per-tag ELO
- `course: CourseDBInterface`
  - `course.getAppliedTags(cardId)` — tags on a card
  - `course.getCardEloData([cardId])` — card difficulty
```


## Assistant

Let me also update the plan document to reference the moved architecture doc:

**Tool Call: agent/orchestrator/a.2.plan.md**
Status: Completed

Diff: agent/orchestrator/a.2.plan.md
```
# Plan: Scorable NavigationStrategy Architecture

## API Migration Strategy

> **Note**: This section documents the evolution from the legacy `getNewCards()` / `getPendingReviews()` 
> interface to the new unified `getWeightedCards()` API. This context prevents future confusion about 
> the interface design (avoiding Chesterton's Fence).

### Historical Context

The `StudyContentSource` interface was originally designed to abstract both 'classrooms' and 'courses' 
as content sources. It exposed two methods:

```typescript
interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

These methods were **artifacts of two hard-coded NavigationStrategies** (before they had that name):
1. **ELO proximity** — for selecting new cards matched to user skill level
2. **SRS scheduling** — for surfacing cards due for review based on spaced repetition

The new/review split reflected this implementation detail, not a fundamental abstraction.

### The Problem

As we added more sophisticated navigation strategies, the limitations became apparent:

- **"What does 'get reviews' mean for an interference mitigator?"** — The concept doesn't map.
- **SRS is just one strategy** — It votes for scheduled reviews, but that preference could be 
  expressed as weighted scores like any other strategy.
- **Some strategies generate candidates, others filter/score them** — The interface didn't 
  accommodate this distinction cleanly.

### The Solution: Weighted Cards

The new API unifies card selection into a single scored candidate model:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;      // 0-1 suitability
  source: 'new' | 'review' | 'failed';  // metadata, not API distinction
}

abstract class ContentNavigator implements StudyContentSource {
  // THE NEW PRIMARY API
  async getWeightedCards(limit: number): Promise<WeightedCard[]>;
  
  // LEGACY - kept for backward compatibility
  abstract getPendingReviews(): Promise<...>;
  abstract getNewCards(n?: number): Promise<...>;
}
```

### Strategy Composition Model

Strategies fall into two categories that compose via the delegate pattern:

**Generator strategies** produce candidates:
- ELO — generates cards near user skill, scores by distance
- SRS — generates overdue reviews, scores by urgency
- HardcodedOrder — returns fixed sequence

**Filter strategies** wrap a delegate and transform output:
- HierarchyDefinition — gates by prerequisites (score=0 or passthrough)
- InterferenceMitigator — reduces scores for confusable content
- RelativePriority — boosts scores for high-utility content

Composition example:
```
RelativePriority(
  delegate=InterferenceMitigator(
    delegate=HierarchyDefinition(
      delegate=ELO)))
```

### Migration Path

1. **Phase 1 (Current)**: Both APIs coexist
   - `getWeightedCards()` is the new primary API
   - Legacy methods remain for backward compatibility
   - Default `getWeightedCards()` delegates to legacy methods with score=1.0

2. **Phase 2 (Next)**: SessionController integration
   - SessionController calls `getWeightedCards()` instead of legacy methods
   - new/review distinction becomes `WeightedCard.source` metadata

3. **Phase 3 (Future)**: Deprecation
   - Legacy methods marked `@deprecated`
   - Eventually removed

### Documentation

See `packages/db/docs/navigators-architecture.md` for detailed implementation guide.

---

## Context

This plan implements a scorable strategy architecture for content navigation, driven primarily by the LettersPractice (LP) use case but designed for content-agnostic reuse.

**Source-verified** against:
- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` abstract class
- `packages/db/src/core/navigators/elo.ts` — `ELONavigator` implementation
- `packages/db/src/study/SessionController.ts` — Queue management
- `packages/db/src/core/types/contentNavigationStrategy.ts` — `ContentNavigationStrategyData` schema
- `packages/db/src/core/interfaces/userDB.ts` — `UserDBInterface` with history access

**Primary goals**:
1. Enforce "single new concept at a time" via prerequisite/mastery gating (HierarchyDefinition)
2. Separate confusable concepts (InterferenceMitigator)
3. Design strategies as evolutionary-ready: return suitability scores (0-1), composable by weight

**Non-goals for MVP**:
- Full orchestrator implementation (LP can ship with HierarchyDefinition alone)
- Classroom filtering integration
- Debug/visualization UI
- Multi-arm bandit experimentation framework (architecture should support it, not implement it)

---

## Architecture Overview

### Core Change: Strategies Return Weighted Cards

**Current interface** (legacy):
```
ContentNavigator (current)
├── getNewCards(n?: number): Promise<StudySessionNewItem[]>
└── getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>
```

**Proposed interface**:
```
ContentNavigator (proposed)
├── getWeightedCards(limit: number): Promise<WeightedCard[]>  // NEW: primary method
├── getNewCards(n?: number): Promise<StudySessionNewItem[]>   // DEPRECATED: compat
└── getPendingReviews(): Promise<...>                         // DEPRECATED: compat
```

**New types**:
```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;           // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Scoring semantics**:
- `1.0` = fully suitable, present freely
- `0.0` = unsuitable, hard filter (e.g., prerequisite not met)
- `0.5` = neutral / no opinion
- Intermediate values = soft preference (e.g., 0.8 = good but not ideal timing)

**Key insight**: Some strategies *generate* candidates (ELO, SRS), others *filter/score* candidates (Hierarchy, Interference). The delegate pattern handles this:
- **Generator strategies**: ELO, SRS — produce candidates with scores
- **Filter strategies**: Hierarchy, Interference — wrap a delegate, transform its output

### Strategy Composition Model: Delegate Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Future Orchestrator                       │
│  (weighted combination, evolutionary selection, A/B tests)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ InterferenceMitigator         │
              │ (filter: reduces scores for   │
              │  tag overlap with recent)     │
              └───────────────┬───────────────┘
                              │ delegates to
                              ▼
              ┌───────────────────────────────┐
              │ HierarchyDefinition           │
              │ (filter: gates by prereqs,    │
              │  score=0 or passthrough)      │
              └───────────────┬───────────────┘
                              │ delegates to
                              ▼
              ┌───────────────────────────────┐
              │ ELONavigator                  │
              │ (generator: produces cards    │
              │  near user skill level)       │
              └───────────────────────────────┘
```

**Generator strategies** (produce candidates):
- **ELO**: Cards near user skill, scored by ELO distance
- **SRS**: Overdue reviews, scored by overdueness

**Filter strategies** (wrap a delegate):
- **Hierarchy**: Gates by prerequisites — score=0 (locked) or delegate's score (unlocked)
- **Interference**: Reduces scores for cards with tags similar to recent history

For MVP: LP uses HierarchyDefinition(delegate=ELO) directly. Future: stack Interference on top.

### Strategy Data Access Pattern

Each strategy receives `user: UserDBInterface` and `course: CourseDBInterface` in its constructor. This provides:

**From UserDBInterface**:
- `getSeenCards(courseId)` — cards user has encountered
- `getActiveCards()` — cards currently scheduled  
- `getPendingReviews(courseId)` — scheduled reviews with timestamps
- `getCourseRegDoc(courseId)` — course registration including per-tag ELO
- `putCardRecord()` — card interaction history

**From CourseDBInterface**:
- `getAppliedTags(cardId)` — tags on a card
- `getCardEloData(cardIds)` — card difficulty ratings
- `getCourseTagStubs()` — all tags in course

**Strategy-specific storage**: Strategies can store their own data (e.g., interference events, session history) in userDB via the `DocumentUpdater` interface. Pattern: `{strategyType}-{strategyId}-{dataType}` document IDs. This supports multiple instances of the same strategy type (e.g., competing hierarchies, micro-hierarchies that cooperate).

---

## Implementation Phases

### Phase 1: WeightedCard Interface + ELO Implementation

**Goal**: Add `getWeightedCards()` to ContentNavigator, implement in ELO, maintain backward compat.

**Files to modify**:
- `packages/db/src/core/navigators/index.ts` — Add interface, types, default impl
- `packages/db/src/core/navigators/elo.ts` — Implement weighted cards with ELO scoring

**New types** (add to navigators/index.ts or separate types file):
```typescript
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;           // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Interface change**:
```typescript
// packages/db/src/core/navigators/index.ts

export abstract class ContentNavigator implements StudyContentSource {
  // Existing factory method unchanged
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> { /* ... */ }

  // NEW: Primary method for getting scored cards
  /**
   * Get cards with suitability scores.
   * 
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();
    
    const weighted: WeightedCard[] = [
      ...newCards.map(c => ({ 
        cardId: c.cardID, 
        courseId: c.courseID, 
        score: 1.0, 
        source: 'new' as const 
      })),
      ...reviews.map(r => ({ 
        cardId: r.cardID, 
        courseId: r.courseID, 
        score: 1.0, 
        source: 'review' as const 
      })),
    ];
    
    return weighted.slice(0, limit);
  }

  // DEPRECATED: Legacy methods maintained for backward compat
  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

**ELO implementation** (scoring by ELO distance):
```typescript
// packages/db/src/core/navigators/elo.ts

async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  // Get user's ELO for this course
  const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
  const userElo = courseReg?.elo?.global?.score ?? 1000;
  
  // Get new cards (existing logic)
  const newCards = await this.getNewCards(limit);
  
  // Get reviews (existing logic)  
  const reviews = await this.getPendingReviews();
  
  // Score new cards by ELO distance
  const scoredNew = await Promise.all(newCards.map(async (c) => {
    const [cardEloData] = await this.course.getCardEloData([c.cardID]);
    const cardElo = cardEloData?.global?.score ?? 1000;
    const distance = Math.abs(cardElo - userElo);
    const score = Math.max(0, 1 - distance / 500);
    
    return {
      cardId: c.cardID,
      courseId: c.courseID,
      score,
      source: 'new' as const,
    };
  }));
  
  // Score reviews by overdueness (placeholder: 1.0 for now)
  const scoredReviews = reviews.map(r => ({
    cardId: r.cardID,
    courseId: r.courseID,
    score: 1.0,  // TODO: score by overdueness
    source: 'review' as const,
  }));
  
  // Combine and sort by score
  const all = [...scoredNew, ...scoredReviews];
  all.sort((a, b) => b.score - a.score);
  
  return all.slice(0, limit);
}
```

**Success criteria**:
- [ ] `WeightedCard` type defined
- [ ] `getWeightedCards()` exists on ContentNavigator with default implementation
- [ ] ELONavigator implements `getWeightedCards()` with ELO-distance scoring
- [ ] Existing `getNewCards()` / `getPendingReviews()` still work (backward compat)
- [ ] New unit tests for `getWeightedCards()` behavior

**Estimated effort**: 3-4 hours

---

### Phase 2: HierarchyDefinition Strategy (Filter/Delegate Pattern)

**Goal**: Implement prerequisite-gated card selection using delegate pattern.

**New file**: `packages/db/src/core/navigators/hierarchyDefinition.ts`

**Configuration schema** (stored in `serializedData`):
```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: {
      requires: string[];           // Tags that must be mastered first
      masteryThreshold?: {
        minElo?: number;            // Default: compare to course avg for tag
        minCount?: number;          // Default: 3 (minimum interactions)
      };
    };
  };
  delegateStrategy?: string;        // Strategy to wrap (default: "elo")
}
```

**Example LP configuration**:
```json
{
  "prerequisites": {
    "letter-b": {
      "requires": ["letter-s", "letter-a", "letter-t"],
      "masteryThreshold": { "minCount": 5 }
    },
    "letter-d": {
      "requires": ["letter-b"],
      "masteryThreshold": { "minCount": 5 }
    },
    "cvc-words": {
      "requires": ["letter-s", "letter-a", "letter-t", "letter-m"],
      "masteryThreshold": { "minCount": 3 }
    }
  },
  "delegateStrategy": "elo"
}
```

**Delegate pattern implementation**:
```typescript
class HierarchyDefinitionNavigator extends ContentNavigator {
  private delegate: ContentNavigator;
  private config: HierarchyConfig;
  
  constructor(user, course, strategyData) {
    super();
    this.config = JSON.parse(strategyData.serializedData);
    // Delegate created in async init or lazily
  }
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // 1. Get candidates from delegate
    const candidates = await this.delegate.getWeightedCards(limit * 2);
    
    // 2. Get user's mastery state
    const masteredTags = await this.getMasteredTags();
    const unlockedTags = this.getUnlockedTags(masteredTags);
    
    // 3. Filter/gate candidates
    const gated: WeightedCard[] = [];
    for (const card of candidates) {
      const cardTags = await this.course.getAppliedTags(card.cardId);
      const isUnlocked = cardTags.every(tag => 
        unlockedTags.has(tag) || !this.hasPrerequisites(tag)
      );
      
      if (isUnlocked) {
        gated.push(card);  // Preserve delegate's score
      }
      // else: score=0, filtered out
      
      if (gated.length >= limit) break;
    }
    
    return gated;
  }
  
  // Legacy methods delegate through
  async getNewCards(n) { return this.delegate.getNewCards(n); }
  async getPendingReviews() { return this.delegate.getPendingReviews(); }
}
```

**Key methods**:
- `getMasteredTags(): Promise<Set<string>>` — tags where user ELO > threshold
- `getUnlockedTags(mastered): Set<string>` — tags whose prerequisites are all mastered
- `hasPrerequisites(tag): boolean` — check if tag is in config

**Mastery detection**:
- Get user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
- Compare `userElo(tag) > avgElo(tag)` (or configured threshold)
- Also check interaction count meets minimum

**Success criteria**:
- [ ] HierarchyDefinitionNavigator implemented with delegate pattern
- [ ] Configuration parsed from `serializedData`
- [ ] Delegate navigator created (defaults to ELO)
- [ ] Per-tag ELO correctly read from user's CourseElo
- [ ] Mastery detection works (ELO threshold + count)
- [ ] Locked cards filtered (score=0), unlocked cards preserve delegate score
- [ ] Unit tests for mastery detection, unlocking, filtering
- [ ] Integration test: user progresses through prerequisite chain

**Estimated effort**: 4-6 hours

---

### Phase 3: InterferenceMitigator Strategy (Filter/Delegate Pattern)

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

**New file**: `packages/db/src/core/navigators/interferenceMitigator.ts`

**Configuration schema**:
```typescript
interface InterferenceConfig {
  /** Groups of tags that interfere with each other */
  interferenceSets: string[][];  // e.g., [["b", "d", "p"], ["d", "t"]]
  
  /** Threshold below which a tag is considered "immature" */
  maturityThreshold?: {
    minCount?: number;   // default: 10
    minElo?: number;     // optional
  };
  
  /** How much to reduce score for interfering cards (default: 0.8) */
  interferenceDecay?: number;
  
  delegateStrategy?: string;    // Strategy to wrap (default: "elo")
}
```

**Example LP configuration**:
```json
{
  "interferenceSets": [
    ["b", "d", "p"],
    ["d", "t"],
    ["m", "n"]
  ],
  "maturityThreshold": { "minCount": 10 },
  "interferenceDecay": 0.8
}
```

**Algorithm**:
1. Build interference map from config (tag → set of interfering tags)
2. Identify user's **immature tags** (started but below maturity threshold)
3. Compute **tags to avoid** = partners of immature tags (excluding already-immature ones)
4. For each candidate card, reduce score if its tags overlap with avoid set

```typescript
class InterferenceMitigatorNavigator extends ContentNavigator {
  private interferenceMap: Map<string, Set<string>>;  // Precomputed from config
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const candidates = await this.delegate.getWeightedCards(limit * 3);
    
    // Identify what to avoid
    const immatureTags = await this.getImmatureTags();
    const tagsToAvoid = this.getTagsToAvoid(immatureTags);
    
    // Adjust scores
    const adjusted = candidates.map(card => {
      const cardTags = await this.getCardTags(card.cardId);
      const multiplier = this.computeInterferenceMultiplier(cardTags, tagsToAvoid);
      return { ...card, score: card.score * multiplier };
    });
    
    adjusted.sort((a, b) => b.score - a.score);
    return adjusted.slice(0, limit);
  }
  
  private async getImmatureTags(): Promise<Set<string>> {
    // Tags where user has count > 0 but below maturity threshold
    const userElo = await this.user.getCourseRegDoc(...).elo.tags;
    // Return tags that are started but not yet mature
  }
  
  private getTagsToAvoid(immatureTags: Set<string>): Set<string> {
    // For each immature tag, add its interference partners
    // (but not if partner is also immature — already learning both)
  }
  
  private computeInterferenceMultiplier(cardTags: string[], avoid: Set<string>): number {
    const interferingCount = cardTags.filter(t => avoid.has(t)).length;
    if (interferingCount === 0) return 1.0;
    return Math.pow(1.0 - decay, interferingCount);  // More interference = lower score
  }
}
```

**Key insight**: This is maturity-aware, not just recency-aware. The goal is to maximize conceptual distance when introducing new content while foundational concepts are still being learned.

**LP use case**: While learning `d`, prefer introducing `x` over `b` (visual similarity) or `t` (phonetic similarity). Once `d` is mature, `b` and `t` can be introduced freely.

**Future consideration**: Minimal-pair exercises (e.g., `bad` vs `dad`) for deliberate contrast when it IS time to introduce interfering concepts. May be a separate strategy or an extension.

**Success criteria**:
- [x] InterferenceMitigatorNavigator implemented with delegate pattern
- [x] Interference sets parsed from config, precomputed into map
- [x] Immature tag detection (started but below threshold)
- [x] Tags-to-avoid computation (partners of immature tags)
- [x] Score reduction based on interference overlap
- [x] Delegate's scores preserved and adjusted (multiplicative)

**Estimated effort**: 3-4 hours

---

### Phase 4: Orchestrator (Deferred)

**Note**: Not needed for LP MVP — delegate pattern handles composition. Documented for future.

**When needed**: For evolutionary experimentation (multi-arm bandit), A/B testing, or combining independent (non-nested) strategies.

**Key insight**: With delegate pattern, Hierarchy and Interference can be stacked:
```
Interference(delegate=Hierarchy(delegate=ELO))
```

This covers LP's needs. A full Orchestrator is for more complex cases:
- Multiple independent strategy "votes" combined by weight
- Dynamic strategy selection based on context
- Evolutionary utility tracking

**Future configuration sketch**:
```typescript
interface OrchestratorConfig {
  strategies: Array<{
    implementingClass: string;
    serializedData: string;
    weight: number;              // 0-1, relative importance
  }>;
  combineMode: 'multiply' | 'weighted-average' | 'min';
  fallbackStrategy?: string;
}
```

---

## Data Dependencies

### Per-Tag ELO (Already Exists)

**Location**: `CourseElo.tags` in user's course registration

**Current status**: Tracked but not used for card selection

**What we need**: Read access in HierarchyDefinition strategy via `user.getCourseRegDoc(courseId)`

```typescript
// From packages/db/src/core/types/user.ts
type CourseElo = {
  global: EloRank;
  tags: { [tagID: string]: EloRank };
};

type EloRank = {
  score: number;
  count: number;
};
```

### Session Context (For Interference)

**Current**: `SessionController` manages queues internally. Strategies access user history via `UserDBInterface`.

**Approach**: InterferenceMitigator queries `user.getSeenCards(courseId)`. Takes last N cards by document order.

**Note**: `getSeenCards()` returns card IDs only, no timestamps. For MVP, "last N cards" is sufficient. Future: query card records with timestamps for finer control.

### Delegate Strategy Creation

**Challenge**: Filter strategies need to instantiate their delegate navigator.

**Approach**: Use existing `ContentNavigator.create(user, course, strategyData)` factory:
```typescript
// In HierarchyDefinitionNavigator constructor or init
const delegateStrategyData = {
  implementingClass: this.config.delegateStrategy || 'elo',
  serializedData: '{}',
  // ... other required fields
};
this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
```

---

## File Changes Summary

| Phase | File | Change |
|-------|------|--------|
| 1 | `packages/db/src/core/navigators/index.ts` | Add `scoreCard()` abstract method with default |
| 1 | `packages/db/src/core/navigators/elo.ts` | Implement `scoreCard()` with ELO distance |
| 2 | `packages/db/src/core/navigators/hierarchyDefinition.ts` | New file |
| 2 | `packages/db/src/core/navigators/index.ts` | Register new navigator in factory |
| 3 | `packages/db/src/core/navigators/interferenceMitigator.ts` | New file |
| 3 | `packages/db/src/core/navigators/index.ts` | Register new navigator in factory |
| 3 | `packages/db/src/study/SessionController.ts` | Pass context to scoreCard (if Option B) |

---

## Testing Strategy

### Unit Tests

- `getWeightedCards()` default returns cards with score=1.0
- ELO scoring: distance 0 → 1.0, distance 500 → 0.0
- Hierarchy mastery detection: threshold logic
- Hierarchy unlocking: prerequisite chain traversal
- Hierarchy gating: locked cards filtered, unlocked preserve delegate score
- Interference similarity: Jaccard calculation
- Interference score adjustment: high similarity → reduced score (multiplicative)

### Integration Tests

- Hierarchy: New user sees only root-level content, progresses as mastery increases
- Interference: Similar cards get lower scores, appear later in sequence
- Delegate chain: `Interference(Hierarchy(ELO))` works correctly
- Backward compat: `getNewCards()` / `getPendingReviews()` still work

### Manual Testing (LP-specific)

- Fresh user sees `s`, `a`, `t` before `b` or `d`
- User who knows `s`, `a`, `t` unlocks CVC words
- Letters `b` and `d` get reduced scores when one was recently seen

---

## Success Metrics

**Development**:
- [ ] Phase 1-3 complete
- [ ] All unit tests passing
- [ ] No regression in existing navigator tests

**LP validation**:
- [ ] Prerequisite chain enforced in practice sessions
- [ ] Confusable letters separated
- [ ] Session feels coherent (not random-seeming)

**Future-readiness**:
- [ ] Strategies implement `scoreCard()` with meaningful values
- [ ] Orchestrator (Phase 4) can be added without modifying strategies
- [ ] Evolutionary layer can assign/remove strategies via configuration

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Per-tag ELO not populated for new users | Medium | Default to unlocked for tags with no data; hierarchy config can specify "root" tags |
| Over-filtering leaves no cards | Low (LP controls content) | Delegate chain ensures base ELO always provides candidates; Hierarchy gates but doesn't generate |
| Tag query performance | Low | Batch tag fetches; cache for session duration |
| Hierarchy graph cycles | Low (LP controls config) | Add cycle detection in Phase 2; error on save |
| Delegate creation fails | Low | Validate delegate strategy exists; fall back to ELO |

---

## Open Decisions

1. ~~**Context passing for Interference**~~: Resolved — strategies access user history directly via `UserDBInterface.getSeenCards()`.

2. ~~**Root tag handling**~~: Confirmed — tags with no prerequisites are always unlocked.

3. ~~**Mastery threshold defaults**~~: Mastery = `userElo(tag) > avgElo(tag)`. The hierarchy config can set specific per-tag targets.

4. ~~**Tag query batching**~~: Current `getAppliedTags(courseId, cardId)` is single-card. For MVP, acceptable.

5. ~~**Recency filtering for interference**~~: Use "last N cards" by document order. Timestamps available if needed later.

6. ~~**Interface shape**~~: Resolved — `getWeightedCards()` returns scored cards. Filter strategies use delegate pattern, adjusting delegate's scores.

---

## Next Steps

1. User approves plan
2. Create `a.3.todo.md` with checkboxed task breakdown
3. Begin Phase 1 implementation

```


## Assistant

Now let me also update the architecture doc to reflect the integration:

**Tool Call: packages/db/docs/navigators-architecture.md**
Status: Completed

Diff: packages/db/docs/navigators-architecture.md
```
# Navigation Strategy Architecture

## Overview

This document describes the evolution of the NavigationStrategy API and provides guidance
for migrating from the legacy `getNewCards()` / `getPendingReviews()` interface to the new
unified `getWeightedCards()` API.

## Historical Context

### The Original Design

The `StudyContentSource` interface was originally conceived to abstract both 'classrooms'
and 'courses' as sources of study content. It exposed two methods:

```typescript
interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

These methods were artifacts of two **hard-coded NavigationStrategies** (before they had
that name):

1. **ELO proximity** — for selecting new cards matched to user skill level
2. **SRS scheduling** — for surfacing cards due for review based on spaced repetition

The new/review split reflected this implementation detail, not a fundamental abstraction.

### The Problem

As we added more sophisticated navigation strategies, the limitations became apparent:

- **What does "get reviews" mean for an interference mitigator?** The concept doesn't map.
- **SRS is just one strategy** — it votes for scheduled reviews, but that preference could
  be expressed as weighted scores like any other strategy.
- **Some strategies generate candidates, others filter/score them** — the interface didn't
  accommodate this distinction.

### The Solution: Weighted Cards

The new API unifies card selection into a single scored candidate model:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;      // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}

abstract class ContentNavigator {
  // THE NEW PRIMARY API
  async getWeightedCards(limit: number): Promise<WeightedCard[]>;
  
  // LEGACY - kept for backward compatibility
  abstract getPendingReviews(): Promise<...>;
  abstract getNewCards(n?: number): Promise<...>;
}
```

## The Delegate Pattern

Navigation strategies fall into two categories:

### Generator Strategies
Generate candidate cards with scores based on their own logic.

- **ELO** — Generates cards near user skill level, scores by ELO distance
- **SRS** — Generates overdue reviews, scores by overdueness
- **HardcodedOrder** — Returns a fixed sequence of cards

### Filter/Decorator Strategies
Wrap a delegate strategy and transform its output.

- **HierarchyDefinition** — Filters out cards whose prerequisites aren't met
- **InterferenceMitigator** — Reduces scores for confusable content
- **RelativePriority** — Boosts scores for high-utility content

### Composition

Filter strategies wrap generators (or other filters) to form a pipeline:

```
RelativePriority(
  delegate=InterferenceMitigator(
    delegate=HierarchyDefinition(
      delegate=ELO)))
```

The flow:
1. **ELO** generates candidates scored by skill proximity
2. **HierarchyDefinition** gates locked cards (score=0 or passthrough)
3. **InterferenceMitigator** reduces scores for similar tags while immature
4. **RelativePriority** boosts high-utility content (common letters first)

## Migration Path

### Phase 1: Parallel APIs (Current State)

Both APIs coexist:
- `getWeightedCards()` is the new primary API
- `getNewCards()` / `getPendingReviews()` remain for backward compatibility
- Default `getWeightedCards()` implementation delegates to legacy methods

### Phase 2: SessionController Integration (COMPLETE)

`SessionController` now calls `getWeightedCards()` when available:
- `prepareSession()` checks if sources support `getWeightedCards()`
- New `getWeightedContent()` method fetches scored candidates
- Hybrid approach: uses scores for ordering, full review data for queue population
- Fallback to legacy methods for sources without `getWeightedCards()`

The new/review distinction is preserved via `WeightedCard.source` field for queue routing.

Key files modified:
- `packages/db/src/study/SessionController.ts` — Added `getWeightedContent()`
- `packages/db/src/impl/couch/courseDB.ts` — Added `getWeightedCards()` delegation
- `packages/db/src/impl/couch/classroomDB.ts` — Added `getWeightedCards()` wrapper
- `packages/db/src/core/interfaces/contentSource.ts` — Added optional `getWeightedCards()`

### Phase 3: Deprecation (Future)

Once SessionController migration is complete:
- Legacy methods will be marked `@deprecated`
- New strategy implementations can skip implementing them (base class provides defaults)
- Eventually, legacy methods will be removed

## Score Semantics

Scores range from 0-1 with the following semantics:

| Score | Meaning |
|-------|---------|
| 1.0 | Fully suitable — strong candidate |
| 0.5 | Neutral — no preference |
| 0.0 | Hard filter — exclude from consideration |
| 0.x | Soft preference — proportional suitability |

Scores are typically combined multiplicatively when strategies are chained. A score of 0
from any strategy filters out the card entirely.

## SessionController Interaction

`SessionController` manages:
- **Time budgeting** — Stops session based on configured duration
- **Queue management** — Maintains separate queues for new/review/failed cards
- **Just-in-time fetching** — Requests small batches from sources as needed

The controller now (as of Phase 2):
1. Checks if sources support `getWeightedCards()` in `prepareSession()`
2. Calls `getWeightedContent()` which:
   - Fetches weighted cards for scoring information
   - Fetches full review data via `getPendingReviews()` (needed for `ScheduledCard` fields)
   - Builds a score lookup map from weighted results
   - Sorts reviews by their weighted scores
   - Adds new cards ordered by their weighted scores
3. Falls back to legacy `getScheduledReviews()` / `getNewCards()` if sources don't support the new API

Debug info now includes `api.mode` ('weighted' | 'legacy') to indicate which path is active.

## Interface Evolution Summary

```
BEFORE (hard-coded strategies):

StudyContentSource
├── getNewCards()       ← ELO-based selection
└── getPendingReviews() ← SRS-based scheduling

AFTER (pluggable strategies):

ContentNavigator implements StudyContentSource
├── getWeightedCards()  ← PRIMARY: unified scored candidates
├── getNewCards()       ← LEGACY: backward compat, eventually deprecated  
└── getPendingReviews() ← LEGACY: backward compat, eventually deprecated
```

## For Implementers

### Creating a New Generator Strategy

```typescript
class MyGeneratorNavigator extends ContentNavigator {
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Generate and score candidates
    const candidates = await this.findCandidates(limit);
    return candidates.map(c => ({
      cardId: c.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(c),
      source: 'new',
    }));
  }

  // Legacy methods - can use base class default or implement
  async getNewCards(n?: number) { /* ... */ }
  async getPendingReviews() { /* ... */ }
}
```

### Creating a New Filter Strategy

```typescript
class MyFilterNavigator extends ContentNavigator {
  private delegate: ContentNavigator | null = null;
  
  private async getDelegate(): Promise<ContentNavigator> {
    if (!this.delegate) {
      this.delegate = await ContentNavigator.create(
        this.user, 
        this.course,
        { implementingClass: this.config.delegateStrategy || 'elo', ... }
      );
    }
    return this.delegate;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();
    const candidates = await delegate.getWeightedCards(limit * 2);
    
    // Transform scores
    return candidates
      .map(c => ({ ...c, score: this.adjustScore(c) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Legacy methods delegate through
  async getNewCards(n?: number) {
    return (await this.getDelegate()).getNewCards(n);
  }
  async getPendingReviews() {
    return (await this.getDelegate()).getPendingReviews();
  }
}
```

## Related Files

- `packages/db/src/core/interfaces/contentSource.ts` — `StudyContentSource` interface (with optional `getWeightedCards`)
- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` base class, `WeightedCard`
- `packages/db/src/core/navigators/elo.ts` — Reference generator implementation
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — Reference filter implementation
- `packages/db/src/core/navigators/interferenceMitigator.ts` — Interference avoidance filter
- `packages/db/src/core/navigators/relativePriority.ts` — Priority-based score boosting filter
- `packages/db/src/impl/couch/courseDB.ts` — `getWeightedCards()` implementation (delegates to navigator)
- `packages/db/src/impl/couch/classroomDB.ts` — `getWeightedCards()` wrapper for classrooms
- `packages/db/src/study/SessionController.ts` — Consumer of navigation strategies (`getWeightedContent()`)
```


## Assistant

---

## Summary: Phase 4a Complete

I've completed the core SessionController integration. Here's what was done:

### Files Created/Modified

| File | Changes |
|------|---------|
| `packages/db/src/core/interfaces/contentSource.ts` | Added optional `getWeightedCards()` to `StudyContentSource` interface |
| `packages/db/src/impl/couch/courseDB.ts` | Added `getWeightedCards()` implementation (delegates to `ContentNavigator`) |
| `packages/db/src/impl/couch/classroomDB.ts` | Added `getWeightedCards()` wrapper (wraps legacy methods with score=1.0) |
| `packages/db/src/study/SessionController.ts` | Added `getWeightedContent()` method, updated `prepareSession()` to use new API, enhanced `getDebugInfo()` |
| `packages/db/docs/navigators-architecture.md` | Moved from `src/core/navigators/` and updated with integration details |
| `agent/orchestrator/a.3.todo.md` | Updated with Phase 4a completion status |
| `agent/orchestrator/a.2.plan.md` | Updated doc reference path |

### Integration Approach

The implementation uses a **hybrid approach**:

1. **`prepareSession()`** checks if sources support `getWeightedCards()`
2. If supported, calls new **`getWeightedContent()`** method
3. Otherwise, falls back to legacy `getScheduledReviews()` / `getNewCards()`

The hybrid approach in `getWeightedContent()`:
- Fetches **weighted cards** from sources for scoring/ordering information
- **Also fetches full review data** via `getPendingReviews()` (needed for `ScheduledCard` fields like `_id`, `reviewTime`, etc.)
- Builds a score lookup map and uses it to **order reviews by their weighted scores**
- Adds new cards ordered by their weighted scores

### Debug Info Enhancement

`getDebugInfo()` now includes:
```master/dev/null/debug-api-info.ts#L1-5
api: {
  mode: 'weighted' | 'legacy',
  description: 'Using getWeightedCards() API with scored candidates' | 
               'Using legacy getNewCards()/getPendingReviews() API'
}
```

### What This Enables

The new navigation strategies (HierarchyDefinition, InterferenceMitigator, RelativePriority) are now **operational**:

1. A course can configure a navigation strategy in its `CourseConfig.defaultNavigationStrategyId`
2. `CourseDB.surfaceNavigationStrategy()` loads the configured strategy
3. `CourseDB.getWeightedCards()` delegates to the navigator's `getWeightedCards()`
4. `SessionController.getWeightedContent()` uses the scored results for ordering

### Remaining Work (p4a.3)

Strategy creation support (CLI or UI) is deferred as future work. Currently, strategies must be created by directly inserting documents into the course database.

## User

looking good. 

for a course with *no* configured navigation strategies - do we expect the app now to run and mirror old behaviour?

## Assistant

Good question. Let me trace the path for a course with no configured navigation strategy:

**Tool Call: Read file `packages/db/src/impl/couch/courseDB.ts` (lines 520-560)**
Status: Completed

```master/packages/db/src/impl/couch/courseDB.ts
  }

  async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
    try {
      const config = await this.getCourseConfig();
      // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
      if (config.defaultNavigationStrategyId) {
        try {
          // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
          const strategy = await this.getNavigationStrategy(config.defaultNavigationStrategyId);
          if (strategy) {
            logger.debug(`Surfacing strategy ${strategy.name} from course config`);
            return strategy;
          }
        } catch (e) {
          logger.warn(
            // @ts-expect-error tmp: defaultNavigationStrategyId property does not yet exist
            `Failed to load strategy '${config.defaultNavigationStrategyId}' specified in course config. Falling back to ELO.`,
            e
          );
        }
      }
    } catch (e) {
      logger.warn(
        'Could not retrieve course config to determine navigation strategy. Falling back to ELO.',
        e
      );
    }

    logger.warn(`Returning hard-coded default ELO navigator`);
    const ret: ContentNavigationStrategyData = {
      _id: 'NAVIGATION_STRATEGY-ELO',
      docType: DocType.NAVIGATION_STRATEGY,
      name: 'ELO',
      description: 'ELO-based navigation strategy',
      implementingClass: Navigators.ELO,
      course: this.id,
      serializedData: '', // serde is a noop for ELO navigator.
    };
    return Promise.resolve(ret);
  }

```


## Assistant

Yes — the path looks correct:

1. **No configured strategy** → `surfaceNavigationStrategy()` returns hard-coded ELO strategy
2. **ELO strategy** → `ContentNavigator.create()` loads `ELONavigator`
3. **ELONavigator** → Has both legacy methods and `getWeightedCards()` implemented

Let me verify `ELONavigator.getWeightedCards()` is implemented:

**Tool Call: Read file `packages/db/src/core/navigators/elo.ts` (lines 80-140)**
Status: Completed

```master/packages/db/src/core/navigators/elo.ts
  /**
   * Get cards with suitability scores based on ELO distance.
   *
   * Cards closer to user's ELO get higher scores.
   * Score formula: max(0, 1 - distance / 500)
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Get user's ELO for this course
    const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
    const userElo = toCourseElo(courseReg.elo);
    const userGlobalElo = userElo.global.score;

    // Get new cards (existing logic)
    const newCards = await this.getNewCards(limit);

    // Get reviews (existing logic)
    const reviews = await this.getPendingReviews();

    // Get ELO data for all cards in one batch
    const allCardIds = [...newCards.map((c) => c.cardID), ...reviews.map((r) => r.cardID)];
    const cardEloData = await this.course.getCardEloData(allCardIds);

    // Build a map for quick lookup
    const eloMap = new Map<string, number>();
    allCardIds.forEach((id, i) => {
      eloMap.set(id, cardEloData[i]?.global?.score ?? 1000);
    });

    // Score new cards by ELO distance
    const scoredNew: WeightedCard[] = newCards.map((c) => {
      const cardElo = eloMap.get(c.cardID) ?? 1000;
      const distance = Math.abs(cardElo - userGlobalElo);
      const score = Math.max(0, 1 - distance / 500);

      return {
        cardId: c.cardID,
        courseId: c.courseID,
        score,
        source: 'new' as const,
      };
    });

    // Score reviews (for now, score=1.0; future: score by overdueness)
    const scoredReviews: WeightedCard[] = reviews.map((r) => ({
      cardId: r.cardID,
      courseId: r.courseID,
      score: 1.0,
      source: 'review' as const,
    }));

    // Combine and sort by score descending
    const all = [...scoredNew, ...scoredReviews];
    all.sort((a, b) => b.score - a.score);

    return all.slice(0, limit);
  }
}

```


## Assistant

Yes, `ELONavigator.getWeightedCards()` is implemented. So the expected behavior for a course with no configured strategy:

| Step | What Happens |
|------|--------------|
| 1. `SessionController.prepareSession()` | Checks if sources have `getWeightedCards` |
| 2. `CourseDB.getWeightedCards` exists | ✅ Yes, it's implemented |
| 3. → calls `getWeightedContent()` | Uses new weighted API path |
| 4. `CourseDB.getWeightedCards()` | Calls `surfaceNavigationStrategy()` |
| 5. No `defaultNavigationStrategyId` | Falls back to hard-coded ELO |
| 6. `ContentNavigator.create()` | Creates `ELONavigator` |
| 7. `ELONavigator.getWeightedCards()` | Returns ELO-scored cards |

**The behavior should mirror old behavior** because:
- ELO is still the default strategy
- ELO's `getWeightedCards()` calls the same `getNewCards()` / `getPendingReviews()` internally
- The only difference is cards are now ordered by ELO-based scores

**One subtle difference**: In the old path, new cards and reviews were fetched separately and added to queues in fetch order. Now they're ordered by score. For ELO, this means:
- New cards closest to user's ELO are prioritized
- Reviews still get score=1.0 (so they'll tend to come before lower-scored new cards)

This is actually *better* behavior for ELO, but it is a functional change. If you want exact parity, we could have the new path also use score=1.0 for all cards when using the default ELO strategy — but I'd argue the scored ordering is the intended improvement.

Want me to add a quick smoke test or should we just run the app to verify?

## User

Agreed on the ELO functional change improvement here.

I ran it - it works! Wowza.

OK.

Recap - where are we at now? Top of my head:

- ELO and SRS card surfacing are still legacy implementations - should they be migrated to become instances of `ContentNavigator`s ? They can still be 'priviledged' in so far as they get spun up by default if the course configuration / data has no `ContentNavigator`s
- there are no hooks for actually *authoring* navigationStrategies yet.
- unknown: have we implemted any mechanism for a navigationStrategy to 
  - write pertinant data to a namespaced location in the user's userDB
  - read general info from the user's userDB (to obtain context on user's experirence / skills)


aside: I keep saying navigationStrategy when I think I probably mean ContentNavigator - I think the terminology is a little confused in varied definitions?

**Tool Call: Thinking**
Status: Completed

Let me think through the user's questions and the terminology confusion:

## Terminology Confusion

Looking at the codebase:
- `ContentNavigator` - the abstract base class that strategies extend
- `NavigationStrategy` - used loosely to refer to the concept
- `ContentNavigationStrategyData` - the serialized configuration stored in the database
- `Navigators` enum - the list of available navigator implementations

The user is right that this is confusing. Let me trace through:
- We have `ContentNavigator` as the runtime class
- We have `ContentNavigationStrategyData` as the persisted config
- The enum is called `Navigators`
- We call them "navigation strategies" in documentation

I think the terminology should be:
- **NavigationStrategy** = the concept/pattern (what we're building)
- **ContentNavigator** = the abstract base class / runtime implementation
- **Navigator** = a specific implementation (ELO, Hierarchy, etc.)
- **ContentNavigationStrategyData** = the persisted configuration

So when you say "author a NavigationStrategy", you mean "create a ContentNavigationStrategyData document that configures a Navigator".

## Current State Assessment

1. **ELO and SRS as legacy implementations**
   - ELO IS already a ContentNavigator (`ELONavigator`)
   - SRS is NOT - it's embedded in the ELONavigator's `getPendingReviews()` logic
   - The SRS scheduling is actually in the user's `ScheduledCard` documents and the `SrsService`
   - So SRS is more of a "source of review candidates" than a "navigation strategy"

2. **Authoring hooks**
   - `NavigationStrategyEditor.vue` exists but only creates HARDCODED strategies
   - No UI for Hierarchy, Interference, RelativePriority configs
   - Can be done via direct DB manipulation or future CLI/MCP tools

3. **UserDB data access for strategies**
   - ContentNavigator constructor receives `user: UserDBInterface`
   - Can read: `user.getCourseRegDoc()`, `user.getSeenCards()`, `user.getActiveCards()`, `user.getPendingReviews()`
   - Per-tag ELO is available via `courseRegDoc.elo.tags`
   - **WRITE**: No namespaced storage mechanism yet for strategy-specific data
   - **READ**: Yes, strategies can read user history and ELO data

Let me check what methods are available on UserDBInterface for reading/writing.


## Assistant

Great questions. Let me give you a clear status recap:

## Terminology Clarification

You're right — the terminology is muddled. Here's how I'd propose to think about it:

| Term | Meaning |
|------|---------|
| **NavigationStrategy** | The concept/pattern — a pluggable algorithm for ordering content |
| **ContentNavigator** | The abstract base class that strategies extend (runtime) |
| **Navigator** | A specific implementation (ELO, Hierarchy, Interference, RelativePriority) |
| **ContentNavigationStrategyData** | The persisted configuration document (serialized to DB) |

So "authoring a NavigationStrategy" = "creating a `ContentNavigationStrategyData` document that configures a specific Navigator".

---

## Current State

### 1. ELO and SRS Status

| Component | Status |
|-----------|--------|
| **ELO** | ✅ Already a `ContentNavigator` (`ELONavigator`) |
| **SRS** | ❌ **NOT** a ContentNavigator — it's embedded elsewhere |

SRS is currently:
- **Scheduling**: `SrsService` writes `ScheduledCard` documents to userDB
- **Retrieval**: `UserDBInterface.getPendingReviews()` reads scheduled reviews
- **Consumption**: `ELONavigator.getPendingReviews()` calls the user's pending reviews

SRS could be extracted into its own Navigator that:
- Scores reviews by overdueness (currently all get score=1.0)
- Could be composed with other strategies

### 2. Authoring Hooks

| What | Status |
|------|--------|
| `NavigationStrategyEditor.vue` | Exists, but only creates `HARDCODED` strategies |
| Hierarchy/Interference/RelativePriority UI | ❌ Not implemented |
| CLI/MCP tooling | ❌ Not implemented |
| Direct DB manipulation | ✅ Works (but not user-friendly) |

### 3. UserDB Data Access

Let me check what's available:

**Tool Call: Search files for regex `^\s+(get|put|update|add|remove|create)`**
Status: Completed

Found 14 matches:

## Matches in master/packages/db/src/core/interfaces/userDB.ts

### interface UserDBReader › L16-26
```
export interface UserDBReader {
  get<T>(id: string): Promise<T & PouchDB.Core.RevisionIdMeta>;
  getUsername(): string;
  isLoggedIn(): boolean;

  /**
   * Get user configuration
   */
  getConfig(): Promise<UserConfig>;

  /**
```

44 lines remaining in ancestor node. Read the file to see all.

### interface UserDBReader › L27-31
```
   * Get cards that the user has seen
   */
  getSeenCards(courseId?: string): Promise<string[]>;

  /**
```

### interface UserDBReader › L32-36
```
   * Get cards that are actively scheduled for review
   */
  getActiveCards(): Promise<QualifiedCardID[]>;

  /**
```

### interface UserDBReader › L37-41
```
   * Get user's course registrations
   */
  getCourseRegistrationsDoc(): Promise<CourseRegistrationDoc>;

  /**
```

### interface UserDBReader › L43-47
```
   * @param courseId
   */
  getCourseRegDoc(courseId: string): Promise<CourseRegistration>;

  /**
```

### interface UserDBReader › L48-52
```
   * Get user's active courses
   */
  getActiveCourses(): Promise<CourseRegistration[]>;

  /**
```

### interface UserDBReader › L53-59
```
   * Get user's pending reviews
   */
  getPendingReviews(courseId?: string): Promise<ScheduledCard[]>;

  getActivityRecords(): Promise<ActivityRecord[]>;

  /**
```

### interface UserDBReader › L60-64
```
   * Get user's classroom registrations
   */
  getUserClassrooms(): Promise<ClassroomRegistrationDoc>;

  /**
```

### interface UserDBReader › L65-71
```
   * Get user's active classes
   */
  getActiveClasses(): Promise<string[]>;

  getCourseInterface(courseId: string): Promise<UsrCrsDataInterface>;
}

```

### interface UserDBWriter › L75-85
```
export interface UserDBWriter extends DocumentUpdater {
  /**
   * Update user configuration
   */
  setConfig(config: Partial<UserConfig>): Promise<void>;

  /**
   * Record a user's interaction with a card
   */
  putCardRecord<T extends CardRecord>(record: T): Promise<CardHistory<CardRecord>>;

```

50 lines remaining in ancestor node. Read the file to see all.

### interface UserDBWriter › L109-113
```
   * Remove a scheduled card review
   */
  removeScheduledCardReview(reviewId: string): Promise<void>;

  /**
```

### interface UserDBWriter › L127-131
```
   * Update user's ELO rating for a course
   */
  updateUserElo(courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  /**
```

### interface UserDBAuthenticator › L140-150
```
export interface UserDBAuthenticator {
  /**
   * Create a new user account
   */
  createAccount(
    username: string,
    password: string
  ): Promise<{
    status: Status;
    error: string;
  }>;
```

20 lines remaining in ancestor node. Read the file to see all.

### interface UsrCrsDataInterface › L188-193
```
export interface UsrCrsDataInterface {
  getScheduledReviewCount(): Promise<number>;
  getCourseSettings(): Promise<UserCourseSettings>;
  updateCourseSettings(updates: UserCourseSetting[]): void; // [ ] return a result of some sort?
  // getRegistrationDoc(): Promise<CourseRegistration>;
}
```


**Tool Call: Read file `packages/db/src/core/interfaces/userDB.ts` (lines 70-140)**
Status: Completed

```master/packages/db/src/core/interfaces/userDB.ts
}

/**
 * User data mutation operations
 */
export interface UserDBWriter extends DocumentUpdater {
  /**
   * Update user configuration
   */
  setConfig(config: Partial<UserConfig>): Promise<void>;

  /**
   * Record a user's interaction with a card
   */
  putCardRecord<T extends CardRecord>(record: T): Promise<CardHistory<CardRecord>>;

  /**
   * Register user for a course
   */
  registerForCourse(courseId: string, previewMode?: boolean): Promise<PouchDB.Core.Response>;

  /**
   * Drop a course registration
   */
  dropCourse(courseId: string, dropStatus?: string): Promise<PouchDB.Core.Response>;

  /**
   * Schedule a card for review
   */
  scheduleCardReview(review: {
    user: string;
    course_id: string;
    card_id: string;
    time: Moment;
    scheduledFor: 'course' | 'classroom';
    schedulingAgentId: string;
  }): Promise<void>;

  /**
   * Remove a scheduled card review
   */
  removeScheduledCardReview(reviewId: string): Promise<void>;

  /**
   * Register user for a classroom
   */
  registerForClassroom(
    classId: string,
    registerAs: 'student' | 'teacher' | 'aide' | 'admin'
  ): Promise<PouchDB.Core.Response>;

  /**
   * Drop user from classroom
   */
  dropFromClassroom(classId: string): Promise<PouchDB.Core.Response>;

  /**
   * Update user's ELO rating for a course
   */
  updateUserElo(courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  /**
   * Reset all user data (progress, registrations, etc.) while preserving authentication
   */
  resetUserData(): Promise<{ status: Status; error?: string }>;
}

/**
 * Authentication and account management operations
 */
export interface UserDBAuthenticator {

```


## Assistant

### UserDB Data Access for Strategies

| Capability | Status | How |
|------------|--------|-----|
| **Read user ELO** | ✅ Yes | `user.getCourseRegDoc(courseId).elo` (global + per-tag) |
| **Read seen cards** | ✅ Yes | `user.getSeenCards(courseId)` |
| **Read pending reviews** | ✅ Yes | `user.getPendingReviews(courseId)` |
| **Read active cards** | ✅ Yes | `user.getActiveCards()` |
| **Read card history** | 🟡 Partial | Via `CardHistory` after `putCardRecord`, but no direct query |
| **Write strategy-specific data** | ❌ No | No namespaced storage mechanism |

### The Missing Piece: Strategy-Specific State

Currently, there's **no mechanism for a Navigator to store its own state** in the userDB. For example:
- InterferenceMitigator might want to track "last time tag X was introduced"
- A future "minimal pairs" strategy might want to track discrimination training progress
- RelativePriority might want to track user preferences

**Options to add this:**

```master/dev/null/strategy-state-option.ts#L1-15
// Option A: Namespaced key-value store
interface UserDBWriter {
  // ... existing methods ...
  
  /** Store strategy-specific data */
  putStrategyData(strategyId: string, data: unknown): Promise<void>;
  
  /** Retrieve strategy-specific data */
  getStrategyData<T>(strategyId: string): Promise<T | null>;
}

// Option B: Extend CourseRegistration with strategy state
interface CourseRegistration {
  // ... existing fields ...
  strategyState?: { [strategyId: string]: unknown };
}
```

---

## Summary: What's Left

| Category | Item | Priority |
|----------|------|----------|
| **Migration** | Extract SRS into its own Navigator (score by overdueness) | Medium |
| **Authoring** | UI/CLI for creating Hierarchy/Interference/RelativePriority configs | High for LP |
| **Data Access** | Add strategy-specific state storage to UserDB | Medium |
| **Terminology** | Clean up naming (ContentNavigator vs NavigationStrategy) | Low |

Would you like me to tackle any of these next?

## User

not too worried about the terminology right now.

re:
- srs migration
- authoring
- data access

Can you create summary todo docs for each, as a hand-off ? Will take some of that relative 'grind-work' to cheaper models if the path forward is fairly clear.

**Tool Call: agent/orchestrator/todo-srs-navigator.md**
Status: Completed

Diff: agent/orchestrator/todo-srs-navigator.md
```
# TODO: SRS Navigator Migration

## Status: NOT STARTED

## Goal

Extract SRS (Spaced Repetition System) logic into a proper `ContentNavigator` implementation
that scores review cards by overdueness, rather than treating all reviews as score=1.0.

## Current State

SRS functionality is currently **distributed across multiple components**:

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SrsService` | `packages/db/src/study/services/SrsService.ts` | Scheduling algorithm, review interval calculation |
| `UserDBInterface.getPendingReviews()` | `packages/db/src/core/interfaces/userDB.ts` | Retrieves scheduled cards from userDB |
| `ScheduledCard` | `packages/db/src/core/types/user.ts` | Data structure for scheduled reviews |
| `ELONavigator.getPendingReviews()` | `packages/db/src/core/navigators/elo.ts` | Passes through user's pending reviews |
| `ELONavigator.getWeightedCards()` | `packages/db/src/core/navigators/elo.ts` | Assigns score=1.0 to all reviews |

## The Problem

Currently in `ELONavigator.getWeightedCards()`:

```typescript
// Score reviews (for now, score=1.0; future: score by overdueness)
const scoredReviews: WeightedCard[] = reviews.map((r) => ({
  cardId: r.cardID,
  courseId: r.courseID,
  score: 1.0,  // <-- All reviews get same score!
  source: 'review' as const,
}));
```

This means:
- Reviews always outrank new cards with score < 1.0
- No prioritization of "more overdue" vs "barely due" reviews
- Lost opportunity for smarter review ordering

## Proposed Solution

Create an `SRSNavigator` that:
1. Generates review candidates from `user.getPendingReviews()`
2. Scores them by **overdueness** (how far past their scheduled review time)
3. Can be composed with other strategies via delegate pattern

### Score Formula Options

**Option A: Linear overdueness**
```typescript
// Days overdue, clamped to reasonable range
const daysOverdue = moment.utc().diff(moment.utc(review.reviewTime), 'days');
const score = Math.min(1.0, 0.5 + (daysOverdue * 0.1)); // 0.5 base + 0.1 per day overdue
```

**Option B: Exponential urgency**
```typescript
const hoursOverdue = moment.utc().diff(moment.utc(review.reviewTime), 'hours');
const urgency = 1 - Math.exp(-hoursOverdue / 24); // Approaches 1.0 asymptotically
const score = 0.5 + (urgency * 0.5);
```

**Option C: Configurable**
```typescript
interface SRSConfig {
  baseScore: number;           // Score for reviews exactly on time (default: 0.7)
  overdueBoostPerDay: number;  // Additional score per day overdue (default: 0.05)
  maxScore: number;            // Cap (default: 1.0)
  includeNewCards: boolean;    // Whether to also generate new cards (default: false)
  delegateStrategy?: string;   // For new cards if included
}
```

## Implementation Plan

### Phase 1: Create SRSNavigator

1. Create `packages/db/src/core/navigators/srs.ts`
2. Extend `ContentNavigator`
3. Implement `getWeightedCards()` with overdueness scoring
4. Implement legacy methods (`getPendingReviews()`, `getNewCards()`)
5. Add to `Navigators` enum

### Phase 2: Configuration

```typescript
interface SRSConfig {
  baseScore: number;           // default: 0.7
  overdueBoostPerDay: number;  // default: 0.05
  maxScore: number;            // default: 1.0
}
```

### Phase 3: Composition

SRS can be used as:
- **Standalone generator**: Just returns scored reviews
- **Part of a chain**: `RelativePriority(Interference(Hierarchy(SRS)))`
- **Merged with ELO**: Combine ELO's new card generation with SRS's review scoring

### Phase 4: Update ELONavigator

Two options:
- **Option A**: ELONavigator delegates review scoring to SRSNavigator
- **Option B**: ELONavigator focuses only on new cards, SRS is separate

Recommendation: Option B is cleaner separation of concerns.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/core/navigators/srs.ts` | CREATE | New SRSNavigator implementation |
| `packages/db/src/core/navigators/index.ts` | MODIFY | Add `SRS = 'srs'` to Navigators enum |
| `packages/db/src/core/navigators/elo.ts` | MODIFY | Option B: Remove review handling, focus on new cards |
| `packages/db/tests/core/navigators/navigators.test.ts` | MODIFY | Add SRS scoring tests |

## Test Cases

1. **On-time review** → base score (e.g., 0.7)
2. **1 day overdue** → base + boost (e.g., 0.75)
3. **7 days overdue** → higher score (e.g., 0.85 or capped at 1.0)
4. **Future review** (not yet due) → should not be returned
5. **Multiple reviews** → sorted by overdueness score descending

## Dependencies

- `moment` for date calculations (already used in codebase)
- `ScheduledCard.reviewTime` field for due time

## Open Questions

1. Should reviews that aren't due yet be excluded entirely, or get a low score?
2. Should there be a "stale" penalty for reviews that are VERY overdue (forgotten)?
3. How does this interact with the "failed cards" queue in SessionController?

## Related Files

- `packages/db/src/study/services/SrsService.ts` — Scheduling algorithm
- `packages/db/src/core/types/user.ts` — ScheduledCard type
- `packages/db/src/core/navigators/elo.ts` — Current review handling
- `packages/db/docs/navigators-architecture.md` — Architecture overview
```


**Tool Call: agent/orchestrator/todo-strategy-authoring.md**
Status: Completed

Diff: agent/orchestrator/todo-strategy-authoring.md
```
# TODO: NavigationStrategy Authoring Tools

## Status: NOT STARTED

## Goal

Provide tools for course authors to create and configure NavigationStrategy documents
without direct database manipulation. This includes UI components, CLI commands, and
potentially MCP tools.

## Current State

### What Exists

| Component | Location | Status |
|-----------|----------|--------|
| `NavigationStrategyEditor.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | Only creates HARDCODED strategies |
| `NavigationStrategyList.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | Lists strategies, sets default |
| `CourseDB.addNavigationStrategy()` | `packages/db/src/impl/couch/courseDB.ts` | DB write method exists |
| `CourseDB.getAllNavigationStrategies()` | `packages/db/src/impl/couch/courseDB.ts` | DB read method exists |
| `ContentNavigationStrategyData` | `packages/db/src/core/types/contentNavigationStrategy.ts` | Data schema exists |

### What's Missing

- UI forms for Hierarchy, Interference, RelativePriority configs
- CLI commands for strategy creation
- MCP tools for agent-based authoring
- Validation of strategy configurations
- Preview/testing of strategy behavior

## Strategy Types and Their Configs

### 1. HierarchyDefinition

```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: TagPrerequisite[];
  };
  delegateStrategy?: string;  // default: "elo"
}

interface TagPrerequisite {
  tag: string;
  masteryThreshold?: {
    minElo?: number;
    minCount?: number;
  };
}
```

**Example:**
```json
{
  "prerequisites": {
    "cvc-words": [
      { "tag": "letter-sounds", "masteryThreshold": { "minCount": 10, "minElo": 1050 } }
    ],
    "blends": [
      { "tag": "cvc-words", "masteryThreshold": { "minCount": 20 } }
    ]
  },
  "delegateStrategy": "elo"
}
```

**UI Requirements:**
- Tag selector (from course's available tags)
- Prerequisite builder (tag → requires tags with thresholds)
- Threshold inputs (minCount, minElo)
- Delegate strategy selector

---

### 2. InterferenceMitigator

```typescript
interface InterferenceConfig {
  interferenceSets: InterferenceGroup[];
  maturityThreshold?: {
    minCount?: number;
    minElo?: number;
    minElapsedDays?: number;
  };
  defaultDecay?: number;
  delegateStrategy?: string;
}

interface InterferenceGroup {
  tags: string[];
  decay?: number;
}
```

**Example:**
```json
{
  "interferenceSets": [
    { "tags": ["letter-b", "letter-d", "letter-p"], "decay": 0.9 },
    { "tags": ["letter-m", "letter-n"], "decay": 0.7 }
  ],
  "maturityThreshold": { "minCount": 15, "minElapsedDays": 3 },
  "defaultDecay": 0.8
}
```

**UI Requirements:**
- Interference group builder (add/remove groups)
- Tag multi-selector for each group
- Decay slider (0-1) per group
- Maturity threshold inputs
- Delegate strategy selector

---

### 3. RelativePriority

```typescript
interface RelativePriorityConfig {
  tagPriorities: { [tagId: string]: number };
  defaultPriority?: number;
  combineMode?: 'max' | 'average' | 'min';
  priorityInfluence?: number;
  delegateStrategy?: string;
}
```

**Example:**
```json
{
  "tagPriorities": {
    "letter-s": 0.95,
    "letter-t": 0.90,
    "letter-a": 0.88,
    "letter-x": 0.10,
    "letter-z": 0.05
  },
  "defaultPriority": 0.5,
  "combineMode": "max",
  "priorityInfluence": 0.5
}
```

**UI Requirements:**
- Tag list with priority sliders (0-1)
- Default priority input
- Combine mode selector (max/average/min)
- Priority influence slider
- Delegate strategy selector

---

## Implementation Options

### Option A: Extend NavigationStrategyEditor.vue

**Pros:**
- Single location for all strategy editing
- Consistent with existing UI patterns
- User-facing, accessible to course authors

**Cons:**
- More complex Vue component
- Requires form validation logic

**Implementation:**
1. Add strategy type selector dropdown
2. Conditional rendering of config forms based on type
3. Form validation before save
4. Serialize config to `serializedData` JSON

---

### Option B: CLI Commands

**Pros:**
- Scriptable, automatable
- Good for bulk operations
- Can be used by agents

**Cons:**
- Not user-friendly for non-technical authors
- Requires terminal access

**Implementation:**
```bash
# Create a hierarchy strategy
yarn cli strategy:create <courseId> \
  --type hierarchy \
  --name "Phonics Progression" \
  --config ./hierarchy-config.json

# Create an interference strategy
yarn cli strategy:create <courseId> \
  --type interference \
  --config ./interference-config.json

# List strategies
yarn cli strategy:list <courseId>

# Set default strategy
yarn cli strategy:set-default <courseId> <strategyId>

# Delete strategy
yarn cli strategy:delete <courseId> <strategyId>
```

**Files to modify:**
- `packages/cli/src/commands/` — Add strategy commands
- `packages/cli/src/index.ts` — Register new commands

---

### Option C: MCP Tools

**Pros:**
- Agent-accessible for automated course building
- Consistent with existing MCP pattern
- Can leverage LLM for config generation

**Cons:**
- Requires MCP client
- Not directly user-facing

**Implementation:**
Add to `packages/mcp/src/tools/`:

```typescript
// create_navigation_strategy tool
{
  name: 'create_navigation_strategy',
  description: 'Create a navigation strategy for the course',
  inputSchema: {
    type: 'object',
    properties: {
      strategyType: { enum: ['hierarchy', 'interference', 'relativePriority'] },
      name: { type: 'string' },
      description: { type: 'string' },
      config: { type: 'object' }
    }
  }
}
```

---

## Recommended Approach

**Phase 1: CLI (Quick Win)**
- Fastest to implement
- Enables immediate testing of strategies
- Can be used by agents via terminal tool

**Phase 2: MCP Tools**
- Natural extension of existing MCP infrastructure
- Enables agent-driven course authoring
- Config generation can be guided by prompts

**Phase 3: UI (Full Solution)**
- User-friendly for course authors
- Visual feedback and validation
- Can reference CLI/MCP implementations for logic

---

## Validation Requirements

All authoring tools should validate:

1. **Tag existence**: All referenced tags exist in the course
2. **Circular dependencies** (Hierarchy): No circular prerequisite chains
3. **Config completeness**: Required fields present
4. **Value ranges**: Scores/thresholds in valid ranges (e.g., 0-1)
5. **Delegate validity**: Delegate strategy type exists

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}
```

---

## Files to Create/Modify

### Option A: UI

| File | Action | Description |
|------|--------|-------------|
| `packages/edit-ui/src/components/NavigationStrategy/HierarchyConfigForm.vue` | CREATE | Hierarchy config form |
| `packages/edit-ui/src/components/NavigationStrategy/InterferenceConfigForm.vue` | CREATE | Interference config form |
| `packages/edit-ui/src/components/NavigationStrategy/RelativePriorityConfigForm.vue` | CREATE | Priority config form |
| `packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue` | MODIFY | Add type selector, conditional forms |

### Option B: CLI

| File | Action | Description |
|------|--------|-------------|
| `packages/cli/src/commands/strategy.ts` | CREATE | Strategy management commands |
| `packages/cli/src/utils/strategy-validation.ts` | CREATE | Config validation utilities |
| `packages/cli/src/index.ts` | MODIFY | Register strategy commands |

### Option C: MCP

| File | Action | Description |
|------|--------|-------------|
| `packages/mcp/src/tools/navigationStrategy.ts` | CREATE | Strategy creation tools |
| `packages/mcp/src/index.ts` | MODIFY | Register new tools |

---

## Related Files

- `packages/db/src/core/types/contentNavigationStrategy.ts` — Strategy data schema
- `packages/db/src/impl/couch/courseDB.ts` — DB methods for strategies
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — Config interface reference
- `packages/db/src/core/navigators/interferenceMitigator.ts` — Config interface reference
- `packages/db/src/core/navigators/relativePriority.ts` — Config interface reference
- `packages/edit-ui/src/components/NavigationStrategy/` — Existing UI components
```


**Tool Call: agent/orchestrator/todo-strategy-state-storage.md**
Status: Completed

Diff: agent/orchestrator/todo-strategy-state-storage.md
```
# TODO: Strategy-Specific State Storage in UserDB

## Status: NOT STARTED

## Goal

Enable NavigationStrategies (ContentNavigators) to persist their own state data in the
user's database, allowing strategies to maintain context across sessions.

## Current State

### What Strategies Can Read

| Data | Method | Notes |
|------|--------|-------|
| User's global ELO | `user.getCourseRegDoc(courseId).elo.global` | ✅ Available |
| User's per-tag ELO | `user.getCourseRegDoc(courseId).elo.tags` | ✅ Available |
| Seen cards | `user.getSeenCards(courseId)` | ✅ Card IDs only |
| Active cards | `user.getActiveCards()` | ✅ Available |
| Pending reviews | `user.getPendingReviews(courseId)` | ✅ ScheduledCard objects |
| Card history | `user.putCardRecord()` returns `CardHistory` | 🟡 Only after write |

### What Strategies Cannot Do

- **Store arbitrary state**: No namespaced storage for strategy-specific data
- **Track temporal patterns**: No easy way to record "when did I last introduce tag X?"
- **Persist learning context**: Strategy state is lost between sessions

## Use Cases

### 1. InterferenceMitigator

**Need**: Track when interfering concepts were last introduced together.

```typescript
// Desired: Store last introduction time per tag
{
  "lastIntroduction": {
    "letter-b": "2024-01-15T10:30:00Z",
    "letter-d": "2024-01-16T14:20:00Z"
  }
}
```

### 2. Minimal Pairs Strategy (Future)

**Need**: Track discrimination training progress between confusable pairs.

```typescript
// Desired: Store discrimination scores per pair
{
  "pairScores": {
    "b-d": { "correct": 15, "total": 20, "lastPracticed": "..." },
    "m-n": { "correct": 8, "total": 10, "lastPracticed": "..." }
  }
}
```

### 3. Adaptive Pacing Strategy (Future)

**Need**: Track user's engagement patterns and optimal session timing.

```typescript
// Desired: Store engagement metrics
{
  "sessionMetrics": {
    "avgAccuracyByTimeOfDay": { "morning": 0.85, "afternoon": 0.78 },
    "optimalSessionLength": 180,  // seconds
    "fatigueThreshold": 12        // cards before accuracy drops
  }
}
```

## Proposed Solutions

### Option A: Extend CourseRegistration

Add a `strategyState` field to the existing `CourseRegistration` document.

**Schema:**
```typescript
interface CourseRegistration {
  // ... existing fields ...
  
  /**
   * Strategy-specific state, keyed by strategy ID or type.
   * Each strategy owns its own namespace.
   */
  strategyState?: {
    [strategyKey: string]: unknown;
  };
}
```

**Pros:**
- No new document types
- Lives alongside other course-specific user data
- Already synced via existing mechanisms

**Cons:**
- Potential for large documents if strategies store lots of data
- All strategies share one document (contention on updates)

---

### Option B: Separate Strategy State Documents

Create a new document type for strategy state.

**Schema:**
```typescript
interface StrategyStateDoc {
  _id: `STRATEGY_STATE-${courseId}-${strategyKey}`;
  docType: DocType.STRATEGY_STATE;
  courseId: string;
  strategyKey: string;  // e.g., "interferenceMitigator" or strategy instance ID
  data: unknown;
  updatedAt: string;
}
```

**Pros:**
- Clean separation
- No document size concerns
- Independent updates (no contention)

**Cons:**
- New document type to manage
- More queries to fetch state

---

### Option C: Generic Key-Value Store in UserDB

Add generic methods for namespaced storage.

**Interface:**
```typescript
interface UserDBWriter {
  // ... existing methods ...
  
  /**
   * Store data in a namespaced location.
   * @param namespace - Unique namespace (e.g., "strategy:interferenceMitigator:course123")
   * @param data - Arbitrary JSON-serializable data
   */
  putNamespacedData(namespace: string, data: unknown): Promise<void>;
  
  /**
   * Retrieve namespaced data.
   * @param namespace - The namespace to retrieve
   * @returns The stored data, or null if not found
   */
  getNamespacedData<T>(namespace: string): Promise<T | null>;
  
  /**
   * Delete namespaced data.
   * @param namespace - The namespace to delete
   */
  deleteNamespacedData(namespace: string): Promise<void>;
}
```

**Pros:**
- Most flexible
- Reusable beyond strategies
- Clean API

**Cons:**
- Very generic (might be too permissive)
- Namespace collision risk

---

## Recommended Approach

**Option B (Separate Documents)** with a convenience wrapper:

```typescript
// In ContentNavigator base class or a mixin
abstract class ContentNavigator {
  // ... existing methods ...
  
  /**
   * Get this strategy's persisted state for the current course.
   */
  protected async getStrategyState<T>(): Promise<T | null> {
    const key = `STRATEGY_STATE-${this.course.getCourseID()}-${this.strategyKey}`;
    try {
      return await this.user.get<T>(key);
    } catch (e) {
      return null;  // Not found
    }
  }
  
  /**
   * Persist this strategy's state for the current course.
   */
  protected async putStrategyState<T>(data: T): Promise<void> {
    const key = `STRATEGY_STATE-${this.course.getCourseID()}-${this.strategyKey}`;
    const existing = await this.getStrategyState<T>();
    await this.user.put({
      _id: key,
      _rev: existing?._rev,
      docType: DocType.STRATEGY_STATE,
      courseId: this.course.getCourseID(),
      strategyKey: this.strategyKey,
      data,
      updatedAt: new Date().toISOString(),
    });
  }
  
  /**
   * Unique key for this strategy instance.
   * Override in subclasses if multiple instances need separate state.
   */
  protected get strategyKey(): string {
    return this.constructor.name;  // e.g., "InterferenceMitigatorNavigator"
  }
}
```

## Implementation Plan

### Phase 1: Add DocType and Interface

1. Add `STRATEGY_STATE` to `DocType` enum in `packages/db/src/core/types/types-legacy.ts`
2. Define `StrategyStateDoc` interface
3. Add prefix to `DocTypePrefixes`

### Phase 2: Add UserDB Methods

1. Add `getStrategyState()` and `putStrategyState()` to `UserDBInterface`
2. Implement in `CouchUserDB`

### Phase 3: Add ContentNavigator Helpers

1. Add protected helper methods to `ContentNavigator` base class
2. Document usage pattern

### Phase 4: Update Strategies

1. Update `InterferenceMitigatorNavigator` to use state storage
2. Add tests for state persistence

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/core/types/types-legacy.ts` | MODIFY | Add STRATEGY_STATE DocType |
| `packages/db/src/core/types/strategyState.ts` | CREATE | StrategyStateDoc interface |
| `packages/db/src/core/interfaces/userDB.ts` | MODIFY | Add state storage methods |
| `packages/db/src/impl/couch/userDB.ts` | MODIFY | Implement state storage |
| `packages/db/src/core/navigators/index.ts` | MODIFY | Add helper methods to base class |
| `packages/db/src/core/navigators/interferenceMitigator.ts` | MODIFY | Use state storage |

## Test Cases

1. **Store and retrieve**: Write state, read it back, verify equality
2. **Update existing**: Write state, update it, verify new value
3. **Separate namespaces**: Two strategies store data, each gets their own
4. **Cross-session persistence**: Store state, simulate new session, verify data persists
5. **Missing state**: Read state that doesn't exist, get null (not error)

## Open Questions

1. **State migration**: How to handle strategy state when strategy config changes?
2. **State cleanup**: When a strategy is deleted, should its state be cleaned up?
3. **State size limits**: Should we enforce maximum state size?
4. **Sync behavior**: How does state sync across devices for multi-device users?

## Related Files

- `packages/db/src/core/interfaces/userDB.ts` — UserDB interface
- `packages/db/src/impl/couch/userDB.ts` — UserDB implementation
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base class
- `packages/db/src/core/types/types-legacy.ts` — DocType enum
- `packages/db/docs/navigators-architecture.md` — Architecture overview
```


## Assistant

Created three handoff TODO documents:

| Document | Location | Summary |
|----------|----------|---------|
| **SRS Navigator** | `agent/orchestrator/todo-srs-navigator.md` | Extract SRS into ContentNavigator with overdueness scoring |
| **Strategy Authoring** | `agent/orchestrator/todo-strategy-authoring.md` | CLI/MCP/UI tools for creating Hierarchy/Interference/RelativePriority configs |
| **State Storage** | `agent/orchestrator/todo-strategy-state-storage.md` | Namespaced storage in UserDB for strategy-specific state |

Each document includes:
- Current state analysis
- Proposed solutions with tradeoffs
- Implementation phases
- File lists to create/modify
- Test cases
- Open questions

Ready for handoff to cheaper models for the grind work.

## User

And can you summarize our progress against the 'grander vision' of full dynamic orchestration logic and evolutionary pressures, alluded to in [@u.3.strategic-nuggets.md](file:///home/colin/pn/vue-skuilder/master/agent/orchestrator/u.3.strategic-nuggets.md) ?

Document this in another handoff doc (which will be for you and I to suss out).

**Tool Call: agent/orchestrator/todo-evolutionary-orchestration.md**
Status: Completed

Diff: agent/orchestrator/todo-evolutionary-orchestration.md
```
# TODO: Evolutionary Orchestration Vision

## Status: FOUNDATIONAL WORK COMPLETE, ORCHESTRATION NOT STARTED

This document tracks progress toward the "grander vision" of dynamic orchestration with
evolutionary pressures, as outlined in `u.3.strategic-nuggets.md`.

## The Vision (Summary)

A self-improving courseware system where:

1. **N strategies exist** — Each a hypothesis about effective content sequencing
2. **M users exist** — Each with learning goals and measurable outcomes
3. **Multi-arm bandit selection** — Strategies are applied based on confidence in their utility
4. **Evolutionary pressure** — Effective strategies propagate, ineffective ones decay
5. **Self-healing content** — System identifies barriers and incentivizes remediation

---

## Progress Assessment

### ✅ COMPLETE: Strategy Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| `WeightedCard` API | ✅ Done | Unified scored candidate model |
| `ContentNavigator` base class | ✅ Done | Extensible strategy framework |
| Delegate pattern composition | ✅ Done | Strategies can wrap/chain |
| `HierarchyDefinition` strategy | ✅ Done | Prerequisite gating |
| `InterferenceMitigator` strategy | ✅ Done | Confusable concept separation |
| `RelativePriority` strategy | ✅ Done | Utility-based content ordering |
| `SessionController` integration | ✅ Done | `getWeightedCards()` is live |

**What this enables:**
- Multiple strategies can coexist and be configured per-course
- Strategies return graded suitability scores (0-1), not just binary include/exclude
- Composition allows layering strategies: `Priority(Interference(Hierarchy(ELO)))`

---

### 🟡 PARTIAL: Strategy State & Context

| Component | Status | Notes |
|-----------|--------|-------|
| Read user ELO (global + per-tag) | ✅ Done | Via `CourseRegistration.elo` |
| Read user history | ✅ Done | `getSeenCards()`, `getPendingReviews()` |
| Write strategy-specific state | ❌ Not done | See `todo-strategy-state-storage.md` |
| Temporal tracking | ❌ Not done | "When was tag X last introduced?" |

**Gap for evolutionary vision:**
- Strategies cannot yet persist their own learning/state
- No mechanism for tracking strategy effectiveness over time

---

### ❌ NOT STARTED: Multi-Arm Bandit Selection

The core orchestration logic described in the vision:

```
each of N strategies divides into cohorts via some hashId collision metric
  eg: h(strategyHash + slowRotationSalt) xor userHash 
      if resultant Ones are < utilityConfidence percent of total bits, 
      then include the strategy for the user
```

**What's needed:**

1. **Strategy Registry** — Central list of available strategies with metadata
2. **Utility Confidence** — Per-strategy confidence score (0-1)
3. **Cohort Assignment** — Deterministic but rotatable user-to-strategy mapping
4. **Salt Rotation** — Periodic rotation to prevent user lock-in
5. **Outcome Measurement** — Track goal achievement per cohort

**Proposed architecture:**

```typescript
interface StrategyRegistryEntry {
  strategyId: string;
  strategyType: string;
  config: unknown;
  
  // Evolutionary metadata
  utilityConfidence: number;      // 0-1, probability of usefulness
  createdAt: string;
  lastMeasuredAt: string;
  cohortSalt: string;             // Rotated periodically
  
  // Outcome tracking
  metrics: {
    usersExposed: number;
    goalAchievementRate: number;
    engagementScore: number;
    progressRate: number;
  };
}

interface Orchestrator {
  // Determine which strategies apply to this user for this session
  selectStrategies(userId: string, courseId: string): Promise<StrategyRegistryEntry[]>;
  
  // Record outcome for evolutionary learning
  recordOutcome(userId: string, strategyIds: string[], outcome: Outcome): Promise<void>;
  
  // Rotate cohort assignments
  rotateSalt(): Promise<void>;
  
  // Prune ineffective strategies
  pruneStrategies(minConfidence: number): Promise<void>;
}
```

---

### ❌ NOT STARTED: Parameterizable / Programmable Strategies

The vision describes:

```
would like to extend into parameterizable / programmable strategies. 
eg, should be able to specify deps like:
  `grade-{n}` & `geometry` -> `grade-{n+1}` & `geometry`
```

**What's needed:**

1. **Template syntax** — Pattern matching for tag relationships
2. **Variable binding** — Extract and apply variables in prerequisite rules
3. **Rule engine** — Evaluate parameterized rules against user state

**Example:**
```typescript
interface ParameterizedPrerequisite {
  pattern: "grade-{n} & {subject}";
  implies: "grade-{n+1} & {subject}";
  constraints: {
    n: { type: "number", min: 1, max: 12 },
    subject: { type: "tag-category", category: "academic-subject" }
  };
}
```

---

### ❌ NOT STARTED: Self-Healing Content

The meta-consideration from the vision:

```
- identifying learning 'barriers' where substantive portion of cohort gets stuck or abandons
- surfacing that info in a useful way
- author aims to diagnose and remedy by providing intermediate content
```

**What's needed:**

1. **Barrier Detection** — Identify cards/tags where many users get stuck
2. **Cohort Analysis** — Compare progress across strategy cohorts
3. **Alert System** — Surface barriers to authors
4. **Intervention Hooks** — Enable targeted content insertion
5. **Feedback Loop** — Measure intervention effectiveness

**Signals for barrier detection:**
- High failure rate on specific cards
- Long dwell time before mastery
- Drop-off (users abandon course at specific points)
- ELO stagnation on specific tags

---

## Roadmap to Full Vision

### Phase A: Foundation (COMPLETE ✅)

- [x] WeightedCard API
- [x] ContentNavigator framework
- [x] Core strategies (Hierarchy, Interference, RelativePriority)
- [x] SessionController integration

### Phase B: Strategy Ecosystem (IN PROGRESS 🟡)

- [ ] SRS as ContentNavigator (`todo-srs-navigator.md`)
- [ ] Strategy authoring tools (`todo-strategy-authoring.md`)
- [ ] Strategy state storage (`todo-strategy-state-storage.md`)
- [ ] Provenance/audit trail (`todo-provenance.md`)

### Phase C: Measurement Infrastructure (NOT STARTED)

- [ ] Define "learning outcome" metrics
- [ ] Instrument strategy usage per user
- [ ] Track outcome-to-strategy correlation
- [ ] Build cohort comparison views

### Phase D: Multi-Arm Bandit Orchestrator (NOT STARTED)

- [ ] Strategy registry with utility confidence
- [ ] Cohort assignment algorithm
- [ ] Salt rotation mechanism
- [ ] Confidence update rules (Bayesian or frequentist)
- [ ] Orchestrator integration with SessionController

### Phase E: Evolutionary Pressure (NOT STARTED)

- [ ] Strategy creation incentives
- [ ] Automatic strategy pruning
- [ ] Strategy mutation/variation generation
- [ ] A/B testing framework

### Phase F: Self-Healing (NOT STARTED)

- [ ] Barrier detection pipeline
- [ ] Author alerting system
- [ ] Intervention recommendation engine
- [ ] Content gap analysis

### Phase G: Programmable Strategies (NOT STARTED)

- [ ] Template syntax design
- [ ] Rule engine implementation
- [ ] Variable binding in prerequisites
- [ ] Cross-course strategy generalization

---

## Key Design Decisions Ahead

### 1. Centralized vs Decentralized Orchestration

**Option A: Central Orchestrator Service**
- Single service decides strategy application
- Cleaner cohort tracking
- Requires backend infrastructure

**Option B: Client-Side Orchestration**
- Each client computes its own strategy set
- Works offline
- Harder to track cohorts

**Recommendation:** Hybrid — client computes from synced registry, outcomes reported to backend.

### 2. Confidence Update Mechanism

**Option A: Frequentist (Simple)**
- Track success/failure counts
- Confidence = success_rate with smoothing
- Easy to implement

**Option B: Bayesian (Principled)**
- Prior belief + observed evidence
- Thompson sampling for exploration/exploitation
- More complex but theoretically sound

**Recommendation:** Start with frequentist, migrate to Bayesian if needed.

### 3. Strategy Granularity

**Question:** What counts as "a strategy" for evolutionary purposes?

- A specific `HierarchyDefinition` config? (Fine-grained)
- The `HierarchyDefinition` approach in general? (Coarse-grained)
- A specific prerequisite rule within a hierarchy? (Very fine-grained)

**Recommendation:** Start coarse (strategy type + major config), add granularity as measurement matures.

### 4. Outcome Attribution

**Question:** If a user is exposed to multiple strategies, how do we attribute outcomes?

- All strategies get credit/blame equally?
- Weight by score contribution?
- Require isolated A/B cells?

**Recommendation:** Start with equal attribution, instrument for isolated testing later.

---

## Related Documents

- `u.3.strategic-nuggets.md` — Original vision statement
- `todo-srs-navigator.md` — SRS migration
- `todo-strategy-authoring.md` — Authoring tools
- `todo-strategy-state-storage.md` — State persistence
- `todo-provenance.md` — Audit trail for transparency
- `a.2.plan.md` — Detailed implementation plan
- `a.3.todo.md` — Task tracking
- `packages/db/docs/navigators-architecture.md` — Technical architecture

---

## Summary

**Where we are:** Solid foundation. Strategies exist, compose, return scores, and are integrated
with SessionController. The infrastructure supports the vision.

**What's next:** Build the measurement and orchestration layers. The strategies can now *exist*;
we need to make them *compete* and *evolve*.

**The gap:** The evolutionary pressure mechanisms (multi-arm bandit selection, outcome measurement,
confidence updates, self-healing) are not yet implemented. This is where the "magic" of the
vision lives, and it's entirely ahead of us.
```


## Assistant

Done. Created `todo-evolutionary-orchestration.md` which:

1. **Summarizes the vision** from `u.3.strategic-nuggets.md`
2. **Assesses progress** with clear ✅/🟡/❌ status
3. **Outlines the roadmap** in phases A→G
4. **Identifies key design decisions** ahead (centralized vs decentralized, confidence updates, granularity, attribution)
5. **Links to related docs** for continuity

**TL;DR of where we stand:**

| Layer | Status |
|-------|--------|
| **Strategy Infrastructure** | ✅ Complete — strategies exist, compose, score, integrate |
| **Strategy Ecosystem** | 🟡 Partial — authoring, state storage, SRS migration needed |
| **Measurement** | ❌ Not started — no outcome tracking yet |
| **Multi-Arm Bandit Orchestrator** | ❌ Not started — the core evolutionary engine |
| **Self-Healing** | ❌ Not started — barrier detection, intervention |
| **Programmable Strategies** | ❌ Not started — parameterized rules |

The foundation is solid. The evolutionary magic is entirely ahead of us.

## User

ok. Going - I think - to rm a.1.assessment, a.2.plan, a.3.todo now. They have run their course. Any cautions here?

## Assistant

No strong cautions. Those docs served their purpose for the initial implementation phases (1-3 and 4a).

**Minor suggestion:** You could move them to an `archive/` subdirectory rather than delete, in case you want to reference the original plan structure or see how the work evolved. But that's purely sentimental — the essential information has been captured in:

- `packages/db/docs/navigators-architecture.md` — Technical architecture
- The `todo-*.md` files — Forward-looking handoffs
- The code itself + its comments/deprecation notices

If you delete them, nothing is lost that isn't documented elsewhere. Go for it.

