import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext, GeneratorResult, ReplanHints } from './types';
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
  debugVersion: string;
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
const BASE_TARGET_SCORE = 1.0;
const BASE_SUPPORT_SCORE = 0.8;
const DISCOVERED_SUPPORT_SCORE = 12.0;
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

      emitted.push(...directCards, ...supportCards, ...discoveredSupportCards);
    }

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

    return [...byCardId.values()]
      .sort((a, b) => b.matches - a.matches || a.cardId.localeCompare(b.cardId))
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