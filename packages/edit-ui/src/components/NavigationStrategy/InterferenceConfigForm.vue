<template>
  <div class="interference-config-form">
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

        <!-- Maturity Threshold -->
        <div class="maturity-section mb-4">
          <h4 class="text-subtitle-1 mb-2">Maturity Threshold</h4>
          <p class="text-caption mb-3">Tags below this threshold are considered "immature" (still being learned)</p>

          <v-text-field
            :model-value="config.maturityThreshold?.minCount"
            @update:model-value="updateMinCount"
            label="Min Count"
            type="number"
            hint="Minimum interactions required (default: 10)"
            persistent-hint
            density="compact"
            class="mb-2"
          ></v-text-field>

          <v-text-field
            :model-value="config.maturityThreshold?.minElo"
            @update:model-value="updateMinElo"
            label="Min ELO (optional)"
            type="number"
            hint="Minimum ELO score for maturity"
            persistent-hint
            density="compact"
            class="mb-2"
          ></v-text-field>

          <v-text-field
            :model-value="config.maturityThreshold?.minElapsedDays"
            @update:model-value="updateMinElapsedDays"
            label="Min Elapsed Days"
            type="number"
            hint="Minimum time since first interaction (default: 3)"
            persistent-hint
            density="compact"
          ></v-text-field>
        </div>

        <!-- Default Decay -->
        <div class="mb-4">
          <v-slider
            :model-value="config.defaultDecay || 0.8"
            @update:model-value="updateDefaultDecay"
            label="Default Decay"
            :min="0"
            :max="1"
            :step="0.05"
            thumb-label
            hint="Default interference strength for groups without explicit decay (0 = no effect, 1 = maximum avoidance)"
            persistent-hint
          >
            <template #append>
              <v-text-field
                :model-value="config.defaultDecay || 0.8"
                @update:model-value="updateDefaultDecay"
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

        <!-- Interference Groups -->
        <div class="interference-groups-section">
          <div class="d-flex align-center mb-2">
            <h4 class="text-subtitle-1">Interference Groups</h4>
            <v-spacer></v-spacer>
            <v-btn size="small" color="primary" @click="addInterferenceGroup">
              <v-icon start>mdi-plus</v-icon>
              Add Group
            </v-btn>
          </div>

          <v-alert v-if="config.interferenceSets.length === 0" type="info" density="compact">
            No interference groups defined. Click "Add Group" to create a set of tags that interfere with each other.
          </v-alert>

          <!-- Interference Groups List -->
          <v-card
            v-for="(group, idx) in config.interferenceSets"
            :key="idx"
            variant="outlined"
            class="mb-3 pa-3"
          >
            <div class="d-flex align-center mb-2">
              <h5 class="text-subtitle-2">Group {{ idx + 1 }}</h5>
              <v-spacer></v-spacer>
              <v-btn icon size="small" color="error" @click="removeInterferenceGroup(idx)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>

            <v-select
              :model-value="group.tags"
              @update:model-value="(tags) => updateGroupTags(idx, tags)"
              :items="availableTags"
              :loading="loadingTags"
              :disabled="loadingTags"
              label="Interfering Tags"
              hint="Tags that interfere with each other"
              persistent-hint
              multiple
              chips
              closable-chips
              density="compact"
              class="mb-3"
            ></v-select>

            <v-slider
              :model-value="group.decay !== undefined ? group.decay : config.defaultDecay || 0.8"
              @update:model-value="(val) => updateGroupDecay(idx, val)"
              label="Decay Strength"
              :min="0"
              :max="1"
              :step="0.05"
              thumb-label
              hint="How strongly these tags interfere (higher = stronger avoidance)"
              persistent-hint
            >
              <template #append>
                <v-text-field
                  :model-value="group.decay !== undefined ? group.decay : config.defaultDecay || 0.8"
                  @update:model-value="(val) => updateGroupDecay(idx, val)"
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
          </v-card>
        </div>
      </v-window-item>

      <!-- JSON Editor Mode -->
      <v-window-item value="json">
        <v-textarea
          :model-value="jsonText"
          @update:model-value="updateFromJson"
          label="Configuration JSON"
          rows="20"
          placeholder='{"interferenceSets": [{"tags": ["letter-b", "letter-d"], "decay": 0.9}], "maturityThreshold": {"minCount": 10}, "defaultDecay": 0.8, "delegateStrategy": "elo"}'
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

