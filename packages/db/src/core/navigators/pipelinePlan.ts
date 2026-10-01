import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { isFilter, isGenerator, NavigatorRole } from './index';
import { createDefaultEloStrategy, createDefaultSrsStrategy } from './defaults';

// ============================================================================
// PIPELINE PLAN
// ============================================================================
//
// What a course's strategy documents assemble into, as data: which generators
// and filters run, in what order, and which ones the assembler added itself.
// Pure: no user, no instantiation. PipelineAssembler builds from this plan and
// the admin pipeline view renders it, so the view can't drift from what runs.
//
// Roles come from the navigator registry, so a plan reflects the app it's
// computed in. A course's consumer-registered filters plan as `skipped` in an
// app that never registered them, which is also how they'd assemble there.
//
// Not exported from './index' (the navigators barrel): './defaults' imports the
// generator classes, which extend ContentNavigator from that barrel.
//
// ============================================================================

export type PlannedNavigatorOrigin =
  /** From the course's strategy documents. */
  | 'strategy-doc'
  /** Added by the assembler because the course declared none of its kind. */
  | 'assembler-default'
  /** Part of the fallback pipeline for a course with no strategy documents. */
  | 'default-pipeline';

export interface PlannedNavigator {
  role: NavigatorRole;
  origin: PlannedNavigatorOrigin;
  /** The name runs report this navigator under (generator summaries, filter impacts). */
  name: string;
  implementingClass: string;
  /** Absent only for the default pipeline's ELO-distance filter, which has no document. */
  strategy?: ContentNavigationStrategyData;
}

export interface SkippedStrategy {
  strategy: ContentNavigationStrategyData;
  reason: string;
}

export interface PipelinePlan {
  /** Assembled from strategy documents, or the fallback for a course with none. */
  kind: 'assembled' | 'default';
  generators: PlannedNavigator[];
  /** In run order. */
  filters: PlannedNavigator[];
  skipped: SkippedStrategy[];
  warnings: string[];
  /** Consequences of the plan worth knowing that aren't errors. */
  notes: string[];
}

export type PipelineStageKey =
  | 'generate'
  | 'filter'
  | 'drop-zero'
  | 'hints'
  | 'diversity'
  | 'select';

/** One step of a pipeline run, in order. Shared by views and text exports. */
export interface PipelineStageInfo {
  key: PipelineStageKey;
  title: string;
  summary: string;
}

/**
 * The steps every pipeline run takes, in order (`Pipeline.getWeightedCards`).
 * `generate` and `filter` are where a plan's navigators run; the rest are
 * fixed framework behaviour.
 */
export const PIPELINE_STAGES: readonly PipelineStageInfo[] = [
  {
    key: 'generate',
    title: 'Generate',
    summary:
      'Each generator proposes scored candidates (up to 500 in all). A card proposed by several ' +
      'generators keeps their mean score, raised 10% per extra generator.',
  },
  {
    key: 'filter',
    title: 'Filter',
    summary:
      'Each filter multiplies candidate scores, in the order shown. Gates usually penalize rather ' +
      'than remove, so a gated card stays in the pool at a low score.',
  },
  {
    key: 'drop-zero',
    title: 'Drop zero scores',
    summary: 'Candidates whose score reached 0 leave the pool.',
  },
  {
    key: 'hints',
    title: 'Apply hints',
    summary:
      "The session's hints (from the app: an intro's follow-up, a difficulty boost) exclude, " +
      'boost, or require cards. Required cards skip the filters entirely.',
  },
  {
    key: 'diversity',
    title: 'Diversity re-rank',
    summary:
      'Demotes candidates that repeat a distinctive tag already ranked above them, so one ' +
      'concept or answer cannot take the whole head of the queue. Sees this run only, not what ' +
      'the session already served.',
  },
  {
    key: 'select',
    title: 'Select',
    summary:
      "Highest scores first, up to the run's limit. The session mixes them into its supply queue.",
  },
];

/** Runtime name and class of the default pipeline's ELO-distance filter (see `createEloDistanceFilter`). */
export const ELO_DISTANCE_FILTER_NAME = 'ELO Distance Filter';
export const ELO_DISTANCE_IMPLEMENTING_CLASS = 'eloDistance';

function planned(
  strategy: ContentNavigationStrategyData,
  role: NavigatorRole,
  origin: PlannedNavigatorOrigin
): PlannedNavigator {
  return {
    role,
    origin,
    name: strategy.name,
    implementingClass: strategy.implementingClass,
    strategy,
  };
}

/**
 * Plan the pipeline a course's strategy documents assemble into.
 *
 * Mirrors the assembly rules: generators keep document order, with ELO and SRS
 * added when absent; filters run sorted by name; unknown implementing classes
 * are skipped with a warning. With no documents at all, describes the default
 * pipeline that `createDefaultPipeline` builds instead.
 */
export function planPipeline(
  strategies: ContentNavigationStrategyData[],
  courseId: string
): PipelinePlan {
  if (strategies.length === 0) {
    return {
      kind: 'default',
      generators: [
        planned(createDefaultEloStrategy(courseId), NavigatorRole.GENERATOR, 'default-pipeline'),
        planned(createDefaultSrsStrategy(courseId), NavigatorRole.GENERATOR, 'default-pipeline'),
      ],
      filters: [
        {
          role: NavigatorRole.FILTER,
          origin: 'default-pipeline',
          name: ELO_DISTANCE_FILTER_NAME,
          implementingClass: ELO_DISTANCE_IMPLEMENTING_CLASS,
        },
      ],
      skipped: [],
      warnings: [],
      notes: [],
    };
  }

  const generators: PlannedNavigator[] = [];
  const filters: PlannedNavigator[] = [];
  const skipped: SkippedStrategy[] = [];
  const warnings: string[] = [];

  for (const s of strategies) {
    if (isGenerator(s.implementingClass)) {
      generators.push(planned(s, NavigatorRole.GENERATOR, 'strategy-doc'));
    } else if (isFilter(s.implementingClass)) {
      filters.push(planned(s, NavigatorRole.FILTER, 'strategy-doc'));
    } else {
      skipped.push({ strategy: s, reason: 'not a registered generator or filter' });
      warnings.push(`Unknown strategy type '${s.implementingClass}', skipping: ${s.name}`);
    }
  }

  // ELO and SRS are always present; custom generators supplement, never replace them.
  const declared = new Set(generators.map((g) => g.implementingClass));
  if (!declared.has(createDefaultEloStrategy(courseId).implementingClass)) {
    generators.push(
      planned(createDefaultEloStrategy(courseId), NavigatorRole.GENERATOR, 'assembler-default')
    );
  }
  if (!declared.has(createDefaultSrsStrategy(courseId).implementingClass)) {
    generators.push(
      planned(createDefaultSrsStrategy(courseId), NavigatorRole.GENERATOR, 'assembler-default')
    );
  }

  // Sorted by name for deterministic ordering.
  filters.sort((a, b) => a.name.localeCompare(b.name));

  const notes: string[] = [];
  if (!filters.some((f) => f.implementingClass === ELO_DISTANCE_IMPLEMENTING_CLASS)) {
    notes.push(
      'No ELO-distance filter: review cards get no ELO-proximity signal. New cards get one from ' +
        'the ELO generator.'
    );
  }

  return { kind: 'assembled', generators, filters, skipped, warnings, notes };
}
