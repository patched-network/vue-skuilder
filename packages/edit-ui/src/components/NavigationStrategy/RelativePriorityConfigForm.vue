<template>
  <div class="relative-priority-config-form">
    <!-- Input Mode Toggle -->
    <v-tabs v-model="inputMode" density="compact" class="mb-4">
      <v-tab value="ui">Visual Editor</v-tab>
      <v-tab value="json">JSON Editor</v-tab>
    </v-tabs>

    <v-window v-model="inputMode">
      <!-- Visual Editor Mode -->
      <v-window-item value="ui">
        <!-- Delegate Strategy Selector -->
        <v-select
          :model-value="config.delegateStrategy || 'elo'"
          @update:model-value="updateDelegateStrategy"
          label="Delegate Strategy"
          :items="delegateStrategies"
          hint="Strategy used to generate candidate cards"
          persistent-hint
          class="mb-4"
        ></v-select>

        <!-- Configuration Options -->
        <div class="config-options mb-4">
          <h4 class="text-subtitle-1 mb-2">Priority Configuration</h4>

          <v-slider
            :model-value="config.defaultPriority !== undefined ? config.defaultPriority : 0.5"
            @update:model-value="updateDefaultPriority"
            label="Default Priority"
            :min="0"
            :max="1"
            :step="0.05"
            thumb-label
            hint="Priority for tags not explicitly listed (0.5 = neutral)"
            persistent-hint
            class="mb-3"
          >
            <template #append>
              <v-text-field
                :model-value="config.defaultPriority !== undefined ? config.defaultPriority : 0.5"
                @update:model-value="updateDefaultPriority"
                type="number"
                style="width: 80px"
                density="compact"
                hide-details
                :min="0"
                :max="1"
                :step="0.05"
              ></v-text-field>
            </template>
          </v-slider>

          <v-select
            :model-value="config.combineMode || 'max'"
            @update:model-value="updateCombineMode"
            label="Combine Mode"
            :items="combineModes"
            hint="How to combine priorities when a card has multiple tags"
            persistent-hint
            density="compact"
            class="mb-3"
          ></v-select>

          <v-slider
            :model-value="config.priorityInfluence !== undefined ? config.priorityInfluence : 0.5"
            @update:model-value="updatePriorityInfluence"
            label="Priority Influence"
            :min="0"
            :max="1"
            :step="0.05"
            thumb-label
            hint="How strongly priority affects scoring (0 = no effect, 1 = maximum effect)"
            persistent-hint
          >
            <template #append>
              <v-text-field
                :model-value="config.priorityInfluence !== undefined ? config.priorityInfluence : 0.5"
                @update:model-value="updatePriorityInfluence"
                type="number"
                style="width: 80px"
                density="compact"
                hide-details
                :min="0"
                :max="1"
                :step="0.05"
              ></v-text-field>
            </template>
          </v-slider>
        </div>

        <!-- Tag Priorities -->
        <div class="tag-priorities-section">
          <h4 class="text-subtitle-1 mb-2">Tag Priorities</h4>
          <p class="text-caption mb-3">Set priority for each tag (1.0 = highest priority, 0.0 = lowest)</p>

          <v-alert v-if="loadingTags" type="info" density="compact">
            Loading tags...
          </v-alert>

          <v-alert v-else-if="availableTags.length === 0" type="warning" density="compact">
            No tags available in course
          </v-alert>

          <div v-else class="tag-priority-list">
            <div
              v-for="tag in availableTags"
              :key="tag"
              class="tag-priority-item mb-3"
            >
              <v-slider
                :model-value="getTagPriority(tag)"
                @update:model-value="(val) => updateTagPriority(tag, val)"
                :label="tag"
                :min="0"
                :max="1"
                :step="0.05"
                thumb-label
                density="compact"
              >
                <template #append>
                  <v-text-field
                    :model-value="getTagPriority(tag)"
                    @update:model-value="(val) => updateTagPriority(tag, val)"
                    type="number"
                    style="width: 80px"
                    density="compact"
                    hide-details
                    :min="0"
                    :max="1"
                    :step="0.05"
                  ></v-text-field>
                </template>
              </v-slider>
            </div>
          </div>
        </div>
      </v-window-item>

      <!-- JSON Editor Mode -->
      <v-window-item value="json">
        <v-textarea
          :model-value="jsonText"
          @update:model-value="updateFromJson"
          label="Configuration JSON"
          rows="15"
          placeholder='{"tagPriorities": {"letter-s": 0.95, "letter-t": 0.90}, "defaultPriority": 0.5, "combineMode": "max", "priorityInfluence": 0.5, "delegateStrategy": "elo"}'
          hint="Paste or edit JSON configuration directly"
          persistent-hint
          auto-grow
        ></v-textarea>

        <v-alert v-if="jsonError" type="error" density="compact" class="mt-2">
          {{ jsonError }}
        </v-alert>

        <v-alert v-else-if="jsonText" type="success" density="compact" class="mt-2">
          Valid configuration
        </v-alert>
      </v-window-item>
    </v-window>

    <!-- Validation Summary -->
    <v-alert v-if="validationError" type="error" density="compact" class="mt-3">
      {{ validationError }}
    </v-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import { getDataLayer } from '@vue-skuilder/db';

