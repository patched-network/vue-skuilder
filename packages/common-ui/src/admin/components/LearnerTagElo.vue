<template>
  <div>
    <v-alert v-if="!view" type="info" variant="tonal">
      This learner's registration carries no ELO for this course.
    </v-alert>

    <template v-else>
      <p class="text-caption text-medium-emphasis mb-4">
        The learner's ELO on each tag (from their course registration) beside their global ELO. A tag's rating starts at
        the learner's global ELO when first graded and moves only on responses that grade it: read it with its response
        count. Bookkeeping tags (<code>intro</code>, <code>expose</code>) are counted, never rated, and are hidden by
        default.
      </p>

      <v-row dense class="mb-2">
        <v-col v-for="tile in tiles" :key="tile.label" cols="6" sm="3">
          <v-card variant="tonal" color="primary" class="pa-2 text-center">
            <div class="text-h6">{{ tile.value }}</div>
            <div class="text-caption">{{ tile.label }}</div>
          </v-card>
        </v-col>
      </v-row>

      <div class="d-flex align-center flex-wrap mb-1 ga-3">
        <v-chip-group v-model="selectedBatches" multiple column selected-class="text-primary">
          <v-chip
            v-for="b in batchOptions"
            :key="b.key"
            :value="b.key"
            size="small"
            filter
            :variant="b.course ? 'outlined' : 'tonal'"
            :title="b.course ? 'course batch' : 'namespace × role'"
          >
            {{ b.batch.label }} ({{ b.matches }})
          </v-chip>
        </v-chip-group>
      </div>
      <div class="d-flex align-center flex-wrap mb-4 ga-3">
        <v-btn-toggle v-model="sortBy" mandatory density="compact" color="primary" variant="outlined">
          <v-btn value="score" size="small">ELO</v-btn>
          <v-btn value="count" size="small">Responses</v-btn>
          <v-btn value="lastSeen" size="small">Last seen</v-btn>
          <v-btn value="tag" size="small">Name</v-btn>
        </v-btn-toggle>
        <v-text-field
          v-model.number="minCount"
          type="number"
          min="0"
          density="compact"
          variant="outlined"
          hide-details
          label="min responses"
          style="max-width: 140px"
        />
        <v-text-field
          v-model="search"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          placeholder="filter by tag"
          prepend-inner-icon="mdi-magnify"
          style="max-width: 280px"
        />
        <v-spacer />
        <span class="text-caption text-medium-emphasis">
          {{ picked.size }}/{{ MAX_PICKED }} plotted
          <v-btn v-if="picked.size" variant="text" size="x-small" @click="picked = new Map()">clear</v-btn>
        </span>
      </div>

      <v-alert v-if="visible.length === 0" type="info" variant="tonal">No tags match these filters.</v-alert>

      <v-row v-else>
        <v-col cols="12" md="5">
          <div class="text-subtitle-2">ELO by tag</div>
          <div class="text-caption text-medium-emphasis mb-1">
            Dot size: responses (log scale). Click a dot or a name to plot its trajectory.
          </div>
          <e-chart v-if="plotted.length" :option="dotOption" :height="dotHeight" @click="onDotClick" />
          <div v-else class="text-caption text-disabled pa-4">No rated tags in this selection.</div>
        </v-col>
        <v-col cols="12" md="7">
          <div class="sk-tag-elo-sticky">
            <div class="text-subtitle-2">Trajectories</div>
            <div class="text-caption text-medium-emphasis mb-1">
              <template v-if="view.seriesFrom">
                From {{ fmtTime(view.seriesFrom) }}, when sessions began recording ELO events. Faint lines are the other
                tags in view; click one to plot it. A jump between recorded events is a session that didn't save its
                events.
              </template>
              <template v-else>No session in this dataset recorded ELO events.</template>
            </div>
            <e-chart v-if="view.seriesFrom" :option="lineOption" :height="380" @click="onLineClick" />
          </div>
        </v-col>
      </v-row>

      <v-table v-if="visible.length" density="compact" class="mt-4 sk-tag-elo-table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Batch</th>
            <th class="text-right">ELO</th>
            <th class="text-right">vs global</th>
            <th class="text-right">Responses</th>
            <th>Recent first attempts</th>
            <th>First seen</th>
            <th>Last seen</th>
            <th class="text-right">ELO events</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in visible"
            :key="r.tag"
            :class="{ 'sk-pickable': r.score !== null }"
            @click="r.score !== null && toggle(r.tag)"
          >
            <td>
              <span
                class="sk-swatch"
                :style="{ background: picked.has(r.tag) ? slotColor(picked.get(r.tag)!) : 'transparent' }"
              />
              <code class="text-caption">{{ r.tag }}</code>
            </td>
            <td class="text-caption text-medium-emphasis">{{ r.group }}</td>
            <td class="text-right">
              <template v-if="r.score !== null">{{ r.score }}</template>
              <span v-else class="text-disabled" :title="staleTitle(r)">
                —<template v-if="r.staleScore !== undefined"> ({{ r.staleScore }})</template>
              </span>
            </td>
            <td class="text-right" :class="deltaClass(r.vsGlobal)">{{ signed(r.vsGlobal) }}</td>
            <td class="text-right">{{ r.count }}</td>
            <td>
              <span v-if="r.recent.length" class="sk-ticks">
                <span
                  v-for="(p, i) in r.recent"
                  :key="i"
                  class="sk-tick"
                  :class="p.ok ? 'bg-success' : 'bg-error'"
                  :title="`${fmtTime(p.at)} · ${p.ok ? 'correct' : 'missed'} · ${p.card}`"
                />
                <span class="text-caption ml-1">{{ r.recentOk }}/{{ r.recent.length }}</span>
              </span>
              <span v-else class="text-caption text-disabled">—</span>
            </td>
            <td class="text-caption">{{ fmtDate(r.firstSeen) }}</td>
            <td class="text-caption">{{ fmtDate(r.lastSeen) }}</td>
            <td class="text-right">{{ r.events || '' }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import type { ECElementEvent, EChartsCoreOption } from 'echarts/core';
import {
  matchesTagBatch,
  shortTag,
  tagEloView,
  type DiagnosticsInterpreters,
  type EloPoint,
  type LearnerDataset,
  type TagBatch,
  type TagEloRow,
} from '@vue-skuilder/db/diagnostics';
import { deltaClass, fmtTime } from '../display';
import EChart from './EChart.vue';

/**
 * A learner's per-tag ELO: which skills they're rated high or low on, how
 * much evidence each rating rests on, and how ratings moved. Filtered by tag
 * batch: the namespace × role groups found on the tags, plus any the course
 * names (`interpreters.tagBatches`).
 */
const props = defineProps<{
  dataset: LearnerDataset;
  interpreters?: DiagnosticsInterpreters;
}>();

const view = computed(() => tagEloView(props.dataset));

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const batchOptions = computed(() => {
  const rows = view.value?.rows ?? [];
  const options = [
    ...(view.value?.groups ?? []).map((batch) => ({ key: `group:${batch.id}`, batch, course: false })),
    ...(props.interpreters?.tagBatches ?? []).map((batch) => ({ key: `course:${batch.id}`, batch, course: true })),
  ];
  return options.map((o) => ({ ...o, matches: rows.filter((r) => matchesTagBatch(r.tag, o.batch, r.role)).length }));
});

const isBookkeeping = (b: TagBatch): boolean => b.roles?.some((r) => r === 'intro' || r === 'expose') ?? false;

const selectedBatches = ref<string[]>([]);
const sortBy = ref<'score' | 'count' | 'lastSeen' | 'tag'>('score');
const minCount = ref<number>(0);
const search = ref<string | null>('');

const byScore = (a: TagEloRow, b: TagEloRow): number =>
  a.score === null || b.score === null ? Number(a.score === null) - Number(b.score === null) : b.score - a.score;
const byLastSeen = (a: TagEloRow, b: TagEloRow): number => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '');
const SORTS: Record<typeof sortBy.value, (a: TagEloRow, b: TagEloRow) => number> = {
  score: byScore,
  count: (a, b) => b.count - a.count,
  lastSeen: byLastSeen,
  tag: (a, b) => a.tag.localeCompare(b.tag),
};