interface InterferenceGroup {
  tags: string[];
  decay?: number;
}

export interface InterferenceConfig {
  interferenceSets: InterferenceGroup[];
  maturityThreshold?: {
    minCount?: number;
    minElo?: number;
    minElapsedDays?: number;
  };
  defaultDecay?: number;
  delegateStrategy?: string;
}

export default defineComponent({
  name: 'InterferenceConfigForm',

  props: {
    modelValue: {
      type: Object as () => InterferenceConfig,
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

    function updateMinCount(value: string | number) {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        maturityThreshold: {
          ...config.value.maturityThreshold,
          minCount: numValue,
        },
      });
    }

    function updateMinElo(value: string | number) {
      if (value === '' || value === null || value === undefined) {
        const newThreshold = { ...config.value.maturityThreshold };
        delete newThreshold.minElo;
        emit('update:modelValue', {
          ...config.value,
          maturityThreshold: newThreshold,
        });
        return;
      }

      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        maturityThreshold: {
          ...config.value.maturityThreshold,
          minElo: numValue,
        },
      });
    }

    function updateMinElapsedDays(value: string | number) {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        maturityThreshold: {
          ...config.value.maturityThreshold,
          minElapsedDays: numValue,
        },
      });
    }

    function updateDefaultDecay(value: string | number) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return;

      emit('update:modelValue', {
        ...config.value,
        defaultDecay: Math.max(0, Math.min(1, numValue)),
      });
    }

    function addInterferenceGroup() {
      emit('update:modelValue', {
        ...config.value,
        interferenceSets: [
          ...config.value.interferenceSets,
          {
            tags: [],
            decay: config.value.defaultDecay || 0.8,
          },
        ],
      });
    }

    function removeInterferenceGroup(idx: number) {
      emit('update:modelValue', {
        ...config.value,
        interferenceSets: config.value.interferenceSets.filter((_, i) => i !== idx),
      });
    }

    function updateGroupTags(idx: number, tags: string[]) {
      const newSets = [...config.value.interferenceSets];
      newSets[idx] = {
        ...newSets[idx],
        tags,
      };
      emit('update:modelValue', {
        ...config.value,
        interferenceSets: newSets,
      });
    }

    function updateGroupDecay(idx: number, value: string | number) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return;

      const newSets = [...config.value.interferenceSets];
      newSets[idx] = {
        ...newSets[idx],
        decay: Math.max(0, Math.min(1, numValue)),
      };
      emit('update:modelValue', {
        ...config.value,
        interferenceSets: newSets,
      });
    }

    function updateFromJson(text: string) {
      jsonError.value = null;
      try {
        const parsed = JSON.parse(text);
        if (!parsed.interferenceSets || !Array.isArray(parsed.interferenceSets)) {
          throw new Error('Config must have "interferenceSets" array');
        }
        emit('update:modelValue', parsed);
      } catch (error) {
        jsonError.value = error instanceof Error ? error.message : 'Invalid JSON';
      }
    }

    function validateConfig() {
      validationError.value = null;
      try {
        if (!config.value.interferenceSets || !Array.isArray(config.value.interferenceSets)) {
          throw new Error('Interference sets must be an array');
        }

        for (const group of config.value.interferenceSets) {
          if (!Array.isArray(group.tags) || group.tags.length < 2) {
            throw new Error('Each interference group must have at least 2 tags');
          }
          if (group.decay !== undefined && (group.decay < 0 || group.decay > 1)) {
            throw new Error('Decay values must be between 0 and 1');
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
      jsonText,
      jsonError,
      validationError,
      updateDelegateStrategy,
      updateMinCount,
      updateMinElo,
      updateMinElapsedDays,
      updateDefaultDecay,
      addInterferenceGroup,
      removeInterferenceGroup,
      updateGroupTags,
      updateGroupDecay,
      updateFromJson,
    };
  },
});
</script>

<style scoped>
.interference-config-form {
  padding: 16px 0;
}

.maturity-section,
.interference-groups-section {
  margin-top: 16px;
}
</style>
