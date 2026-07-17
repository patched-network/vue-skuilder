import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext, GeneratorResult, ReplanHints } from './types';
import {
  captureStrategyPressure,
  type PressureGaugeDebug,
} from '../StrategyPressureDebugger';
import { logger } from '@db/util/logger';

// ============================================================================
// PRESCRIBED CARDS GENERATOR
// ============================================================================
//
// A stateful generator for authored, course-prescribed content.
//
// Unlike ELO/SRS, prescribed content is explicitly authored curriculum intent.
// This generator therefore tracks whether prescribed targets have actually been
// encountered by the user, applies progressive pressure to stale/pending target
// groups, and can emit upstream support cards when direct targets remain
// blocked behind prerequisite chains.
//
// The first intended use case is intro-card reliability:
//
// - direct targets: intro cards that must eventually surface
// - support cards: low-complexity cards that help satisfy prereqs for blocked
//   intro targets
//
// Prescribed content still participates in the normal pipeline. Hierarchy,
// lesson gating, letter gating, interference, and priority filters continue to
// shape final ordering.
//
// ============================================================================

interface HierarchyWalkConfig {
  enabled?: boolean;
  maxDepth?: number;
}

interface PrescribedGroupConfig {
  id: string;
  targetCardIds: string[];
  supportCardIds?: string[];
  supportTagPatterns?: string[];
  freshnessWindowSessions?: number;
  maxDirectTargetsPerRun?: number;
  maxSupportCardsPerRun?: number;
  hierarchyWalk?: HierarchyWalkConfig;
  retireOnEncounter?: boolean;
  /**
   * Tag patterns identifying *practice* skills to drill once unlocked. For each
   * course tag matching one of these patterns that is (a) unlocked — all its
   * hierarchy prerequisites met, i.e. the learner has been introduced to it —
   * but (b) still under-practiced (per-tag attempt count below
   * `practiceMinCount`), the generator emits cards carrying that tag into the
   * candidate pool. This closes the post-intro drilling gap independent of
   * global-ELO retrieval (easy drill cards that the ELO window never reaches).
   * Ordering/emphasis is left to the pipeline's scoring + decaying boost.
   */
  practiceTagPatterns?: string[];
  /** Attempt-count threshold below which a practice skill is "under-practiced". */
  practiceMinCount?: number;
  /** Cap on practice cards emitted per run (across all under-practiced skills). */
  maxPracticeCardsPerRun?: number;
}

interface PrescribedConfig {
  groups: PrescribedGroupConfig[];
}

interface GroupCardState {
  encounteredCardIds: string[];
  pendingTargetIds: string[];
  lastSurfacedAt: string | null;
  sessionsSinceSurfaced: number;
  lastSupportAt: string | null;
  blockedTargetIds: string[];
  lastResolvedSupportTags: string[];
}

interface PrescribedProgressState {
  updatedAt: string;
  groups: Record<string, GroupCardState>;
  /**
   * Per-practice-tag debt age: tag → ISO timestamp when the skill first appeared
   * unlocked-but-under-practiced. Drives the practice-debt staleness escalation
   * (older unpaid debt → higher pressure). An entry is carried while the debt is
   * open and dropped the moment the skill reaches `practiceMinCount` — so the
   * map self-prunes and "staleness" is measured from first-owed, not last-seen.
   */
  practiceDebt?: Record<string, string>;
}

interface TagPrerequisite {
  tag: string;
  masteryThreshold?: {
    minElo?: number;
    minCount?: number;
  };
  preReqBoost?: number;
  targetBoost?: number;
}

interface HierarchyConfig {
  prerequisites: Record<string, TagPrerequisite[]>;
}

interface GroupRuntimeState {
  group: PrescribedGroupConfig;
  encounteredTargets: Set<string>;
  pendingTargets: string[];
  blockedTargets: string[];
  surfaceableTargets: string[];
  targetTags: Map<string, string[]>;
  supportCandidates: string[];
  discoveredSupportCandidates: string[];
  supportTags: string[];
  pressureMultiplier: number;
  supportMultiplier: number;
  /** Carried-forward staleness count driving the pressure multipliers. */
  sessionsSinceSurfaced: number;
  debugVersion: string;
}

/** One open practice debt, surfaced for the strategy-pressure debug channel. */
interface PracticeDebtDebug {
  tag: string;
  multiplier: number;
  /** ISO timestamp when the skill first appeared unlocked-but-under-practiced. */
  firstOwedAt: string;
}

interface HintEmissionSummary {
  boostTags: Record<string, number>;
  blockedTargetIds: string[];
  supportTags: string[];
}

const DEFAULT_FRESHNESS_WINDOW = 3;
const DEFAULT_MAX_DIRECT_PER_RUN = 3;
const DEFAULT_MAX_SUPPORT_PER_RUN = 3;
const DEFAULT_HIERARCHY_DEPTH = 2;
const DEFAULT_MIN_COUNT = 3;
const DEFAULT_PRACTICE_MIN_COUNT = 3;
const DEFAULT_MAX_PRACTICE_PER_RUN = 4;
const BASE_TARGET_SCORE = 1.0;
const BASE_SUPPORT_SCORE = 0.8;
const DISCOVERED_SUPPORT_SCORE = 12.0;
// Practice drill cards: a *practice-debt pressure*, parallel to the SRS backlog
// multiplier. An unlocked-but-under-practiced skill owes reps; that debt is
// durable (keyed off per-tag attempt count) and discharges by practice, not
// time. The score is base × a debt multiplier that starts at PRACTICE_BASE_MULT
// (so a few reps land promptly after intro, competing with pressured reviews)
// and escalates by how long the debt has stayed open (capped), so a chronically
// out-competed skill eventually forces exposure rather than competing at flat
// parity forever. Replaces the old flat 1.0, which punted emphasis to the
// session-scoped intro boost that evaporates at session end.
const BASE_PRACTICE_SCORE = 1.0;
const PRACTICE_BASE_MULT = 2.0;
const MAX_PRACTICE_MULTIPLIER = 4.0;
// Added to the multiplier per day the debt stays open (linear, then clamped).
const PRACTICE_STALENESS_BUMP_PER_DAY = 0.5;
const MAX_TARGET_MULTIPLIER = 8.0;
const MAX_SUPPORT_MULTIPLIER = 4.0;

