<template>
  <div class="playtest pa-4">
    <!-- Index mode: no question selected -->
    <template v-if="!slug">
      <h1 class="text-h4 mb-4">Playtest</h1>
      <p class="text-body-2 mb-4">
        Render any question type from <code>@vue-skuilder/courseware</code> with author-input
        and/or self-generation. Dev-only route. Bypasses the <code>allCourseWare</code> registry —
        unregistered prototypes (e.g. forks) are loadable here.
      </p>
      <div v-for="group in grouped" :key="group.domain" class="mb-4">
        <h2 class="text-h6">{{ group.domain }}</h2>
        <ul>
          <li v-for="q in group.questions" :key="q.slug">
            <router-link :to="`/play/${q.slug}`">{{ q.slug }}</router-link>
          </li>
        </ul>
      </div>
    </template>

    <!-- Loading / error -->
    <template v-else-if="loadError">
      <router-link to="/play">&larr; back to index</router-link>
      <v-alert type="error" class="mt-4">{{ loadError }}</v-alert>
    </template>
    <template v-else-if="!QClass">
      <v-progress-circular indeterminate />
    </template>

    <!-- Question mode -->
    <template v-else>
      <div class="d-flex align-center mb-3">
        <router-link to="/play">&larr; index</router-link>
        <h1 class="text-h5 mx-4">{{ slug }}</h1>
        <v-chip size="small" :color="QClass.acceptsUserData ? 'primary' : 'secondary'">
          {{ QClass.acceptsUserData ? 'authored' : 'self-gen' }}
        </v-chip>
        <v-spacer />
        <v-btn size="small" color="primary" @click="reroll">Reroll</v-btn>
      </div>

      <v-row>
        <!-- Author input + DataInputForm's own preview -->
        <v-col v-if="dataShape" cols="12" lg="6">
          <h3 class="text-subtitle-1 mb-2">Author input</h3>
          <DataInputForm
            :key="`form-${rerollKey}`"
            :data-shape="dataShape"
            :preview-component="QClass"
            :course-cfg="fakeCourseCfg"
          />
        </v-col>

        <!-- Direct CardViewer + response log -->
        <v-col :cols="dataShape ? 12 : 12" :lg="dataShape ? 6 : 12">
          <h3 class="text-subtitle-1 mb-2">Render &amp; capture</h3>
          <div v-if="renderData">
            <CardViewer
              :key="`view-${rerollKey}`"
              :view="QClass.views[0]"
              :data="renderData"
              card_id="playtest"
              course_id="playtest"
              @emit-response="onResponse"
            />
          </div>
          <v-alert v-else type="info" density="compact">
            Fill in the author form on the left to populate render data.
          </v-alert>

          <h3 class="text-subtitle-1 mt-4 mb-2">
            Response log ({{ responseLog.length }})
            <v-btn v-if="responseLog.length" size="x-small" variant="text" @click="responseLog = []">
              clear
            </v-btn>
          </h3>
          <pre v-if="responseLog.length" class="response-log">{{
            JSON.stringify(responseLog, null, 2)
          }}</pre>
          <div v-else class="text-caption text-grey">No responses captured yet.</div>
        </v-col>
      </v-row>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useRoute } from 'vue-router';
import { DataInputForm, useDataInputFormStore } from '@vue-skuilder/edit-ui';
import { CardViewer, Question } from '@vue-skuilder/common-ui';
import type { DataShape, CourseConfig, ViewData } from '@vue-skuilder/common';
import type { CardRecord } from '@vue-skuilder/db';

type QClass = typeof Question;

// Discover every question module under @vue-skuilder/courseware.
// import.meta.glob is resolved at build time; in dev these are real
// filesystem paths across the yarn workspace.
const questionModules = import.meta.glob('../../../courseware/src/**/questions/**/index.ts');

const PREFIX = '../../../courseware/src/';
const SUFFIX = '/index.ts';

