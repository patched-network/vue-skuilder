<template>
  <div class="sk-run-detail">
    <div v-if="run.generators?.length" class="mb-2">
      <div class="text-caption font-weight-medium">generators</div>
      <v-table density="compact" class="sk-mini-table">
        <thead>
          <tr>
            <th></th>
            <th class="text-right">cards</th>
            <th class="text-right">new</th>
            <th class="text-right">review</th>
            <th class="text-right">top</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in run.generators" :key="g.name">
            <td>{{ g.name }}</td>
            <td class="text-right">{{ g.cardCount }}</td>
            <td class="text-right">{{ g.newCount }}</td>
            <td class="text-right">{{ g.reviewCount }}</td>
            <td class="text-right">{{ g.topScore.toFixed(2) }}</td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <div v-if="run.filters?.length" class="mb-2">
      <div class="text-caption font-weight-medium">filters</div>
      <v-table density="compact" class="sk-mini-table">
        <thead>
          <tr>
            <th></th>
            <th class="text-right">boosted</th>
            <th class="text-right">penalized</th>
            <th class="text-right">passed</th>
            <th class="text-right">removed</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in run.filters" :key="f.name">
            <td>{{ f.name }}</td>
            <td class="text-right">{{ f.boosted }}</td>
            <td class="text-right">{{ f.penalized }}</td>
            <td class="text-right">{{ f.passed }}</td>
            <td class="text-right" :class="f.removed > 0 ? 'text-error' : ''">{{ f.removed }}</td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <div v-if="run.cards?.length" class="mb-2">
      <div class="text-caption font-weight-medium">selection</div>
      <v-table density="compact" class="sk-mini-table">
        <thead>
          <tr>
            <th></th>
            <th>card</th>
            <th>origin</th>
            <th>generator</th>
            <th class="text-right">score</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in run.cards" :key="c.cardId" :class="c.selected ? '' : 'text-medium-emphasis'">
            <td>
              <v-icon v-if="c.selected" size="x-small" color="success">mdi-check</v-icon>
              <span v-else title="runner-up">·</span>
            </td>
            <td>
              <a class="sk-card-link" @click="emit('open-card', c.cardId)">{{ c.cardId }}</a>
            </td>
            <td>{{ c.origin }}</td>
            <td>{{ c.generator ?? '—' }}</td>
            <td class="text-right">{{ fmtScore(c.score) }}</td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <div v-for="t in trails" :key="t.label" class="mb-2">
      <div class="text-caption font-weight-medium">
        {{ t.label }}:
        <a class="sk-card-link" @click="emit('open-card', t.card.cardId)">{{ t.card.cardId }}</a>
        <span class="text-medium-emphasis">
          ({{ t.card.origin }}, {{ t.card.generator ?? '?' }}) final {{ fmtScore(t.card.score) }}
        </span>
      </div>
      <v-table density="compact" class="sk-mini-table">
        <tbody>
          <tr v-for="(p, i) in t.card.trail" :key="i">
            <td class="text-no-wrap">{{ p.action }}</td>
            <td class="text-no-wrap">{{ p.strategyName }}</td>
            <td class="text-right text-no-wrap">{{ fmtScore(p.score) }}</td>
            <td class="text-caption">{{ p.reason }}</td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <div v-if="run.hints" class="mb-2">
      <div class="text-caption font-weight-medium">hints</div>
      <pre class="sk-hint-block">{{ JSON.stringify(run.hints, null, 2) }}</pre>
    </div>

    <div v-if="run.discardedTail" class="text-caption text-medium-emphasis">
      discarded tail: {{ run.discardedTail.count }} cards
      <template v-if="run.discardedTail.scoreRange">
        · score [{{ run.discardedTail.scoreRange[0].toFixed(2) }}, {{ run.discardedTail.scoreRange[1].toFixed(2) }}]
      </template>
      <template v-if="run.discardedTail.eloRange">
        · ELO [{{ Math.round(run.discardedTail.eloRange[0]) }}, {{ Math.round(run.discardedTail.eloRange[1]) }}]
      </template>
      <div v-if="run.discardedTail.note">{{ run.discardedTail.note }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { StudySessionRunCardTrail, StudySessionRunSummary } from '@vue-skuilder/db/diagnostics';

/** The persisted detail of one pipeline run. */
const props = defineProps<{ run: StudySessionRunSummary }>();
const emit = defineEmits<{ 'open-card': [cardId: string] }>();

const trails = computed(() => {
  const u = props.run.unselectedNew;
  const out: Array<{ label: string; card: StudySessionRunCardTrail }> = [];
  if (u?.nextInLine) out.push({ label: 'next new card in line', card: u.nextInLine });
  if (u?.topGenerated) out.push({ label: 'top-generated new card (sunk)', card: u.topGenerated });
  return out;
});

function fmtScore(n: number): string {
  return Math.abs(n) >= 0.01 || n === 0 ? n.toFixed(2) : n.toExponential(1);
}
</script>

<style scoped>
.sk-run-detail {
  border-left: 2px solid rgba(var(--v-theme-primary), 0.25);
  padding-left: 10px;
  margin-left: 2px;
}
.sk-mini-table :deep(td),
.sk-mini-table :deep(th) {
  font-size: 0.72rem;
}
.sk-hint-block {
  font-size: 0.72rem;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 0;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
}
.sk-card-link {
  cursor: pointer;
  border-bottom: 1px dotted rgba(var(--v-theme-on-surface), 0.3);
}
.sk-card-link:hover {
  color: rgb(var(--v-theme-primary));
}
</style>
