<template>
  <div class="hierarchy-config-form">
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

        <!-- Prerequisites Builder -->
        <div class="prerequisites-section">
          <div class="d-flex align-center mb-2">
            <h4 class="text-subtitle-1">Prerequisites</h4>
            <v-spacer></v-spacer>
            <v-btn size="small" color="primary" @click="addPrerequisiteRule">
              <v-icon start>mdi-plus</v-icon>
              Add Rule
            </v-btn>
          </div>

          <v-alert v-if="Object.keys(config.prerequisites).length === 0" type="info" density="compact">
            No prerequisites defined. Click "Add Rule" to gate a tag behind prerequisite mastery.
          </v-alert>

          <!-- Prerequisite Rules List -->
          <v-card
            v-for="(prereqs, tagId) in config.prerequisites"
            :key="tagId"
            variant="outlined"
            class="mb-3 pa-3"
          >
            <div class="d-flex align-center mb-2">
              <v-select
                :model-value="tagId"
                @update:model-value="(newTag) => renamePrerequisiteTag(tagId, newTag)"
                :items="availableTags"
                :loading="loadingTags"
                :disabled="loadingTags"
                label="Gated Tag"
                hint="This tag will be locked until prerequisites are met"
                persistent-hint
                density="compact"
                style="max-width: 300px"
              ></v-select>
              <v-spacer></v-spacer>
              <v-btn icon size="small" color="error" @click="removePrerequisiteRule(tagId)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>

            <v-divider class="my-2"></v-divider>

            <div class="text-caption mb-2">Requires mastery of:</div>

            <!-- Prerequisites for this tag -->
            <div
              v-for="(prereq, idx) in prereqs"
              :key="`${tagId}-${idx}`"
              class="d-flex align-center gap-2 mb-2"
            >
              <v-select
                :model-value="prereq.tag"
                @update:model-value="(newTag) => updatePrerequisiteTag(tagId, idx, newTag)"
                :items="availableTags"
                :loading="loadingTags"
                :disabled="loadingTags"
                label="Prerequisite Tag"
                density="compact"
                style="flex: 1; max-width: 200px"
              ></v-select>

              <v-text-field
                :model-value="prereq.masteryThreshold?.minCount"
                @update:model-value="(val) => updateMinCount(tagId, idx, val)"
                label="Min Count"
                type="number"
                density="compact"
                style="max-width: 100px"
                hint="Min interactions"
                persistent-hint
              ></v-text-field>

              <v-text-field
                :model-value="prereq.masteryThreshold?.minElo"
                @update:model-value="(val) => updateMinElo(tagId, idx, val)"
                label="Min ELO"
                type="number"
                density="compact"
                style="max-width: 100px"
                hint="Optional"
                persistent-hint
              ></v-text-field>

              <v-btn icon size="small" @click="removePrerequisite(tagId, idx)">
                <v-icon>mdi-minus-circle</v-icon>
              </v-btn>
            </div>

            <v-btn size="small" variant="text" @click="addPrerequisite(tagId)">
              <v-icon start>mdi-plus</v-icon>
              Add Prerequisite
            </v-btn>
          </v-card>
        </div>
      </v-window-item>

      <!-- JSON Editor Mode -->
      <v-window-item value="json">
        <v-textarea
          :model-value="jsonText"
          @update:model-value="updateFromJson"
          label="Configuration JSON"
          rows="15"
          placeholder='{"prerequisites": {"cvc-words": [{"tag": "letter-sounds", "masteryThreshold": {"minCount": 10}}]}, "delegateStrategy": "elo"}'
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

interface TagPrerequisite {
  tag: string;
  masteryThreshold?: {
    minElo?: number;
    minCount?: number;
  };
}

export interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: TagPrerequisite[];
  };
  delegateStrategy?: string;
}

