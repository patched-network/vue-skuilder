# Assessment: User-Scoped Navigation Strategies

## Context

The navigation system currently operates with **course-scoped strategies**: all `ContentNavigationStrategyData` documents live in the course database and apply uniformly to all users of that course.

The request is to explore **user-scoped navigation strategies**, particularly filters for:
- **Goal-based learning**: Users interested in specific tags (e.g., learning an instrument by ear) but not others (e.g., reading music notation)
- **Other user-specific filtering needs**

## Current Architecture

### How Strategies Work Today

1. **Course-scoped storage**: Strategy documents extend `SkuilderCourseData` (with `course` field) and are stored in the course database
2. **Pipeline assembly**: `PipelineAssembler` reads all strategies from course DB and assembles them into a Pipeline (generators + filters)
3. **Uniform application**: All users of a course get the same pipeline
4. **User context available**: Filters receive `FilterContext` with `user`, `course`, and `userElo`, so they can *read* user data

### Relevant Data Structures

**Course Registration** (`packages/db/src/core/types/user.ts:31-41`):
```typescript
interface CourseRegistration {
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
```

**Existing Tag System**:
- Cards are tagged with semantic labels (e.g., `letter-s`, `music-theory`, `sight-reading`)
- `RelativePriorityNavigator` already filters based on tag priorities
- `InterferenceMitigatorNavigator` uses tags to identify confusable concepts

## Use Cases (Expanded)

### 1. Goal-Based Tag Filtering
**Example**: A musician wants to learn piano by ear, but not interested in reading sheet music.

**User preference**:
- Include tags: `ear-training`, `chord-progressions`, `improvisation`
- Exclude tags: `sight-reading`, `music-notation`, `staff-reading`

**Behavior**: Filter should set `score = 0` for cards with excluded tags, optionally boost cards with included tags.

### 2. Selective Topic Focus
**Example**: A chess student only wants to practice endgames, not openings.

**User preference**:
- Include tags: `endgame`, `checkmate-patterns`, `pawn-endings`
- Exclude tags: `opening-theory`, `opening-repertoire`

### 3. Accessibility Preferences
**Example**: A dyslexic user wants to avoid heavy text-based cards.

**User preference**:
- Exclude tags: `reading-comprehension`, `text-heavy`
- Prefer tags: `visual`, `diagram-based`

### 4. Difficulty Customization
**Example**: A user wants to skip beginner content they already know.

**User preference**:
- Exclude tags: `grade-1`, `basic-addition`
- Start at tags: `grade-3`, `multiplication`

### 5. Time-Based Focus
**Example**: A user cramming for an exam wants to focus only on exam topics.

**User preference**:
- Temporary filter (expiration date)
- Include tags: `exam-topic-A`, `exam-topic-B`

## Options

### Option A: User Preferences in CourseRegistration.settings

**Mechanism**: Store tag preferences in existing `CourseRegistration.settings` field, create a `UserTagPreferenceFilter` that reads these settings.

**Implementation**:
```typescript
// In CourseRegistration.settings:
{
  "tagPreferences": {
    "include": ["ear-training", "improvisation"],
    "exclude": ["sight-reading", "music-notation"],
    "boost": { "ear-training": 1.5 }
  }
}

// New filter: UserTagPreferenceFilter
class UserTagPreferenceFilter extends ContentNavigator implements CardFilter {
  async transform(cards: WeightedCard[], context: FilterContext) {
    const prefs = await this.getUserTagPreferences(context.user, context.course);

    return cards.map(card => {
      const cardTags = await this.getCardTags(card.cardId);

      // Exclude if any excluded tag present
      if (prefs.exclude.some(tag => cardTags.includes(tag))) {
        return { ...card, score: 0, provenance: [...] };
      }

      // Boost if included tag present
      const boost = prefs.boost[cardTags[0]] ?? 1.0;
      return { ...card, score: card.score * boost, provenance: [...] };
    });
  }
}
```

**Strategy registration**:
- Filter is course-configured (exists in course DB as a `NAVIGATION_STRATEGY` doc)
- But its *behavior* varies per-user based on their settings
- This is a **user-parameterized filter** rather than a truly user-owned strategy

**Pros**:
- ✅ Uses existing `settings` infrastructure
- ✅ No new document types
- ✅ Simple to implement
- ✅ Preferences sync via existing user DB sync