interface RelativePriorityConfig {
  tagPriorities: { [tagId: string]: number };
  defaultPriority?: number;
  combineMode?: 'max' | 'average' | 'min';
  priorityInfluence?: number;
  delegateStrategy?: string;
}

export default defineComponent({
  name: 'RelativePriorityConfigForm',

  props: {
    modelValue: {
      type: Object as () => RelativePriorityConfig,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
  },

  emits: ['update:modelValue'],

  setup(props, { emit }) {
    const inputMode = ref<'ui' | 'json'>('ui');
    const availableTags = ref<string[]>([]);
    const validationError = ref<string | null>(null);
    const jsonError = ref<string | null>(null);
    const loadingTags = ref(true);

    const delegateStrategies = ['elo', 'srs', 'hardcoded'];
    const combineModes = [
      { title: 'Max (highest priority wins)', value: 'max' },
      { title: 'Average (average all priorities)', value: 'average' },
      { title: 'Min (lowest priority wins)', value: 'min' },
    ];

    const config = computed(() => props.modelValue);

    const jsonText = computed(() => {
      try {
        return JSON.stringify(config.value, null, 2);
      } catch {
        return '';
      }
    });

    // Load available tags from course
    async function loadCourseTags() {
      loadingTags.value = true;
      try {
        const dataLayer = getDataLayer();
        const courseDB = dataLayer.getCourseDB(props.courseId);
        const tags = await courseDB.getCourseTagStubs();
        availableTags.value = tags.rows.map((row) => row.id.replace('TAG-', ''));
      } catch (error) {
        console.error('Failed to load course tags:', error);
        validationError.value = 'Failed to load course tags';
      } finally {
        loadingTags.value = false;
      }
    }

    function updateDelegateStrategy(value: string) {
      emit('update:modelValue', {
        ...config.value,
        delegateStrategy: value,
      });
    }

    function updateDefaultPriority(value: string | number) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        defaultPriority: Math.max(0, Math.min(1, numValue)),
      });
    }

    function updateCombineMode(value: 'max' | 'average' | 'min') {
      emit('update:modelValue', {
        ...config.value,
        combineMode: value,
      });
    }

    function updatePriorityInfluence(value: string | number) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        priorityInfluence: Math.max(0, Math.min(1, numValue)),
      });
    }

    function getTagPriority(tag: string): number {
      return config.value.tagPriorities[tag] !== undefined
        ? config.value.tagPriorities[tag]
        : config.value.defaultPriority !== undefined
        ? config.value.defaultPriority
        : 0.5;
    }

    function updateTagPriority(tag: string, value: string | number) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        tagPriorities: {
          ...config.value.tagPriorities,
          [tag]: Math.max(0, Math.min(1, numValue)),
        },
      });
    }

    function updateFromJson(text: string) {
      jsonError.value = null;
      try {
        const parsed = JSON.parse(text);
        if (!parsed.tagPriorities || typeof parsed.tagPriorities !== 'object') {
          throw new Error('Config must have "tagPriorities" object');
        }
        emit('update:modelValue', parsed);
      } catch (error) {
        jsonError.value = error instanceof Error ? error.message : 'Invalid JSON';
      }
    }

    function validateConfig() {
      validationError.value = null;
      try {
        if (!config.value.tagPriorities || typeof config.value.tagPriorities !== 'object') {
          throw new Error('Tag priorities must be an object');
        }

        for (const [tag, priority] of Object.entries(config.value.tagPriorities)) {
          if (typeof priority !== 'number' || priority < 0 || priority > 1) {
            throw new Error(`Priority for ${tag} must be between 0 and 1`);
          }
        }

        return true;
      } catch (error) {
        validationError.value = error instanceof Error ? error.message : 'Invalid configuration';
        return false;
      }
    }

    onMounted(() => {
      loadCourseTags();
    });

    watch(
      () => config.value,
      () => {
        validateConfig();
      },
      { deep: true }
    );

    return {
      inputMode,
      config,
      availableTags,
      loadingTags,
      delegateStrategies,
      combineModes,
      jsonText,
      jsonError,
      validationError,
      updateDelegateStrategy,
      updateDefaultPriority,
      updateCombineMode,
      updatePriorityInfluence,
      getTagPriority,
      updateTagPriority,
      updateFromJson,
    };
  },
});
</script>

<style scoped>
.relative-priority-config-form {
  padding: 16px 0;
}

.config-options,
.tag-priorities-section {
  margin-top: 16px;
}

.tag-priority-list {
  max-height: 400px;
  overflow-y: auto;
}

.tag-priority-item {
  padding: 8px;
  border-left: 3px solid #e0e0e0;
}
</style>
