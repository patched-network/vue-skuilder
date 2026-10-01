<template>
  <div class="sk-pipeline">
    <div class="d-flex flex-wrap align-center ga-2 mb-3">
      <v-chip size="small" variant="tonal" :color="plan.kind === 'default' ? 'warning' : 'primary'">
        {{
          plan.kind === 'default' ? 'default pipeline: the course has no strategy docs' : 'assembled from strategy docs'
        }}
      </v-chip>
      <span class="text-caption">
        {{ plan.generators.length }} generator(s) · {{ plan.filters.length }} filter(s)
      </span>
      <span v-if="stats" class="text-caption text-medium-emphasis">
        · run stats{{ statsLabel ? ` for ${statsLabel}` : '' }}: {{ stats.runs }} runs over
        {{ stats.sessions }} sessions, {{ fmtTime(stats.firstRunAt) }} – {{ fmtTime(stats.lastRunAt) }}
      </span>
    </div>

    <v-alert
      v-for="s in plan.skipped"
      :key="s.strategy._id"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      <strong>{{ s.strategy.name }}</strong> (<code>{{ s.strategy.implementingClass }}</code
      >) is {{ s.reason }} in this app, so it would not run here. A course's own navigators only plan correctly in the
      app that registers them.
    </v-alert>
    <v-alert v-for="w in plan.warnings" :key="w" type="warning" variant="tonal" density="compact" class="mb-2">
      {{ w }}
    </v-alert>
    <v-alert v-for="n in notes" :key="n" type="info" variant="tonal" density="compact" class="mb-2">
      {{ n }}
    </v-alert>

    <div v-for="(stage, i) in PIPELINE_STAGES" :key="stage.key">
      <div class="sk-stage">
        <div class="d-flex align-center mb-1">
          <span class="sk-stage-num">{{ i + 1 }}</span>
          <span class="font-weight-medium">{{ stage.title }}</span>
        </div>
        <div class="text-caption text-medium-emphasis mb-2">{{ stage.summary }}</div>

        <template v-if="stage.key === 'generate'">
          <div v-for="g in plan.generators" :key="g.name" class="sk-nav">
            <div class="d-flex flex-wrap align-center ga-2">
              <span class="font-weight-medium">{{ g.name }}</span>
              <code class="text-caption">{{ g.implementingClass }}</code>
              <v-chip size="x-small" variant="outlined" :color="ORIGIN[g.origin].color">
                {{ ORIGIN[g.origin].label }}
              </v-chip>
            </div>
            <div v-if="g.strategy?.description" class="text-caption mt-1">{{ g.strategy.description }}</div>

            <div v-if="stats" class="text-caption mt-1">
              <template v-if="genStat(g.name)">
                {{ fmtNum(genStat(g.name)!.meanCards) }} candidates/run ({{ fmtNum(genStat(g.name)!.meanNew) }} new,
                {{ fmtNum(genStat(g.name)!.meanReview) }} review) · top score
                {{ genStat(g.name)!.topScoreLast.toFixed(2) }} last, {{ genStat(g.name)!.topScoreMax.toFixed(2) }} max
                <template v-if="stats.runsWithSelection > 0">
                  · <strong>{{ genStat(g.name)!.selected }}</strong> selected
                  <template v-if="genStat(g.name)!.firstAttempts > 0">
                    · first attempts {{ genStat(g.name)!.firstAttemptsCorrect }}/{{ genStat(g.name)!.firstAttempts }}
                    correct
                    <span :class="accuracyClass(accuracyOf(genStat(g.name)!))">
                      ({{ Math.round(100 * accuracyOf(genStat(g.name)!)!) }}%)
                    </span>
                  </template>
                </template>
              </template>
              <span v-else class="text-medium-emphasis">absent from these runs</span>
            </div>

            <div v-if="prettyConfig(g.strategy?.serializedData)" class="mt-1">
              <a class="sk-config-link text-caption" @click="toggleConfig(`g:${g.name}`)">
                {{ openConfigs.has(`g:${g.name}`) ? 'Hide' : 'Show' }} config
              </a>
              <pre v-if="openConfigs.has(`g:${g.name}`)" class="sk-config">{{
                prettyConfig(g.strategy?.serializedData)
              }}</pre>
            </div>
          </div>
        </template>

        <template v-else-if="stage.key === 'filter'">
          <div v-if="plan.filters.length === 0" class="text-caption text-medium-emphasis">No filters.</div>
          <div v-for="f in plan.filters" :key="f.name" class="sk-nav">
            <div class="d-flex flex-wrap align-center ga-2">
              <span class="font-weight-medium">{{ f.name }}</span>
              <code class="text-caption">{{ f.implementingClass }}</code>
              <v-chip size="x-small" variant="outlined" :color="ORIGIN[f.origin].color">
                {{ ORIGIN[f.origin].label }}
              </v-chip>
              <v-chip v-if="f.strategy?.learnable" size="x-small" variant="outlined">learnable weight</v-chip>
            </div>
            <div v-if="f.strategy?.description" class="text-caption mt-1">{{ f.strategy.description }}</div>
            <div v-else-if="!f.strategy" class="text-caption mt-1 text-medium-emphasis">
              Built in code; no strategy document.
            </div>

            <div v-if="stats" class="mt-1">
              <template v-if="filterStat(f.name)">
                <div class="sk-impact-bar">
                  <div
                    v-for="part in impactParts(filterStat(f.name)!)"
                    :key="part.key"
                    :class="`bg-${part.color}`"
                    :style="{ width: `${part.share * 100}%` }"
                    :title="`${part.key}: ${part.count}`"
                  />
                </div>
                <div class="text-caption">
                  over {{ filterStat(f.name)!.runs }} runs:
                  <span v-for="part in impactParts(filterStat(f.name)!)" :key="part.key" class="mr-2">
                    <span :class="`text-${part.color}`">●</span> {{ part.key }} {{ fmtPct(part.share) }}
                  </span>
                </div>
              </template>
              <span v-else class="text-caption text-medium-emphasis">absent from these runs</span>
            </div>

            <div v-if="prettyConfig(f.strategy?.serializedData)" class="mt-1">
              <a class="sk-config-link text-caption" @click="toggleConfig(`f:${f.name}`)">
                {{ openConfigs.has(`f:${f.name}`) ? 'Hide' : 'Show' }} config
              </a>
              <pre v-if="openConfigs.has(`f:${f.name}`)" class="sk-config">{{
                prettyConfig(f.strategy?.serializedData)
              }}</pre>
            </div>
          </div>
        </template>

        <template v-else-if="stage.key === 'select' && stats && stats.runsWithSelection > 0">
          <div class="text-caption">
            {{ stats.selectedUnattributed }} selected card(s) had no generator: forced in by a hint's
            <code>requireCards</code>.
          </div>
        </template>
      </div>
      <div v-if="i < PIPELINE_STAGES.length - 1" class="sk-stage-arrow">
        <v-icon size="small">mdi-arrow-down</v-icon>
      </div>
    </div>

    <div v-if="stats && stats.runsWithSelection === 0" class="text-caption text-medium-emphasis mt-3">
      None of these runs recorded which cards they selected (recorded from 0.2.28), so selection and first-attempt
      counts are not shown.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  PIPELINE_STAGES,
  planPipeline,
  type ContentNavigationStrategyData,
  type PlannedNavigatorOrigin,
} from '@vue-skuilder/db';
import type { FilterRunStat, GeneratorRunStat, PipelineRunStats } from '@vue-skuilder/db/diagnostics';
import { accuracyClass, fmtTime } from '../display';