**Cons**:
- ❌ Filter must be explicitly configured by course author (not user-initiated)
- ❌ Settings field is generic key-value; no schema validation
- ❌ Preferences live in large `CourseRegistrationDoc` (update contention)

**Best for**: Course authors who want to *allow* user customization within a predefined framework.

---

### Option B: User-Owned Strategy Documents in User DB

**Mechanism**: Create a new doc type `USER_NAVIGATION_STRATEGY` that lives in the **user database**. During pipeline assembly, fetch both course strategies and user strategies.

**Implementation**:
```typescript
// New doc type (in user DB)
interface UserNavigationStrategyData {
  _id: `USER_NAVIGATION_STRATEGY-${courseId}-${strategyName}`;
  docType: DocType.USER_NAVIGATION_STRATEGY;
  courseId: string;  // Which course this applies to
  userId: string;    // Owner
  name: string;
  implementingClass: string;  // e.g., "UserTagPreferenceFilter"
  serializedData: string;     // User's tag preferences
  enabled: boolean;
}

// Modified PipelineAssembler
class PipelineAssembler {
  async assemble(input: PipelineAssemblerInput): Promise<PipelineAssemblyResult> {
    // Fetch course strategies (existing)
    const courseStrategies = await course.getAllNavigationStrategies();

    // Fetch user strategies (NEW)
    const userStrategies = await user.getUserNavigationStrategies(course.getCourseID());

    // Merge and assemble
    const allStrategies = [...courseStrategies, ...userStrategies];
    // ... rest of assembly logic
  }
}
```

**Pros**:
- ✅ Users can create/modify their own strategies
- ✅ True user ownership (not just parameterizing course-defined filters)
- ✅ Clean separation (user DB vs course DB)
- ✅ Can enable/disable without deleting
- ✅ Portable across devices (syncs with user DB)

**Cons**:
- ❌ New doc type and storage mechanism
- ❌ More complex assembly (need to fetch from two sources)
- ❌ Potential for conflicts (what if user strategy contradicts course strategy?)
- ❌ Ordering ambiguity (do user filters run before or after course filters?)

**Best for**: Power users who want full control over their learning path.

---

### Option C: Hybrid — User Preferences + Course-Provided Filter

**Mechanism**: Combine both approaches:
1. Course author includes a generic `UserTagPreferenceFilter` in the course pipeline
2. Users configure their preferences via UI (stored in `CourseRegistration.settings`)
3. Filter reads user preferences at runtime

**Benefits**:
- ✅ Course author opts-in to user customization (safe, controlled)
- ✅ Users get customization without managing strategy documents
- ✅ No new doc types needed
- ✅ Preferences are scoped to courses that support them