const PRESCRIBED_DEBUG_VERSION = 'testversion-prescribed-v3';

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function isoNow(): string {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function matchesTagPattern(tag: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}$`);
  return re.test(tag);
}

/**
 * Extract the word stem from a card ID for deduplication.
 * ML: c-ml-{word}-{blanks} → {word}
 * WS: c-ws-{word}-{contrast} → {word}
 * Other: full cardId as fallback.
 */
function extractWordStem(cardId: string): string {
  for (const prefix of ['c-ml-', 'c-ws-', 'c-spelling-']) {
    if (cardId.startsWith(prefix)) {
      const rest = cardId.slice(prefix.length);
      const lastDash = rest.lastIndexOf('-');
      return lastDash > 0 ? rest.slice(0, lastDash) : rest;
    }
  }
  return cardId;
}

/** Fisher-Yates shuffle in place. */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Compact age string for debt-open durations: 42m / 7h / 3d. */
function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function pickTopByScore(cards: WeightedCard[], limit: number): WeightedCard[] {
  return [...cards]
    .sort((a, b) => b.score - a.score || a.cardId.localeCompare(b.cardId))
    .slice(0, limit);
}

export default class PrescribedCardsGenerator extends ContentNavigator implements CardGenerator {
  name: string;
  private config: PrescribedConfig;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.name = strategyData.name || 'Prescribed Cards';
    this.config = this.parseConfig(strategyData.serializedData);

    logger.debug(
      `[Prescribed] Initialized with ${this.config.groups.length} groups and ` +
        `${this.config.groups.reduce((n, g) => n + g.targetCardIds.length, 0)} targets`
    );
  }

  protected override get strategyKey(): string {
    return 'PrescribedProgress';
  }

  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<GeneratorResult> {
    if (this.config.groups.length === 0 || limit <= 0) {
      return { cards: [] };
    }

    const courseId = this.course.getCourseID();
    const activeCards = await this.user.getActiveCards();
    const activeIds = new Set(activeCards.map((ac) => ac.cardID));

    const seenCards = await this.user.getSeenCards(courseId).catch(() => []);
    const seenIds = new Set(seenCards);

    const progress = (await this.getStrategyState<PrescribedProgressState>()) ?? {
      updatedAt: isoNow(),
      groups: {},
    };

    const hierarchyConfigs = await this.loadHierarchyConfigs();
    const courseReg = await this.user.getCourseRegDoc(courseId).catch(() => null);
    const userGlobalElo =
      typeof courseReg?.elo === 'number'
        ? courseReg.elo
        : courseReg?.elo?.global?.score ?? context?.userElo ?? 1000;
    const userTagElo =
      typeof courseReg?.elo === 'number'
        ? {}
        : courseReg?.elo?.tags ?? {};

    const allTargetIds = dedupe(this.config.groups.flatMap((g) => g.targetCardIds));
    const allSupportIds = dedupe(this.config.groups.flatMap((g) => g.supportCardIds ?? []));
    const allRelevantIds = dedupe([...allTargetIds, ...allSupportIds]);

    const tagsByCard =
      allRelevantIds.length > 0
        ? await this.course.getAppliedTagsBatch(allRelevantIds)
        : new Map<string, string[]>();

    const courseTagDocs = await this.course.getCourseTagStubs().catch(
      () =>
        ({
          rows: [],
          offset: 0,
          total_rows: 0,
        }) as unknown as Awaited<ReturnType<CourseDBInterface['getCourseTagStubs']>>
    );
    const cardsByTag = new Map<string, string[]>();
    for (const row of courseTagDocs.rows ?? []) {
      const tagDoc = row.doc as { name?: string; taggedCards?: string[] } | undefined;
      if (tagDoc?.name && Array.isArray(tagDoc.taggedCards)) {
        cardsByTag.set(tagDoc.name, [...tagDoc.taggedCards]);
      }
    }

    const nextState: PrescribedProgressState = {
      updatedAt: isoNow(),
      groups: {},
    };

    const emitted: WeightedCard[] = [];
    const emittedIds = new Set<string>();
    const groupRuntimes: GroupRuntimeState[] = [];
    // Practice-debt ages carried forward: stamped when a skill first appears
    // under-practiced, dropped once it's discharged (see buildPracticeCards).
    const priorPracticeDebt = progress.practiceDebt ?? {};
    const nextPracticeDebt: Record<string, string> = {};
    const practiceDebtsByGroup = new Map<string, PracticeDebtDebug[]>();

    for (const group of this.config.groups) {
      const runtime = this.buildGroupRuntimeState({
        group,
        priorState: progress.groups[group.id],
        activeIds,
        seenIds,
        tagsByCard,
        cardsByTag,
        hierarchyConfigs,
        userTagElo,
        userGlobalElo,
      });

      groupRuntimes.push(runtime);

      logger.info(
        `[Prescribed] Group '${group.id}': ` +
          `${group.targetCardIds.length} targets total, ` +
          `${runtime.encounteredTargets.size} encountered, ` +
          `${runtime.pendingTargets.length} pending ` +
          `(${runtime.surfaceableTargets.length} surfaceable, ${runtime.blockedTargets.length} blocked), ` +
          `${runtime.supportCandidates.length} authored support candidates, ` +
          `${runtime.discoveredSupportCandidates.length} discovered support candidates, ` +
          `pressure=${runtime.pressureMultiplier.toFixed(2)}`
      );
      if (runtime.blockedTargets.length > 0) {
        logger.info(
          `[Prescribed] Group '${group.id}' blocked targets: ${runtime.blockedTargets.join(', ')}`
        );
        logger.info(
          `[Prescribed] Group '${group.id}' support tags needed: ${runtime.supportTags.join(', ') || '(none)'}`
        );
        logger.info(
          `[Prescribed] Group '${group.id}' escalation mode: ` +
            (runtime.supportCandidates.length > 0
              ? 'direct-support'
              : runtime.discoveredSupportCandidates.length > 0
                ? 'inserted-support-candidates'
                : 'boost-only')
        );
        if (runtime.discoveredSupportCandidates.length > 0) {
          logger.info(
            `[Prescribed] Group '${group.id}' discovered support candidates: ${runtime.discoveredSupportCandidates.join(', ')}`
          );
        }
      }

      nextState.groups[group.id] = this.buildNextGroupState(runtime, progress.groups[group.id]);

      const directCards = this.buildDirectTargetCards(
        runtime,
        courseId,
        emittedIds
      );
      const supportCards = this.buildSupportCards(
        runtime,
        courseId,
        emittedIds
      );
      const discoveredSupportCards = this.buildDiscoveredSupportCards(
        runtime,
        courseId,
        emittedIds
      );
      const practice = this.buildPracticeCards({
        group,
        courseId,
        emittedIds,
        cardsByTag,
        hierarchyConfigs,
        userTagElo,
        userGlobalElo,
        activeIds,
        seenIds,
        priorPracticeDebt,
        nextPracticeDebt,
      });
      practiceDebtsByGroup.set(group.id, practice.debts);

      emitted.push(...directCards, ...supportCards, ...discoveredSupportCards, ...practice.cards);
    }

    // Persist the carried-forward practice debt (self-pruned: discharged skills
    // simply aren't re-stamped above, so they drop out of the next state).
    nextState.practiceDebt = nextPracticeDebt;

    const hintSummary = this.buildSupportHintSummary(groupRuntimes);
    const hints: ReplanHints | undefined =
      Object.keys(hintSummary.boostTags).length > 0
        ? {
            boostTags: hintSummary.boostTags,
            _label:
              `prescribed-support (${hintSummary.supportTags.length} tags; ` +
              `blocked=${hintSummary.blockedTargetIds.length}; ` +
              `testversion=${PRESCRIBED_DEBUG_VERSION})`,
          }
        : undefined;

    if (hints) {
      const tagEntries = Object.entries(hints.boostTags ?? {}) as Array<[string, number]>;
      logger.info(
        `[Prescribed] Emitting ${tagEntries.length} boost hint(s): ` +
          tagEntries.map(([tag, mult]) => `${tag}×${mult.toFixed(1)}`).join(', ')
      );
    } else {
      logger.info('[Prescribed] No hints to emit (no blocked targets or no support tags)');
    }

    // Push this run's pressure state to the live-overlay debug channel. Done
    // before the empty-emission return — an all-blocked run is exactly the
    // state the overlay most needs to show.
    this.capturePressureSnapshot(courseId, groupRuntimes, practiceDebtsByGroup, emitted, hints);

    if (emitted.length === 0) {
      logger.info(
        '[Prescribed] 0 cards emitted (all targets blocked, authored/discovered support candidates exhausted)' +
          (hints ? ' — boost hints emitted but may not survive filters' : '')
      );
      await this.putStrategyState(nextState).catch((e) => {
        logger.debug(`[Prescribed] Failed to persist empty-state update: ${e}`);
      });
      return hints ? { cards: [], hints } : { cards: [] };
    }

    const finalCards = pickTopByScore(emitted, limit);

    const surfacedByGroup = new Map<string, { targetIds: string[]; supportIds: string[] }>();
    for (const card of finalCards) {
      const prov = card.provenance[0];
      // Practice cards are not target/support surfacing — they must not reset a
      // group's freshness/pressure state (which tracks whether *intro targets*
      // are getting through). Skip them here.
      if (prov?.reason.includes('mode=practice')) continue;
      const groupId = prov?.reason.match(/group=([^;]+)/)?.[1];
      const mode = prov?.reason.includes('mode=support') ? 'supportIds' : 'targetIds';
      if (!groupId) continue;
      if (!surfacedByGroup.has(groupId)) {
        surfacedByGroup.set(groupId, { targetIds: [], supportIds: [] });
      }
      surfacedByGroup.get(groupId)![mode].push(card.cardId);
    }

    for (const group of this.config.groups) {
      const groupState = nextState.groups[group.id];
      const surfaced = surfacedByGroup.get(group.id);
      if (surfaced && (surfaced.targetIds.length > 0 || surfaced.supportIds.length > 0)) {
        groupState.lastSurfacedAt = isoNow();
        groupState.sessionsSinceSurfaced = 0;
        if (surfaced.supportIds.length > 0) {
          groupState.lastSupportAt = isoNow();
        }
      }
    }

    await this.putStrategyState(nextState).catch((e) => {
      logger.debug(`[Prescribed] Failed to persist prescribed progress: ${e}`);
    });

    logger.info(
      `[Prescribed] Emitting ${finalCards.length} cards ` +
        `(${finalCards.filter((c) => c.provenance[0]?.reason.includes('mode=target')).length} target, ` +
        `${finalCards.filter((c) => c.provenance[0]?.reason.includes('mode=support')).length} support, ` +
        `${finalCards.filter((c) => c.provenance[0]?.reason.includes('mode=discovered-support')).length} discovered support)`
    );

    return hints ? { cards: finalCards, hints } : { cards: finalCards };
  }

  private buildSupportHintSummary(groupRuntimes: GroupRuntimeState[]): HintEmissionSummary {
    const boostTags: Record<string, number> = {};
    const blockedTargetIds = new Set<string>();
    const supportTags = new Set<string>();

    for (const runtime of groupRuntimes) {
      if (runtime.blockedTargets.length === 0 || runtime.supportTags.length === 0) {
        continue;
      }

      runtime.blockedTargets.forEach((cardId) => blockedTargetIds.add(cardId));

      for (const tag of runtime.supportTags) {
        supportTags.add(tag);
        boostTags[tag] = (boostTags[tag] ?? 1) * runtime.supportMultiplier;
      }
    }

    return {
      boostTags,
      blockedTargetIds: [...blockedTargetIds].sort(),
      supportTags: [...supportTags].sort(),
    };
  }

  /**
   * Translate this run's per-group runtimes and practice debts into gauges on
   * the generic strategy-pressure debug channel (rendered by the live session
   * overlay's "strategy backpressure" section).
   */
  private capturePressureSnapshot(
    courseId: string,
    groupRuntimes: GroupRuntimeState[],
    practiceDebtsByGroup: Map<string, PracticeDebtDebug[]>,
    emitted: WeightedCard[],
    hints: ReplanHints | undefined
  ): void {
    const now = Date.now();
    const gauges: PressureGaugeDebug[] = [];

    for (const runtime of groupRuntimes) {
      const group = runtime.group;
      const window = group.freshnessWindowSessions ?? DEFAULT_FRESHNESS_WINDOW;

      gauges.push({
        id: `group:${group.id}:target`,
        label: `${group.id} targets`,
        multiplier: runtime.pressureMultiplier,
        max: MAX_TARGET_MULTIPLIER,
        detail:
          `${runtime.pendingTargets.length} pending ` +
          `(${runtime.surfaceableTargets.length} surfaceable, ${runtime.blockedTargets.length} blocked) · ` +
          `sinceSurfaced ${runtime.sessionsSinceSurfaced}/${window}`,
        items: runtime.blockedTargets.map((cardId) => ({ label: cardId, value: 'blocked' })),
      });

      if (runtime.blockedTargets.length > 0) {
        const mode =
          runtime.supportCandidates.length > 0
            ? 'direct-support'
            : runtime.discoveredSupportCandidates.length > 0
              ? 'inserted-support'
              : 'boost-only';
        gauges.push({
          id: `group:${group.id}:support`,
          label: `${group.id} support`,
          multiplier: runtime.supportMultiplier,
          max: MAX_SUPPORT_MULTIPLIER,
          detail: `mode=${mode} · ${runtime.supportTags.length} support tag(s)`,
          items: runtime.supportTags.map((tag) => ({ label: tag })),
        });
      }

      const debts = practiceDebtsByGroup.get(group.id) ?? [];
      if (debts.length > 0) {
        gauges.push({
          id: `group:${group.id}:practice-debt`,
          label: `${group.id} practice debt`,
          multiplier: Math.max(...debts.map((d) => d.multiplier)),
          max: MAX_PRACTICE_MULTIPLIER,
          detail: `${debts.length} under-practiced skill(s)`,
          items: debts.map((d) => ({
            label: d.tag,
            value: `×${d.multiplier.toFixed(2)} · open ${formatAge(now - new Date(d.firstOwedAt).getTime())}`,
          })),
        });
      }
    }

    captureStrategyPressure({
      source: 'prescribed',
      courseId,
      gauges,
      topScore: emitted.length > 0 ? Math.max(...emitted.map((c) => c.score)) : null,
      hintsLabel: hints?._label,
      timestamp: now,
    });
  }

  private parseConfig(serializedData: string): PrescribedConfig {
    try {
      const parsed = JSON.parse(serializedData) as { groups?: unknown[] };
      const groupsRaw = Array.isArray(parsed.groups) ? parsed.groups : [];
      const groups: PrescribedGroupConfig[] = groupsRaw
        .map((raw: any, i: number): PrescribedGroupConfig => ({
          id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : `group-${i + 1}`,
          targetCardIds: dedupe(
            (Array.isArray(raw.targetCardIds) ? raw.targetCardIds.filter((v: unknown): v is string => typeof v === 'string') : [])
          ),
          supportCardIds: dedupe(
            (Array.isArray(raw.supportCardIds) ? raw.supportCardIds.filter((v: unknown): v is string => typeof v === 'string') : [])
          ),
          supportTagPatterns: dedupe(
            (Array.isArray(raw.supportTagPatterns)
              ? raw.supportTagPatterns.filter((v: unknown): v is string => typeof v === 'string')
              : [])
          ),
          freshnessWindowSessions:
            typeof raw.freshnessWindowSessions === 'number' ? raw.freshnessWindowSessions : DEFAULT_FRESHNESS_WINDOW,
          maxDirectTargetsPerRun:
            typeof raw.maxDirectTargetsPerRun === 'number' ? raw.maxDirectTargetsPerRun : DEFAULT_MAX_DIRECT_PER_RUN,
          maxSupportCardsPerRun:
            typeof raw.maxSupportCardsPerRun === 'number' ? raw.maxSupportCardsPerRun : DEFAULT_MAX_SUPPORT_PER_RUN,
          hierarchyWalk: {
            enabled: raw.hierarchyWalk?.enabled !== false,
            maxDepth:
              typeof raw.hierarchyWalk?.maxDepth === 'number'
                ? raw.hierarchyWalk.maxDepth
                : DEFAULT_HIERARCHY_DEPTH,
          },
          retireOnEncounter: raw.retireOnEncounter !== false,
          practiceTagPatterns: dedupe(
            Array.isArray(raw.practiceTagPatterns)
              ? raw.practiceTagPatterns.filter((v: unknown): v is string => typeof v === 'string')
              : []
          ),
          practiceMinCount:
            typeof raw.practiceMinCount === 'number' ? raw.practiceMinCount : DEFAULT_PRACTICE_MIN_COUNT,
          maxPracticeCardsPerRun:
            typeof raw.maxPracticeCardsPerRun === 'number'
              ? raw.maxPracticeCardsPerRun
              : DEFAULT_MAX_PRACTICE_PER_RUN,
        }))
        .filter((g) => g.targetCardIds.length > 0);

      return { groups };
    } catch {
      return { groups: [] };
    }
  }

  private async loadHierarchyConfigs(): Promise<HierarchyConfig[]> {
    try {
      const strategies = await this.course.getAllNavigationStrategies();
      return strategies
        .filter((s: ContentNavigationStrategyData) => s.implementingClass === 'hierarchyDefinition')
        .map((s: ContentNavigationStrategyData) => {
          try {
            const parsed = JSON.parse(s.serializedData) as { prerequisites?: Record<string, TagPrerequisite[]> };
            return {
              prerequisites: parsed.prerequisites || {},
            } as HierarchyConfig;
          } catch {
            return { prerequisites: {} };
          }
        });
    } catch (e) {
      logger.debug(`[Prescribed] Failed to load hierarchy configs: ${e}`);
      return [];
    }
  }

  private buildGroupRuntimeState(args: {
    group: PrescribedGroupConfig;
    priorState?: GroupCardState;
    activeIds: Set<string>;
    seenIds: Set<string>;
    tagsByCard: Map<string, string[]>;
    cardsByTag: Map<string, string[]>;
    hierarchyConfigs: HierarchyConfig[];
    userTagElo: Record<string, { score: number; count: number }>;
    userGlobalElo: number;
  }): GroupRuntimeState {
    const {
      group,
      priorState,
      activeIds,
      seenIds,
      tagsByCard,
      cardsByTag,
      hierarchyConfigs,
      userTagElo,
      userGlobalElo,
    } = args;

    const encounteredTargets = new Set<string>();
    for (const cardId of group.targetCardIds) {
      if (activeIds.has(cardId) || seenIds.has(cardId)) {
        encounteredTargets.add(cardId);
      }
    }

    if (priorState?.encounteredCardIds?.length) {
      for (const cardId of priorState.encounteredCardIds) {
        encounteredTargets.add(cardId);
      }
    }

    const pendingTargets = group.targetCardIds.filter((id) => !encounteredTargets.has(id));
    const targetTags = new Map<string, string[]>();
    for (const cardId of pendingTargets) {
      targetTags.set(cardId, tagsByCard.get(cardId) ?? []);
    }

    const blockedTargets: string[] = [];
    const surfaceableTargets: string[] = [];
    const supportTags = new Set<string>();

    for (const cardId of pendingTargets) {
      const tags = targetTags.get(cardId) ?? [];
      const resolution = this.resolveBlockedSupportTags(
        tags,
        hierarchyConfigs,
        userTagElo,
        userGlobalElo,
        group.hierarchyWalk?.enabled !== false,
        group.hierarchyWalk?.maxDepth ?? DEFAULT_HIERARCHY_DEPTH
      );

      const introTags = tags.filter((tag) => tag.startsWith('gpc:intro:'));
      const exposeTags = new Set(tags.filter((tag) => tag.startsWith('gpc:expose:')));

      for (const introTag of introTags) {
        const suffix = introTag.slice('gpc:intro:'.length);
        if (suffix) {
          exposeTags.add(`gpc:expose:${suffix}`);
        }
      }

      const unmetExposeTags = [...exposeTags].filter((tag) => {
        const tagElo = userTagElo[tag];
        return !tagElo || tagElo.count < DEFAULT_MIN_COUNT;
      });

      if (unmetExposeTags.length > 0) {
        unmetExposeTags.forEach((tag) => supportTags.add(tag));
      }

      if (resolution.blocked || unmetExposeTags.length > 0) {
        blockedTargets.push(cardId);
        resolution.supportTags.forEach((t) => supportTags.add(t));
      } else {
        surfaceableTargets.push(cardId);
      }
    }

    const supportCandidates = dedupe([
      ...(group.supportCardIds ?? []),
      ...this.findSupportCardsByTags(
        group,
        tagsByCard,
        [...supportTags]
      ),
    ]).filter((id) => !activeIds.has(id) && !seenIds.has(id));

    const discoveredSupportCandidates =
      blockedTargets.length > 0 && supportTags.size > 0 && supportCandidates.length === 0
        ? this.findDiscoveredSupportCards({
            supportTags: [...supportTags],
            cardsByTag,
            activeIds,
            seenIds,
            excludedIds: new Set([
              ...group.targetCardIds,
              ...(group.supportCardIds ?? []),
            ]),
            limit: group.maxSupportCardsPerRun ?? DEFAULT_MAX_SUPPORT_PER_RUN,
          })
        : [];

    if (blockedTargets.length > 0 && supportTags.size > 0 && discoveredSupportCandidates.length === 0) {
      logger.info(
        `[Prescribed] Group '${group.id}' discovered 0 broader support candidates ` +
          `(blocked=${blockedTargets.length}; authoredSupport=${supportCandidates.length})`
      );
    }

    const sessionsSinceSurfaced = priorState?.sessionsSinceSurfaced ?? 0;
    const freshnessWindow = group.freshnessWindowSessions ?? DEFAULT_FRESHNESS_WINDOW;
    const staleSessions = Math.max(0, sessionsSinceSurfaced - freshnessWindow);

    const pressureMultiplier = pendingTargets.length === 0
      ? 1.0
      : clamp(1 + staleSessions * 0.75 + Math.min(2, pendingTargets.length * 0.1), 1.0, MAX_TARGET_MULTIPLIER);

    const supportMultiplier = blockedTargets.length === 0
      ? 1.0
      : clamp(1 + staleSessions * 0.5 + Math.min(1.5, blockedTargets.length * 0.15), 1.0, MAX_SUPPORT_MULTIPLIER);

    return {
      group,
      encounteredTargets,
      pendingTargets,
      blockedTargets,
      surfaceableTargets,
      targetTags,
      supportCandidates,
      discoveredSupportCandidates,
      supportTags: [...supportTags],
      pressureMultiplier,
      supportMultiplier,
      sessionsSinceSurfaced,
      debugVersion: PRESCRIBED_DEBUG_VERSION,
    };
  }

  private buildNextGroupState(runtime: GroupRuntimeState, prior?: GroupCardState): GroupCardState {
    const carriedSessions = prior?.sessionsSinceSurfaced ?? 0;
    const surfacedThisRun = false;

    return {
      encounteredCardIds: [...runtime.encounteredTargets].sort(),
      pendingTargetIds: [...runtime.pendingTargets].sort(),
      lastSurfacedAt: prior?.lastSurfacedAt ?? null,
      sessionsSinceSurfaced: surfacedThisRun ? 0 : carriedSessions + 1,
      lastSupportAt: prior?.lastSupportAt ?? null,
      blockedTargetIds: [...runtime.blockedTargets].sort(),
      lastResolvedSupportTags: [...runtime.supportTags].sort(),
    };
  }

  private buildDirectTargetCards(
    runtime: GroupRuntimeState,
    courseId: string,
    emittedIds: Set<string>
  ): WeightedCard[] {
    const maxDirect = runtime.group.maxDirectTargetsPerRun ?? DEFAULT_MAX_DIRECT_PER_RUN;

    const directIds = runtime.surfaceableTargets
      .filter((id) => !emittedIds.has(id))
      .slice(0, maxDirect);

    const cards: WeightedCard[] = [];
    for (const cardId of directIds) {
      emittedIds.add(cardId);
      cards.push({
        cardId,
        courseId,
        score: BASE_TARGET_SCORE * runtime.pressureMultiplier,
        provenance: [
          {
            strategy: 'prescribed',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-prescribed',
            action: 'generated' as const,
            score: BASE_TARGET_SCORE * runtime.pressureMultiplier,
            reason:
              `mode=target;group=${runtime.group.id};pending=${runtime.pendingTargets.length};` +
              `surfaceable=${runtime.surfaceableTargets.length};blocked=${runtime.blockedTargets.length};` +
              `blockedTargets=${runtime.blockedTargets.join('|') || 'none'};` +
              `supportTags=${runtime.supportTags.join('|') || 'none'};` +
              `multiplier=${runtime.pressureMultiplier.toFixed(2)};` +
              `testversion=${runtime.debugVersion}`,
          },
        ],
      });
    }

    return cards;
  }

  private buildSupportCards(
    runtime: GroupRuntimeState,
    courseId: string,
    emittedIds: Set<string>
  ): WeightedCard[] {
    if (runtime.blockedTargets.length === 0 || runtime.supportCandidates.length === 0) {
      return [];
    }

    const maxSupport = runtime.group.maxSupportCardsPerRun ?? DEFAULT_MAX_SUPPORT_PER_RUN;
    const supportIds = runtime.supportCandidates
      .filter((id) => !emittedIds.has(id))
      .slice(0, maxSupport);

    const cards: WeightedCard[] = [];
    for (const cardId of supportIds) {
      emittedIds.add(cardId);
      cards.push({
        cardId,
        courseId,
        score: BASE_SUPPORT_SCORE * runtime.supportMultiplier,
        provenance: [
          {
            strategy: 'prescribed',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-prescribed',
            action: 'generated' as const,
            score: BASE_SUPPORT_SCORE * runtime.supportMultiplier,
            reason:
              `mode=support;group=${runtime.group.id};pending=${runtime.pendingTargets.length};` +
              `blocked=${runtime.blockedTargets.length};` +
              `blockedTargets=${runtime.blockedTargets.join('|') || 'none'};` +
              `supportCard=${cardId};` +
              `supportTags=${runtime.supportTags.join('|') || 'none'};` +
              `multiplier=${runtime.supportMultiplier.toFixed(2)};` +
              `testversion=${runtime.debugVersion}`,
          },
        ],
      });
    }

    return cards;
  }

  private buildDiscoveredSupportCards(
    runtime: GroupRuntimeState,
    courseId: string,
    emittedIds: Set<string>
  ): WeightedCard[] {
    if (runtime.blockedTargets.length === 0 || runtime.discoveredSupportCandidates.length === 0) {
      return [];
    }

    const maxSupport = runtime.group.maxSupportCardsPerRun ?? DEFAULT_MAX_SUPPORT_PER_RUN;
    const supportIds = runtime.discoveredSupportCandidates
      .filter((id) => !emittedIds.has(id))
      .slice(0, maxSupport);

    const cards: WeightedCard[] = [];
    for (const cardId of supportIds) {
      emittedIds.add(cardId);
      cards.push({
        cardId,
        courseId,
        score: DISCOVERED_SUPPORT_SCORE * runtime.supportMultiplier,
        provenance: [
          {
            strategy: 'prescribed',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-prescribed',
            action: 'generated' as const,
            score: DISCOVERED_SUPPORT_SCORE * runtime.supportMultiplier,
            reason:
              `mode=discovered-support;group=${runtime.group.id};pending=${runtime.pendingTargets.length};` +
              `blocked=${runtime.blockedTargets.length};` +
              `blockedTargets=${runtime.blockedTargets.join('|') || 'none'};` +
              `supportCard=${cardId};` +
              `supportTags=${runtime.supportTags.join('|') || 'none'};` +
              `multiplier=${runtime.supportMultiplier.toFixed(2)};` +
              `testversion=${runtime.debugVersion}`,
          },
        ],
      });
    }

    return cards;
  }

  /**
   * Emit drill cards for *unlocked-but-under-practiced* skills.
   *
   * For each course tag matching the group's `practiceTagPatterns` that is both
   * unlocked (all hierarchy prerequisites met — i.e. the learner has been
   * introduced to it) and under-practiced (per-tag attempt count below
   * `practiceMinCount`), this resolves cards carrying that tag and emits them
   * into the candidate pool. It exists because global-ELO retrieval
   * systematically fails to fetch the (low-ELO) drill cards for a
   * freshly-introduced skill — putting them in the pool here guarantees presence.
   *
   * Emphasis is a **practice-debt pressure** (parallel to SRS backlog pressure):
   * cards score `base × multiplier`, where the multiplier starts at
   * PRACTICE_BASE_MULT (so a few reps land promptly post-intro, competing with
   * pressured reviews) and escalates by how long the debt has stayed open
   * (per-tag, time-based via `priorPracticeDebt`/`nextPracticeDebt`), clamped at
   * MAX_PRACTICE_MULTIPLIER. The debt is durable and self-discharges the instant
   * the skill reaches `practiceMinCount` — so this no longer relies on the
   * session-scoped intro boost to actually surface.
   *
   * Fully data-driven: the unlock relation comes from the hierarchy config and
   * practice-status from per-tag ELO. No card-id or tag-namespace hard-coding.
   */
  private buildPracticeCards(args: {
    group: PrescribedGroupConfig;
    courseId: string;
    emittedIds: Set<string>;
    cardsByTag: Map<string, string[]>;
    hierarchyConfigs: HierarchyConfig[];
    userTagElo: Record<string, { score: number; count: number }>;
    userGlobalElo: number;
    activeIds: Set<string>;
    seenIds: Set<string>;
    priorPracticeDebt: Record<string, string>;
    nextPracticeDebt: Record<string, string>;
  }): { cards: WeightedCard[]; debts: PracticeDebtDebug[] } {
    const {
      group,
      courseId,
      emittedIds,
      cardsByTag,
      hierarchyConfigs,
      userTagElo,
      userGlobalElo,
      activeIds,
      seenIds,
      priorPracticeDebt,
      nextPracticeDebt,
    } = args;

    const patterns = group.practiceTagPatterns ?? [];
    if (patterns.length === 0) return { cards: [], debts: [] };

    const practiceMinCount = group.practiceMinCount ?? DEFAULT_PRACTICE_MIN_COUNT;
    const maxPractice = group.maxPracticeCardsPerRun ?? DEFAULT_MAX_PRACTICE_PER_RUN;

    const practiceTags = [...cardsByTag.keys()].filter(
      (tag) =>
        patterns.some((p) => matchesTagPattern(tag, p)) &&
        this.isUnlockedGatedSkill(tag, hierarchyConfigs, userTagElo, userGlobalElo) &&
        (userTagElo[tag]?.count ?? 0) < practiceMinCount
    );

    if (practiceTags.length === 0) return { cards: [], debts: [] };

    // Carry forward (or open) each under-practiced skill's debt age, and derive
    // its practice multiplier: base + staleness-since-first-owed, clamped. Done
    // for every under-practiced tag (not just emitted ones) so the debt clock
    // keeps running even on runs where the cap or de-dup emits nothing.
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const tagMultiplier = new Map<string, number>();
    for (const tag of practiceTags) {
      const firstOwedAt = priorPracticeDebt[tag] ?? isoNow();
      nextPracticeDebt[tag] = firstOwedAt;
      const staleDays = Math.max(0, (now - new Date(firstOwedAt).getTime()) / DAY_MS);
      const mult = clamp(
        PRACTICE_BASE_MULT + staleDays * PRACTICE_STALENESS_BUMP_PER_DAY,
        PRACTICE_BASE_MULT,
        MAX_PRACTICE_MULTIPLIER
      );
      tagMultiplier.set(tag, mult);
    }

    // Debug view of every open debt (built before the emission early-return so
    // the pressure channel sees debts even on runs that emit no drill cards).
    const debts: PracticeDebtDebug[] = practiceTags
      .map((tag) => ({
        tag,
        multiplier: tagMultiplier.get(tag) ?? PRACTICE_BASE_MULT,
        firstOwedAt: nextPracticeDebt[tag],
      }))
      .sort((a, b) => b.multiplier - a.multiplier || a.tag.localeCompare(b.tag));

    // Reuse the diversity-aware tag→cards collector (stem-dedup + shuffle).
    const practiceCardIds = this.findDiscoveredSupportCards({
      supportTags: practiceTags,
      cardsByTag,
      activeIds,
      seenIds,
      excludedIds: emittedIds,
      limit: maxPractice,
    });

    if (practiceCardIds.length === 0) return { cards: [], debts };

    logger.info(
      `[Prescribed] Group '${group.id}' practice: ${practiceTags.length} unlocked under-practiced ` +
        `skill(s), emitting ${practiceCardIds.length} drill card(s)`
    );

    const cards: WeightedCard[] = [];
    for (const cardId of practiceCardIds) {
      emittedIds.add(cardId);
      // Most-stale wins: a card may carry several practice tags; take the
      // highest debt multiplier among the ones it serves.
      let mult = PRACTICE_BASE_MULT;
      for (const tag of practiceTags) {
        if ((cardsByTag.get(tag)?.includes(cardId) ?? false)) {
          mult = Math.max(mult, tagMultiplier.get(tag) ?? PRACTICE_BASE_MULT);
        }
      }
      const score = BASE_PRACTICE_SCORE * mult;
      cards.push({
        cardId,
        courseId,
        score,
        provenance: [
          {
            strategy: 'prescribed',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-prescribed',
            action: 'generated' as const,
            score,
            reason:
              `mode=practice;group=${group.id};debtMult=×${mult.toFixed(2)};` +
              `underPracticedSkills=${practiceTags.length};` +
              `practiceTags=${practiceTags.slice(0, 8).join('|')}${practiceTags.length > 8 ? '|…' : ''};` +
              `testversion=${PRESCRIBED_DEBUG_VERSION}`,
          },
        ],
      });
    }

    return { cards, debts };
  }

  /**
   * True for a skill that was *gated and is now reached*: it has at least one
   * declared hierarchy prerequisite set, and every set is fully satisfied by the
   * learner's per-tag ELO. This deliberately EXCLUDES tags with no prerequisites
   * — an ungated tag was never "introduced" in the curricular sense, so it isn't
   * a post-intro drill target (e.g. whole-word spelling tags that share the
   * `gpc:exercise:*` prefix but have no intro gate). Those are left to normal
   * ELO retrieval. This is the precise population the retrieval gap strands:
   * just-unlocked, low-ELO skills.
   */
  private isUnlockedGatedSkill(
    tag: string,
    hierarchyConfigs: HierarchyConfig[],
    userTagElo: Record<string, { score: number; count: number }>,
    userGlobalElo: number
  ): boolean {
    const prereqSets = hierarchyConfigs
      .map((hierarchy) => hierarchy.prerequisites[tag])
      .filter((prereqs): prereqs is TagPrerequisite[] => Array.isArray(prereqs) && prereqs.length > 0);

    if (prereqSets.length === 0) return false;

    return prereqSets.every((prereqs) =>
      prereqs.every((pr) => this.isPrerequisiteMet(pr, userTagElo[pr.tag], userGlobalElo))
    );
  }

  private findSupportCardsByTags(
    group: PrescribedGroupConfig,
    tagsByCard: Map<string, string[]>,
    supportTags: string[]
  ): string[] {
    if (supportTags.length === 0) {
      return [];
    }

    const explicitSupportIds = group.supportCardIds ?? [];
    const explicitPatterns = group.supportTagPatterns ?? [];
    if (explicitSupportIds.length === 0 && explicitPatterns.length === 0) {
      return [];
    }

    const candidates = new Set<string>();

    for (const cardId of explicitSupportIds) {
      const cardTags = tagsByCard.get(cardId) ?? [];
      const matchesResolved = supportTags.some((supportTag) => cardTags.includes(supportTag));
      const matchesPattern = explicitPatterns.some((pattern) =>
        cardTags.some((tag) => matchesTagPattern(tag, pattern))
      );

      if (matchesResolved || matchesPattern) {
        candidates.add(cardId);
      }
    }

    return [...candidates];
  }

  private findDiscoveredSupportCards(args: {
    supportTags: string[];
    cardsByTag: Map<string, string[]>;
    activeIds: Set<string>;
    seenIds: Set<string>;
    excludedIds: Set<string>;
    limit: number;
  }): string[] {
    const { supportTags, cardsByTag, activeIds, seenIds, excludedIds, limit } = args;

    const byCardId = new Map<string, { cardId: string; matches: number }>();

    for (const supportTag of supportTags) {
      const taggedCards = cardsByTag.get(supportTag) ?? [];
      for (const cardId of taggedCards) {
        if (activeIds.has(cardId) || seenIds.has(cardId) || excludedIds.has(cardId)) {
          continue;
        }
        const existing = byCardId.get(cardId);
        if (existing) {
          existing.matches += 1;
        } else {
          byCardId.set(cardId, { cardId, matches: 1 });
        }
      }
    }

    const candidates = [...byCardId.values()]
      .sort((a, b) => b.matches - a.matches || a.cardId.localeCompare(b.cardId));

    // Diversify by word stem — avoid returning 4 variants of "year".
    // ML cards follow c-ml-{word}-{blanks}, so the stem is everything before
    // the last dash-delimited segment of digits/commas.
    const usedStems = new Set<string>();
    const diverse: typeof candidates = [];
    const deferred: typeof candidates = [];

    for (const entry of candidates) {
      const stem = extractWordStem(entry.cardId);
      if (!usedStems.has(stem)) {
        usedStems.add(stem);
        diverse.push(entry);
      } else {
        deferred.push(entry);
      }
    }

    // Combine diverse-first, then deferred for overflow, and shuffle within
    // each tier so we don't always pick the same card for a given word.
    shuffleInPlace(diverse);
    shuffleInPlace(deferred);

    return [...diverse, ...deferred]
      .slice(0, limit)
      .map((entry) => entry.cardId);
  }

  private resolveBlockedSupportTags(
    targetTags: string[],
    hierarchyConfigs: HierarchyConfig[],
    userTagElo: Record<string, { score: number; count: number }>,
    userGlobalElo: number,
    hierarchyWalkEnabled: boolean,
    maxDepth: number
  ): { blocked: boolean; supportTags: string[] } {
    const supportTags = new Set<string>();
    let blocked = false;

    for (const targetTag of targetTags) {
      const prereqSets = hierarchyConfigs
        .map((hierarchy) => hierarchy.prerequisites[targetTag])
        .filter((prereqs): prereqs is TagPrerequisite[] => Array.isArray(prereqs) && prereqs.length > 0);

      if (prereqSets.length === 0) {
        continue;
      }

      const tagBlocked = prereqSets.some((prereqs) =>
        prereqs.some((pr) => !this.isPrerequisiteMet(pr, userTagElo[pr.tag], userGlobalElo))
      );

      if (!tagBlocked) {
        continue;
      }

      blocked = true;

      if (!hierarchyWalkEnabled) {
        for (const prereqs of prereqSets) {
          for (const prereq of prereqs) {
            if (!this.isPrerequisiteMet(prereq, userTagElo[prereq.tag], userGlobalElo)) {
              supportTags.add(prereq.tag);
            }
          }
        }
        continue;
      }

      for (const prereqs of prereqSets) {
        for (const prereq of prereqs) {
          if (!this.isPrerequisiteMet(prereq, userTagElo[prereq.tag], userGlobalElo)) {
            this.collectSupportTagsRecursive(
              prereq.tag,
              hierarchyConfigs,
              userTagElo,
              userGlobalElo,
              maxDepth,
              new Set<string>(),
              supportTags
            );
          }
        }
      }
    }

    return { blocked, supportTags: [...supportTags] };
  }

  private collectSupportTagsRecursive(
    tag: string,
    hierarchyConfigs: HierarchyConfig[],
    userTagElo: Record<string, { score: number; count: number }>,
    userGlobalElo: number,
    depth: number,
    visited: Set<string>,
    out: Set<string>
  ): void {
    if (depth < 0 || visited.has(tag)) return;

    visited.add(tag);

    let walkedFurther = false;

    for (const hierarchy of hierarchyConfigs) {
      const prereqs = hierarchy.prerequisites[tag];
      if (!prereqs || prereqs.length === 0) continue;

      const unmet = prereqs.filter(
        (pr) => !this.isPrerequisiteMet(pr, userTagElo[pr.tag], userGlobalElo)
      );

      if (unmet.length > 0 && depth > 0) {
        walkedFurther = true;
        for (const prereq of unmet) {
          this.collectSupportTagsRecursive(
            prereq.tag,
            hierarchyConfigs,
            userTagElo,
            userGlobalElo,
            depth - 1,
            visited,
            out
          );
        }
      }
    }

    if (!walkedFurther) {
      out.add(tag);
    }
  }



  private isPrerequisiteMet(
    prereq: TagPrerequisite,
    userTagElo: { score: number; count: number } | undefined,
    userGlobalElo: number
  ): boolean {
    if (!userTagElo) return false;

    const minCount = prereq.masteryThreshold?.minCount ?? DEFAULT_MIN_COUNT;
    if (userTagElo.count < minCount) return false;

    if (prereq.masteryThreshold?.minElo !== undefined) {
      return userTagElo.score >= prereq.masteryThreshold.minElo;
    }
    if (prereq.masteryThreshold?.minCount !== undefined) {
      return true;
    }

    return userTagElo.score >= userGlobalElo;
  }
}