/**
 * A course's navigation pipeline as it assembles in this app: each stage in
 * run order, which generators and filters run in it, and where each came from.
 * With `stats` (from `pipelineRunStats`), each piece also shows what it did
 * across a learner's persisted runs. Stats join to the plan by name.
 */
const props = defineProps<{
  strategies: ContentNavigationStrategyData[];
  courseId: string;
  stats?: PipelineRunStats;
  /** Whose runs the stats cover, e.g. a username. */
  statsLabel?: string;
}>();

const ORIGIN: Record<PlannedNavigatorOrigin, { label: string; color: string }> = {
  'strategy-doc': { label: 'strategy doc', color: 'primary' },
  'assembler-default': { label: 'added by the assembler', color: 'secondary' },
  'default-pipeline': { label: 'default pipeline', color: 'warning' },
};

const plan = computed(() => planPipeline(props.strategies, props.courseId));

const genStats = computed(() => new Map((props.stats?.generators ?? []).map((g) => [g.name, g])));
const filterStats = computed(() => new Map((props.stats?.filters ?? []).map((f) => [f.name, f])));
const genStat = (name: string): GeneratorRunStat | undefined => genStats.value.get(name);
const filterStat = (name: string): FilterRunStat | undefined => filterStats.value.get(name);

/** The plan's notes, plus what the run stats show about pieces that did nothing. */
const notes = computed(() => {
  const out = [...plan.value.notes];
  const stats = props.stats;
  if (!stats) return out;
  for (const f of plan.value.filters) {
    const s = filterStat(f.name);
    if (s && s.boosted + s.penalized + s.removed === 0) {
      out.push(`${f.name} changed no candidate's score in ${s.runs} runs.`);
    }
  }
  if (stats.runsWithSelection > 0) {
    for (const g of plan.value.generators) {
      const s = genStat(g.name);
      if (s && s.runs > 0 && s.selected === 0) {
        out.push(`${g.name} proposed candidates in ${s.runs} runs, and none was selected.`);
      }
    }
  }
  return out;
});