**Ordering**:
- Course can control filter position in pipeline
- Typically would run *after* hierarchyDefinition (don't let users bypass prerequisites) but *before* relativePriority

**Best for**: Balancing user agency with course author control.

---

### Option D: Strategy State Storage (Future-Proof)

**Mechanism**: Leverage the planned `STRATEGY_STATE` doc type (see `packages/db/docs/todo-strategy-state-storage.md`) to store user-specific filter state.

**Approach**:
```typescript
// Course-configured filter that stores per-user state
class AdaptiveUserPreferenceFilter extends ContentNavigator implements CardFilter {
  async transform(cards: WeightedCard[], context: FilterContext) {
    // Read user's inferred preferences (based on past behavior)
    const inferredPrefs = await this.getStrategyState<InferredPreferences>();

    // Apply preferences (similar to Option A)
    // ...

    // Update inferred preferences based on user behavior
    await this.putStrategyState(updatedPrefs);
  }
}

interface InferredPreferences {
  preferredTags: string[];
  avoidedTags: string[];
  lastUpdated: string;
}
```

**Pros**:
- ✅ Can infer preferences from user behavior (implicit personalization)
- ✅ Doesn't require explicit user configuration
- ✅ Strategies can learn and adapt over time
- ✅ Fits into planned infrastructure

**Cons**:
- ❌ Requires implementing strategy state storage first
- ❌ Inference logic is complex and may be opaque to users
- ❌ Harder to debug ("why am I not seeing X?")

**Best for**: Adaptive, ML-style personalization rather than explicit user goals.

---

## Other User-Scoped Filter Possibilities

Beyond tag preferences, user-scoped filters could support:

### 1. **Review Urgency Personalization**
- Some users prefer "little and often" (review urgent cards immediately)
- Others prefer "batch reviews" (accumulate reviews, do them all at once)
- Filter adjusts SRS card scores based on user's review style preference

### 2. **Difficulty Tolerance**
- User sets "challenge level" slider (conservative → aggressive)
- Filter penalizes cards far from user's ELO (conservative) or allows wider range (aggressive)
- Similar to existing `eloDistanceFilter` but user-configurable

### 3. **Content Freshness**
- Some users prefer variety (boost cards they haven't seen in a while)
- Others prefer mastery (focus on cards they're currently working on)
- Filter tracks card recency per-user and applies preference

### 4. **Session Length Adaptation**
- User indicates available time (5 min, 15 min, 30 min)
- Filter prioritizes quick cards (for short sessions) or allows complex cards (for long sessions)
- Requires card metadata: estimated time-to-complete

### 5. **Confidence-Based Pacing**
- User sets "confidence threshold" for moving to new content
- Filter gates new cards until user demonstrates mastery (higher threshold than course default)
- Complements `hierarchyDefinition` but with user-specific rigor

---

## Recommendation

### Primary: **Option C (Hybrid)** for goal-based tag filtering

**Rationale**:
1. **Solves the stated use case**: Goal-based learning (e.g., music by ear vs notation)
2. **Minimal complexity**: No new doc types, uses existing `settings`
3. **User-friendly**: Settings can be configured via UI without understanding strategies
4. **Course-controlled**: Authors opt-in, preventing chaos

**Implementation steps**:
1. Create `UserTagPreferenceFilter` class
2. Add UI for users to configure tag preferences (when course has enabled the filter)
3. Store preferences in `CourseRegistration.settings.tagPreferences`
4. Register filter in `NavigatorRoles` as `FILTER`
5. Document for course authors

---

### Secondary: **Option B (User-Owned Strategies)** for power users (future)

**When to implement**: After basic goal filtering is proven useful, and users request more control.

**Use case**: Advanced learners who want to create complex, multi-filter pipelines tailored to their needs (e.g., "I want ELO + my custom tag filter + interference mitigation tuned for my learning style").

---

### Tertiary: **Option D (Strategy State)** for adaptive personalization (long-term)

**When to implement**: Once strategy state storage infrastructure exists (see `todo-strategy-state-storage.md`).

**Use case**: Implicit personalization — system learns user preferences from behavior rather than requiring explicit configuration.

---

## Open Questions

1. **Conflict resolution**: What if user excludes a tag that's a course prerequisite?
   - **Answer**: User filters should run *after* `hierarchyDefinition` so prerequisites are enforced first

2. **UI for tag preferences**: Where do users configure this?
   - **Answer**: Course settings page (when enrolled), or during onboarding ("What are your learning goals?")

3. **Temporary preferences**: How do users enable time-limited focus (e.g., exam prep)?
   - **Answer**: Add `expiresAt` field to preference config; filter ignores expired preferences

4. **Discoverability**: How do users know which tags are available to filter?
   - **Answer**: UI shows all course tags with descriptions; users can browse and select

5. **Migration path**: If course adds new tags, do users need to update preferences?
   - **Answer**: Use allowlist (include) vs blocklist (exclude) patterns; allowlist requires updates, blocklist is automatically inclusive of new tags

6. **Analytics**: Should the system track which tags users exclude to inform content design?
   - **Answer**: Yes — this feeds into "self-healing content" vision (see `todo-evolutionary-orchestration.md`)

---

## Related Files & Docs

- `packages/db/src/core/navigators/relativePriority.ts` — Example of tag-based filtering
- `packages/db/src/core/types/user.ts` — CourseRegistration.settings structure
- `packages/db/src/core/navigators/PipelineAssembler.ts` — Where strategies are assembled
- `packages/db/docs/todo-strategy-state-storage.md` — Planned state storage for strategies
- `packages/db/docs/todo-evolutionary-orchestration.md` — Long-term vision for adaptive strategies
- `packages/db/docs/navigators-architecture.md` — Pipeline architecture overview

---

## Summary

**Recommendation**: Implement **Option C (Hybrid)** — a course-configurable `UserTagPreferenceFilter` that reads user preferences from `CourseRegistration.settings`.

This provides goal-based learning (the primary use case) with minimal complexity, while leaving the door open for more sophisticated user-owned strategies (Option B) and adaptive personalization (Option D) in the future.

The key insight: **filters already have access to user context**. We don't need a new strategy scoping mechanism — we need **user-parameterized filters** that read user preferences and apply them within the existing pipeline architecture.