export default defineComponent({
  name: 'HierarchyConfigForm',

  props: {
    modelValue: {
      type: Object as () => HierarchyConfig,
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

    // Reactive copy of config for editing
    const config = computed(() => props.modelValue);

    // JSON representation
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
        console.log('Loaded tags:', availableTags.value);
      } catch (error) {
        console.error('Failed to load course tags:', error);
        validationError.value = 'Failed to load course tags';
      } finally {
        loadingTags.value = false;
      }
    }

    // Update delegate strategy
    function updateDelegateStrategy(value: string) {
      emit('update:modelValue', {
        ...config.value,
        delegateStrategy: value,
      });
    }

    // Add a new prerequisite rule (new gated tag)
    function addPrerequisiteRule() {
      const newTag = availableTags.value[0] || 'new-tag';
      emit('update:modelValue', {
        ...config.value,
        prerequisites: {
          ...config.value.prerequisites,
          [newTag]: [],
        },
      });
    }

    // Remove a prerequisite rule
    function removePrerequisiteRule(tagId: string) {
      const newPrereqs = { ...config.value.prerequisites };
      delete newPrereqs[tagId];
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Rename a prerequisite tag (change the key)
    function renamePrerequisiteTag(oldTag: string, newTag: string) {
      if (oldTag === newTag) return;
      const newPrereqs = { ...config.value.prerequisites };
      newPrereqs[newTag] = newPrereqs[oldTag];
      delete newPrereqs[oldTag];
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Add a prerequisite to a tag
    function addPrerequisite(tagId: string) {
      const newPrereqTag = availableTags.value.find((t) => t !== tagId) || 'prerequisite-tag';
      const newPrereqs = { ...config.value.prerequisites };
      newPrereqs[tagId] = [
        ...newPrereqs[tagId],
        {
          tag: newPrereqTag,
          masteryThreshold: { minCount: 3 },
        },
      ];
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Remove a prerequisite
    function removePrerequisite(tagId: string, idx: number) {
      const newPrereqs = { ...config.value.prerequisites };
      newPrereqs[tagId] = newPrereqs[tagId].filter((_, i) => i !== idx);
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Update prerequisite tag
    function updatePrerequisiteTag(tagId: string, idx: number, newTag: string) {
      const newPrereqs = { ...config.value.prerequisites };
      newPrereqs[tagId][idx] = {
        ...newPrereqs[tagId][idx],
        tag: newTag,
      };
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Update min count
    function updateMinCount(tagId: string, idx: number, value: string | number) {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(numValue)) return;

      const newPrereqs = { ...config.value.prerequisites };
      const prereq = newPrereqs[tagId][idx];
      newPrereqs[tagId][idx] = {
        ...prereq,
        masteryThreshold: {
          ...prereq.masteryThreshold,
          minCount: numValue,
        },
      };
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Update min ELO
    function updateMinElo(tagId: string, idx: number, value: string | number) {
      if (value === '' || value === null || value === undefined) {
        // Remove minElo if cleared
        const newPrereqs = { ...config.value.prerequisites };
        const prereq = newPrereqs[tagId][idx];
        const newThreshold = { ...prereq.masteryThreshold };
        delete newThreshold.minElo;
        newPrereqs[tagId][idx] = {
          ...prereq,
          masteryThreshold: newThreshold,
        };
        emit('update:modelValue', {
          ...config.value,
          prerequisites: newPrereqs,
        });
        return;
      }

      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(numValue)) return;

      const newPrereqs = { ...config.value.prerequisites };
      const prereq = newPrereqs[tagId][idx];
      newPrereqs[tagId][idx] = {
        ...prereq,
        masteryThreshold: {
          ...prereq.masteryThreshold,
          minElo: numValue,
        },
      };
      emit('update:modelValue', {
        ...config.value,
        prerequisites: newPrereqs,
      });
    }

    // Update from JSON
    function updateFromJson(text: string) {
      jsonError.value = null;
      try {
        const parsed = JSON.parse(text);
        // Basic validation
        if (!parsed.prerequisites || typeof parsed.prerequisites !== 'object') {
          throw new Error('Config must have "prerequisites" object');
        }
        emit('update:modelValue', parsed);
      } catch (error) {
        jsonError.value = error instanceof Error ? error.message : 'Invalid JSON';
      }
    }

    // Validate using navigator's parseConfig
    function validateConfig() {
      validationError.value = null;
      try {
        // Basic validation
        if (!config.value.prerequisites || typeof config.value.prerequisites !== 'object') {
          throw new Error('Prerequisites must be an object');
        }

        // Check for circular dependencies (basic check)
        const allTags = new Set(Object.keys(config.value.prerequisites));
        for (const [tagId, prereqs] of Object.entries(config.value.prerequisites)) {
          for (const prereq of prereqs) {
            if (prereq.tag === tagId) {
              throw new Error(`Circular dependency: ${tagId} requires itself`);
            }
          }
        }

        return true;
      } catch (error) {
        validationError.value = error instanceof Error ? error.message : 'Invalid configuration';
        return false;
      }
    }

    // Load tags on mount
    onMounted(() => {
      loadCourseTags();
    });

    // Validate on config change
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
      jsonText,
      jsonError,
      validationError,
      updateDelegateStrategy,
      addPrerequisiteRule,
      removePrerequisiteRule,
      renamePrerequisiteTag,
      addPrerequisite,
      removePrerequisite,
      updatePrerequisiteTag,
      updateMinCount,
      updateMinElo,
      updateFromJson,
    };
  },
});
</script>

<style scoped>
.hierarchy-config-form {
  padding: 16px 0;
}

.prerequisites-section {
  margin-top: 16px;
}

.gap-2 {
  gap: 8px;
}
</style>