function accuracyOf(g: GeneratorRunStat): number | null {
  return g.firstAttempts > 0 ? g.firstAttemptsCorrect / g.firstAttempts : null;
}

function impactParts(f: FilterRunStat) {
  const total = f.boosted + f.penalized + f.passed + f.removed || 1;
  return [
    { key: 'boosted', count: f.boosted, color: 'success' },
    { key: 'penalized', count: f.penalized, color: 'warning' },
    { key: 'passed', count: f.passed, color: 'grey' },
    { key: 'removed', count: f.removed, color: 'error' },
  ].map((p) => ({ ...p, share: p.count / total }));
}

function fmtNum(n: number): string {
  return n >= 10 ? Math.round(n).toString() : n.toFixed(1);
}

function fmtPct(share: number): string {
  if (share === 0) return '0%';
  return share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`;
}

const openConfigs = ref(new Set<string>());

function toggleConfig(key: string): void {
  const next = new Set(openConfigs.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openConfigs.value = next;
}

/** A strategy's serializedData, pretty-printed when it's JSON; '' when there's nothing to show. */
function prettyConfig(serialized: string | undefined): string {
  if (!serialized) return '';
  try {
    const parsed: unknown = JSON.parse(serialized);
    const text = JSON.stringify(parsed, null, 2);
    return text === '{}' ? '' : text;
  } catch {
    return serialized;
  }
}
</script>

<style scoped>
.sk-stage {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
  padding: 10px 12px;
}
.sk-stage-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 8px;
  font-size: 0.72rem;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}
.sk-stage-arrow {
  display: flex;
  justify-content: center;
  padding: 2px 0;
  opacity: 0.5;
}
.sk-nav {
  border-left: 2px solid rgba(var(--v-theme-primary), 0.25);
  padding: 4px 0 4px 10px;
  margin: 6px 0 6px 2px;
}
.sk-impact-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.06);
  max-width: 420px;
  margin: 4px 0 2px;
}
.sk-config-link {
  cursor: pointer;
  border-bottom: 1px dotted rgba(var(--v-theme-on-surface), 0.3);
}
.sk-config {
  font-size: 0.72rem;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 4px 0 0;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