const visible = computed<TagEloRow[]>(() => {
  const chosen = batchOptions.value.filter((o) => selectedBatches.value.includes(o.key)).map((o) => o.batch);
  const q = search.value?.trim().toLowerCase();
  const min = Number(minCount.value) || 0;
  return (view.value?.rows ?? [])
    .filter(
      (r) =>
        chosen.some((b) => matchesTagBatch(r.tag, b, r.role)) &&
        r.count >= min &&
        (!q || r.tag.toLowerCase().includes(q))
    )
    .sort((a, b) => SORTS[sortBy.value](a, b) || a.tag.localeCompare(b.tag));
});

/** Rows with a rating: the ones the charts can place. */
const plotted = computed(() => visible.value.filter((r) => r.score !== null));

// ---------------------------------------------------------------------------
// Picked tags: plotted as trajectories, each keeping its colour while picked
// ---------------------------------------------------------------------------

const MAX_PICKED = 8;
const picked = ref<Map<string, number>>(new Map());

function toggle(tag: string): void {
  const next = new Map(picked.value);
  if (next.has(tag)) next.delete(tag);
  else {
    if (next.size >= MAX_PICKED) return;
    const used = new Set(next.values());
    let slot = 0;
    while (used.has(slot)) slot++;
    next.set(tag, slot);
  }
  picked.value = next;
}