function pathToSlug(path: string): string {
  // path: ../../../courseware/src/chess/questions/puzzle/index.ts
  // slug: chess/puzzle
  return path.slice(PREFIX.length, -SUFFIX.length).replace('/questions/', '/');
}

function slugToPath(slug: string): string {
  // slug: chess/puzzle  →  path: chess/questions/puzzle
  const [domain, ...rest] = slug.split('/');
  return `${PREFIX}${domain}/questions/${rest.join('/')}${SUFFIX}`;
}

const allSlugs = Object.keys(questionModules).map(pathToSlug).sort();

const groupedSlugs = allSlugs.reduce<{ domain: string; questions: { slug: string }[] }[]>(
  (acc, slug) => {
    const domain = slug.split('/')[0];
    let group = acc.find((g) => g.domain === domain);
    if (!group) {
      group = { domain, questions: [] };
      acc.push(group);
    }
    group.questions.push({ slug });
    return acc;
  },
  []
);

const fakeCourseCfg: CourseConfig = {
  courseID: 'playtest',
  name: 'Playtest',
  description: 'Dev playtest harness — not a real course.',
  admins: ['admin'],
  creator: 'admin',
  deleted: false,
  moderators: [],
  public: false,
  disambiguator: 'playtest',
  questionTypes: [],
  dataShapes: [],
};

export default defineComponent({
  name: 'PlaytestViewer',
  components: { DataInputForm, CardViewer },

  setup() {
    return { route: useRoute(), dataInputFormStore: useDataInputFormStore() };
  },

  data() {
    return {
      QClass: null as QClass | null,
      dataShape: null as DataShape | null,
      loadError: '' as string,
      rerollKey: 0,
      responseLog: [] as CardRecord[],
      grouped: groupedSlugs,
      fakeCourseCfg,
    };
  },

  computed: {
    slug(): string {
      const raw = this.route.params.pathMatch;
      const s = Array.isArray(raw) ? raw.join('/') : raw || '';
      return s.replace(/^\/+|\/+$/g, '');
    },

    /**
     * Reactive view-data assembled from the DataInputForm store.
     *
     * Returns `[previewInput]` when the form's validation passes — this is
     * the same shape `card-browser` consumes inside DataInputForm, so the
     * two panels stay in sync. If the dataShape has no fields (rare;
     * fully self-generating types), fall back to `[{}]` so the view can
     * still mount.
     */
    renderData(): ViewData[] | null {
      if (!this.dataShape) return null;
      if (this.dataShape.fields.length === 0) return [{}];
      const preview = this.dataInputFormStore.dataInputForm.fieldStore.getPreview;
      if (!preview || Object.keys(preview).length === 0) return null;
      return [preview as ViewData];
    },
  },

  watch: {
    slug: {
      immediate: true,
      handler(s: string) {
        this.load(s);
      },
    },
  },

  methods: {
    async load(slug: string) {
      this.QClass = null;
      this.dataShape = null;
      this.loadError = '';
      this.responseLog = [];
      if (!slug) return;

      const path = slugToPath(slug);
      const loader = questionModules[path];
      if (!loader) {
        this.loadError = `No module at ${path}. Known slugs: ${allSlugs.join(', ')}`;
        return;
      }

      try {
        const mod = (await loader()) as Record<string, unknown>;
        const found = Object.values(mod).find(
          (v) => typeof v === 'function' && (v as { prototype: unknown }).prototype instanceof Question
        ) as QClass | undefined;
        if (!found) {
          this.loadError = `Module ${path} exports no Question subclass.`;
          return;
        }
        this.QClass = found;
        this.dataShape = found.dataShapes?.[0] ?? null;
      } catch (e) {
        this.loadError = `Failed to load ${path}: ${(e as Error).message}`;
      }
    },

    reroll() {
      this.rerollKey++;
      this.responseLog = [];
    },

    onResponse(r: CardRecord) {
      this.responseLog.push(r);
    },
  },
});
</script>

<style scoped>
.response-log {
  background: rgba(0, 0, 0, 0.04);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
