<!-- DocsCourse.vue - the docs course (a course about skuilder), with reading progress.
     Questions on a docs page open once that page is read, or its intro card is seen in a session.
     See docs/.vitepress/theme/docsCourse/ for the gate filter and the reading tracker. -->
<template>
  <div class="docs-course">
    <EmbeddedCourse
      :course-id="courseRef"
      :session-time-limit="sessionTimeLimit"
      :session-config="sessionConfig"
      :before-session="beforeSession"
    />

    <details v-if="showProgress" class="docs-course-progress" :open="progressOpen">
      <summary>
        What's in play: {{ openCount }} of {{ rows.length }} sections open
      </summary>
      <p v-if="!rows.length" class="muted">Loading…</p>
      <table v-else>
        <thead>
          <tr>
            <th>Section</th>
            <th>Read</th>
            <th>Intro seen</th>
            <th>Questions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <a v-if="row.page" :href="withBase(`/${row.page}.html`)">{{ row.title }}</a>
              <span v-else>{{ row.title }}</span>
            </td>
            <td>{{ row.read ? '✓' : '' }}</td>
            <td>{{ row.introduced ? '✓' : '' }}</td>
            <td>
              <span v-if="!row.open" class="muted">locked</span>
              <span v-else-if="!row.practiced">open, fresh</span>
              <span v-else>open</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted">
        A page counts as read after you've spent a little time on it and scrolled most of the way
        down. Reading progress lives in this browser.
        <button class="link-button" @click="reset">Reset reading progress</button>
        ·
        <button class="link-button" @click="refresh">Refresh</button>
      </p>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import type { DataLayerProvider } from '@vue-skuilder/db';
import type { StudySessionConfig } from '@vue-skuilder/common-ui';
import EmbeddedCourse from './EmbeddedCourse.vue';
import { useStaticDataLayer } from '../composables/useStaticDataLayer';
import {
  DOCS_READING_KEY,
  parseDocsReadingGateConfig,
  sectionStatuses,
  type DocsReadingState,
} from '../docsCourse/DocsReadingGate';
import { READING_EVENT, resetReading, syncReading } from '../docsCourse/reading';

interface Props {
  sessionTimeLimit?: number;
  showProgress?: boolean;
  progressOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  sessionTimeLimit: 5,
  showProgress: true,
  progressOpen: false,
});

const courseRef = '@skuilder/docs-course';

// Small batches: replans come often, so a section opened by its intro card surfaces quickly.
const sessionConfig: StudySessionConfig = { likesConfetti: true, defaultBatchLimit: 6 };

const beforeSession = async (dataLayer: DataLayerProvider) => {
  await syncReading(dataLayer, courseRef);
};

interface Row {
  id: string;
  title: string;
  page?: string;
  read: boolean;
  introduced: boolean;
  open: boolean;
  practiced: boolean;
}

const rows = ref<Row[]>([]);
const openCount = computed(() => rows.value.filter((r) => r.open).length);
const { dataLayer, initialize } = useStaticDataLayer();

async function refresh() {
  if (!props.showProgress) return;
  await initialize();
  const dl = dataLayer.value;
  if (!dl) return;
  const courseId = await syncReading(dl, courseRef);
  const courseDB = dl.getCourseDB(courseId);
  const user = dl.getUserDB();
  const strategy = (await courseDB.getAllNavigationStrategies()).find(
    (s) => s.implementingClass === 'docsReadingGate'
  );
  const config = parseDocsReadingGateConfig(strategy?.serializedData);
  const reading = await user.getStrategyState<DocsReadingState>(courseId, DOCS_READING_KEY);
  const status = await sectionStatuses(config, user, courseDB, reading);
  rows.value = [...status.entries()].map(([id, s]) => ({
    id,
    title: s.title,
    page: s.page ?? config.sections[id]?.pages[0],
    read: s.read,
    introduced: s.introduced,
    open: s.open,
    practiced: s.practiced,
  }));
}

async function reset() {
  await resetReading(dataLayer.value, courseRef);
  await refresh();
}

const onReading = () => void refresh();

onMounted(() => {
  void refresh();
  window.addEventListener(READING_EVENT, onReading);
  window.addEventListener('focus', onReading);
});

onUnmounted(() => {
  window.removeEventListener(READING_EVENT, onReading);
  window.removeEventListener('focus', onReading);
});
</script>

<style scoped>
.docs-course-progress {
  margin-top: 1rem;
  font-size: 0.9rem;
}
.docs-course-progress summary {
  cursor: pointer;
  color: var(--vp-c-text-2);
}
.docs-course-progress table {
  margin: 0.75rem 0;
  width: 100%;
}
.muted {
  color: var(--vp-c-text-2);
}
.link-button {
  background: none;
  border: none;
  padding: 0;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font: inherit;
}
</style>