watch(
  () => props.dataset,
  () => {
    picked.value = new Map();
    selectedBatches.value = batchOptions.value.filter((o) => !o.course && !isBookkeeping(o.batch)).map((o) => o.key);
  },
  { immediate: true }
);

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Short labels where they're unique among the tags in view, full tags where they aren't. */
const labels = computed(() => {
  const short = new Map<string, string>();
  const uses = new Map<string, number>();
  for (const r of visible.value) {
    const s = shortTag(props.interpreters, r.tag);
    short.set(r.tag, s);
    uses.set(s, (uses.get(s) ?? 0) + 1);
  }
  return new Map([...short].map(([tag, s]) => [tag, (uses.get(s) ?? 0) > 1 ? tag : s]));
});
const labelOf = (tag: string): string => labels.value.get(tag) ?? shortTag(props.interpreters, tag);

// ---------------------------------------------------------------------------
// Chart chrome: the admin palette's ink and categorical slots, per theme
// ---------------------------------------------------------------------------

const theme = useTheme();
const dark = computed(() => theme.current.value.dark);

const SLOTS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const INK = {
  light: { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
  dark: { primary: '#f0efec', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
};
const ink = computed(() => INK[dark.value ? 'dark' : 'light']);
const slotColor = (slot: number): string => SLOTS[dark.value ? 'dark' : 'light'][slot];
const contextLine = computed(() => (dark.value ? 'rgba(195,194,183,0.18)' : 'rgba(82,81,78,0.16)'));
const surface = computed(() => theme.current.value.colors.surface);

// ---------------------------------------------------------------------------
// ELO by tag (dot plot)
// ---------------------------------------------------------------------------

const ROW_PX = 20;
const dotHeight = computed(() => Math.max(160, plotted.value.length * ROW_PX + 72));
const dotSize = (count: number): number => Math.min(20, 8 + 2.2 * Math.log1p(count));

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function rowTooltip(r: TagEloRow): string {
  const recent = r.recent.length ? `recent ${r.recentOk}/${r.recent.length} correct` : 'no recent buffer';
  return [
    `<b>${escapeHtml(r.tag)}</b>`,
    `ELO ${r.score} (${signed(r.vsGlobal)} vs global) · ${r.count} responses`,
    `${recent} · last seen ${fmtDate(r.lastSeen)}`,
  ].join('<br/>');
}

const dotOption = computed<EChartsCoreOption>(() => {
  const rows = plotted.value;
  const c = ink.value;
  const global = view.value?.global.score ?? 0;
  const scores = [global, ...rows.map((r) => r.score as number)];
  const lo = Math.floor((Math.min(...scores) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...scores) + 20) / 50) * 50;
  return {
    animation: false,
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      // The whole row band answers hover, not only the dot.
      axisPointer: { type: 'shadow', axis: 'y' },
      formatter: (params: unknown) => {
        const i = (params as Array<{ dataIndex: number }>)[0]?.dataIndex;
        return i === undefined ? '' : rowTooltip(rows[i]);
      },
    },
    xAxis: {
      type: 'value',
      position: 'top',
      min: lo,
      max: hi,
      axisLabel: { color: c.muted },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: c.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      triggerEvent: true,
      data: rows.map((r) => labelOf(r.tag)),
      axisLabel: { color: c.secondary, fontSize: 11, interval: 0 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.axis } },
    },
    series: [
      {
        type: 'scatter',
        data: rows.map((r, i) => {
          const slot = picked.value.get(r.tag);
          return {
            name: r.tag,
            value: [r.score, i],
            symbolSize: dotSize(r.count),
            itemStyle: {
              color: slot === undefined ? c.muted : slotColor(slot),
              borderColor: surface.value,
              borderWidth: 2,
            },
          };
        }),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: c.primary, type: 'solid', width: 1 },
          label: { formatter: `global ${global}`, color: c.secondary, position: 'end' },
          data: [{ xAxis: global }],
        },
      },
    ],
  };
});

function onDotClick(e: ECElementEvent): void {
  if (e.componentType === 'series' && typeof e.name === 'string') toggle(e.name);
  else if (e.componentType === 'yAxis') {
    const label = (e as unknown as { value?: string }).value;
    const row = plotted.value.find((r) => labelOf(r.tag) === label);
    if (row) toggle(row.tag);
  }
}

