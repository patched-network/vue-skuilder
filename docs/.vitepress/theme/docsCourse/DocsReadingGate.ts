// A consumer-defined navigation filter: the docs site's own extension of the pipeline.
//
// The docs course tags each question `docs:exercise:<section>` and each section's introduction
// card `docs:intro:<section>`. Its strategy document maps sections to docs pages. This filter
// holds a section's questions back until the learner has read one of its pages (reported by the
// docs site into strategy state) or has met its intro card in a session. Once a section opens,
// its questions get a boost until the learner has answered one of them, so freshly read
// material comes up first. Intro cards for sections already read are mostly skipped.
//
// See docs/extend/navigation-strategies.md ("Sharing State with Consumer Application Code").

import {
  ContentNavigator,
  type CardFilter,
  type ContentNavigationStrategyData,
  type CourseDBInterface,
  type FilterContext,
  type FilterKind,
  type GeneratorResult,
  type UserDBInterface,
  type WeightedCard,
} from '@vue-skuilder/db';

/** Strategy-state key shared by this filter and the docs site's reading tracker. */
export const DOCS_READING_KEY = 'DocsReading';

/** What the docs site records: docs pages (e.g. `learn/pedagogy`) the reader has read. */
export interface DocsReadingState {
  pages: Record<string, { readAt: string }>;
  updatedAt: string;
}

interface SectionConfig {
  title?: string;
  pages: string[];
  /** Always open (orientation material). */
  open?: boolean;
}

interface DocsReadingGateConfig {
  sections: Record<string, SectionConfig>;
  /** Multiplier for questions in an open section the learner hasn't practiced yet. */
  freshBoost: number;
  /** Multiplier for an intro card whose section the learner has already read. */
  readIntroFactor: number;
}

interface SectionStatus {
  title: string;
  open: boolean;
  read: boolean;
  introduced: boolean;
  practiced: boolean;
  page?: string;
}

const EXERCISE = /^docs:exercise:(.+)$/;
const INTRO = /^docs:intro:(.+)$/;

function parseConfig(serialized: string | undefined): DocsReadingGateConfig {
  const defaults: DocsReadingGateConfig = { sections: {}, freshBoost: 2, readIntroFactor: 0.1 };
  if (!serialized) return defaults;
  try {
    return { ...defaults, ...JSON.parse(serialized) };
  } catch {
    return defaults;
  }
}

export class DocsReadingGate extends ContentNavigator implements CardFilter {
  static readonly kind: FilterKind = 'gate';
  readonly kind = DocsReadingGate.kind;
  name: string;
  private config: DocsReadingGateConfig;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.name = strategyData.name || 'Docs reading gate';
    this.config = parseConfig(strategyData.serializedData);
  }

  /** Same document the docs site writes (see reading.ts). */
  protected get strategyKey(): string {
    return DOCS_READING_KEY;
  }

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    const status = await sectionStatuses(
      this.config,
      context.user,
      this.course,
      await this.getStrategyState<DocsReadingState>()
    );

    return cards.map((card) => {
      const { multiplier, action, reason } = this.judge(card.tags ?? [], status);
      const score = card.score * multiplier;
      return {
        ...card,
        score,
        provenance: [
          ...card.provenance,
          {
            strategy: 'docsReadingGate',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-docs-reading-gate',
            action,
            score,
            reason,
          },
        ],
      };
    });
  }

  private judge(
    tags: string[],
    status: Map<string, SectionStatus>
  ): { multiplier: number; action: 'passed' | 'boosted' | 'penalized'; reason: string } {
    const exerciseSections = tags.map((t) => EXERCISE.exec(t)?.[1]).filter(Boolean) as string[];

    if (exerciseSections.length === 0) {
      const introSection = tags.map((t) => INTRO.exec(t)?.[1]).find(Boolean);
      const s = introSection ? status.get(introSection) : undefined;
      if (s?.read) {
        return {
          multiplier: this.config.readIntroFactor,
          action: 'penalized',
          reason: `intro for '${s.title}', already read on ${s.page}`,
        };
      }
      return { multiplier: 1, action: 'passed', reason: 'not a gated question' };
    }

    const closed = exerciseSections.map((id) => status.get(id)).filter((s) => s && !s.open);
    if (closed.length) {
      const s = closed[0]!;
      return {
        multiplier: 0,
        action: 'penalized',
        reason: `held back: '${s.title}' not read yet, and its intro not seen`,
      };
    }

    const fresh = exerciseSections.map((id) => status.get(id)).find((s) => s && !s.practiced);
    if (fresh) {
      return {
        multiplier: this.config.freshBoost,
        action: 'boosted',
        reason: `fresh: '${fresh.title}' opened (${openedBy(fresh)}), not yet practiced → ×${this.config.freshBoost}`,
      };
    }

    const s = status.get(exerciseSections[0]);
    return {
      multiplier: 1,
      action: 'passed',
      reason: s ? `open: '${s.title}' (${openedBy(s)})` : 'section not configured; open',
    };
  }

  async getWeightedCards(): Promise<GeneratorResult> {
    throw new Error('DocsReadingGate is a filter; use transform() via Pipeline');
  }
}

function openedBy(s: SectionStatus): string {
  if (s.read) return `read ${s.page}`;
  if (s.introduced) return 'intro seen';
  return 'always open';
}

/**
 * Per-section status from the reading state and the learner's history. Exported for the docs
 * site's progress panel, so the panel and the filter agree.
 */
export async function sectionStatuses(
  config: { sections: Record<string, SectionConfig> },
  user: UserDBInterface,
  course: CourseDBInterface,
  reading: DocsReadingState | null
): Promise<Map<string, SectionStatus>> {
  const readPages = reading?.pages ?? {};
  const seen = new Set(await user.getSeenCards(course.getCourseID()));
  const taggedCards = async (tag: string): Promise<string[]> => {
    try {
      return (await course.getTag(tag)).taggedCards;
    } catch {
      return [];
    }
  };

  const out = new Map<string, SectionStatus>();
  for (const [id, cfg] of Object.entries(config.sections)) {
    const page = cfg.pages.find((p) => readPages[p]);
    const [intros, exercises] = await Promise.all([
      taggedCards(`docs:intro:${id}`),
      taggedCards(`docs:exercise:${id}`),
    ]);
    const read = !!page;
    const introduced = intros.some((c) => seen.has(c));
    out.set(id, {
      title: cfg.title ?? id,
      read,
      introduced,
      open: !!cfg.open || read || introduced,
      practiced: exercises.some((c) => seen.has(c)),
      page,
    });
  }
  return out;
}

export { parseConfig as parseDocsReadingGateConfig };
export type { SectionStatus, DocsReadingGateConfig };