// ---------------------------------------------------------------------------
// Trajectories
// ---------------------------------------------------------------------------

const toData = (points: EloPoint[]): Array<[string, number]> => points.map((p) => [p.at, p.score]);

/** A step series' value at time t: its last point at or before t. */
function valueAt(points: EloPoint[], t: number): number | null {
  let v: number | null = null;
  for (const p of points) {
    if (Date.parse(p.at) > t) break;
    v = p.score;
  }
  return v;
}

const lineOption = computed<EChartsCoreOption>(() => {
  const v = view.value;
  const c = ink.value;
  if (!v) return {};
  const chosen = [...picked.value].filter(([tag]) => v.series.tags[tag]);
  const context = plotted.value.filter((r) => !picked.value.has(r.tag) && v.series.tags[r.tag]);
  const labelled = chosen.length <= 4;
  const shown: Array<{ name: string; color: string; points: EloPoint[] }> = [
    { name: 'global', color: c.primary, points: v.series.global },
    ...chosen.map(([tag, slot]) => ({ name: labelOf(tag), color: slotColor(slot), points: v.series.tags[tag] })),
  ];
  return {
    animation: false,
    grid: { left: 8, right: labelled ? 96 : 16, top: 36, bottom: 48, containLabel: true },
    legend: {
      top: 0,
      data: shown.map((s) => s.name),
      textStyle: { color: c.secondary },
      selectedMode: false,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const t = Number((params as Array<{ axisValue: number }>)[0]?.axisValue);
        if (!Number.isFinite(t)) return '';
        const lines = shown
          .map((s) => ({ s, value: valueAt(s.points, t) }))
          .filter((x) => x.value !== null)
          .map(
            ({ s, value }) =>
              `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:6px;background:${s.color}"></span>${escapeHtml(s.name)} ${value}`
          );
        return [fmtTime(new Date(t).toISOString()), ...lines].join('<br/>');
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: c.muted },
      axisLine: { lineStyle: { color: c.axis } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: c.muted },
      splitLine: { lineStyle: { color: c.grid } },
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }],
    series: [
      ...context.map((r) => ({
        type: 'line',
        name: r.tag,
        data: toData(v.series.tags[r.tag]),
        step: 'end',
        showSymbol: false,
        triggerLineEvent: true,
        lineStyle: { width: 1, color: contextLine.value },
        itemStyle: { color: contextLine.value },
        emphasis: { lineStyle: { width: 2, color: c.muted } },
        z: 1,
      })),
      ...shown.map((s, i) => ({
        type: 'line',
        name: s.name,
        data: toData(s.points),
        step: 'end',
        showSymbol: false,
        triggerLineEvent: true,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
        endLabel: { show: i === 0 || labelled, formatter: s.name, color: c.secondary },
        z: i === 0 ? 3 : 4,
      })),
    ],
  };
});

function onLineClick(e: ECElementEvent): void {
  if (e.componentType !== 'series' || typeof e.seriesName !== 'string') return;
  // Context lines are named by tag; picked lines by label.
  const tag =
    view.value?.series.tags[e.seriesName] !== undefined
      ? e.seriesName
      : [...picked.value.keys()].find((t) => labelOf(t) === e.seriesName);
  if (tag) toggle(tag);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function signed(d: number | null): string {
  if (d === null) return '—';
  return d > 0 ? `+${d}` : String(d);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function staleTitle(r: TagEloRow): string {
  return r.staleScore !== undefined
    ? 'counted, not rated: the bracketed score predates count-only roles and is ignored'
    : 'counted, not rated';
}

const tiles = computed(() => {
  const v = view.value;
  const rated = (v?.rows ?? []).filter((r) => r.score !== null);
  const gaps = plotted.value.map((r) => r.vsGlobal as number).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  return [
    { label: `global ELO (${v?.global.count ?? 0} responses)`, value: v?.global.score ?? '—' },
    { label: 'rated tags in view', value: `${plotted.value.length} / ${rated.length}` },
    { label: 'median vs global, in view', value: signed(median) },
    { label: 'trajectories from', value: fmtDate(v?.seriesFrom ?? null) },
  ];
});
</script>

<style scoped>
.sk-tag-elo-sticky {
  position: sticky;
  top: 72px;
}
.sk-tag-elo-table tbody tr.sk-pickable {
  cursor: pointer;
}
.sk-swatch {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 4px;
  margin-right: 6px;
  vertical-align: middle;
}
.sk-ticks {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.sk-tick {
  display: inline-block;
  width: 5px;
  height: 12px;
  border-radius: 1px;
}
</style>
