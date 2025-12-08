<template>
  <v-card :loading="loading">
    <v-card-title>
      <v-icon start>mdi-tune</v-icon>
      Learning Preferences
    </v-card-title>

    <v-card-subtitle v-if="courseId">
      Customize how content is presented in this course
    </v-card-subtitle>

    <v-card-text>
      <v-alert v-if="!courseId" type="info" variant="tonal" class="mb-4">
        Select a course to configure your learning preferences.
      </v-alert>

      <div v-else-if="!loading">
        <!-- Tag Preferences Section -->
        <div class="mb-6">
          <h3 class="text-subtitle-1 font-weight-bold mb-2">
            <v-icon start size="small">mdi-tune-variant</v-icon>
            Tag Preferences
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Adjust how much you want to see cards with specific tags. 0 = exclude, 1 = neutral, higher = prefer more.
          </p>

          <!-- Tag autocomplete -->
          <v-autocomplete
            v-model="tagToAdd"
            :items="availableTagsToAdd"
            item-title="name"
            item-value="name"
            label="Add tag preference"
            placeholder="Search tags..."
            density="compact"
            variant="outlined"
            clearable
            hide-details
            class="mb-4"
            @update:model-value="addTag"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props">
                <template #subtitle>
                  {{ item.raw.snippet }}
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>

          <!-- Tag slider list -->
          <v-list v-if="tagNames.length > 0" class="mt-4">
            <v-list-item
              v-for="tagName in tagNames"
              :key="tagName"
              class="px-0"
            >
              <template #default>
                <div class="d-flex align-center ga-3 w-100">
                  <!-- Tag name -->
                  <v-chip
                    size="small"
                    variant="tonal"
                    class="flex-shrink-0"
                    style="min-width: 120px;"
                  >
                    {{ tagName }}
                  </v-chip>

                  <!-- Slider -->
                  <v-slider
                    :model-value="preferences.boost[tagName]"
                    :min="sliderConfigResolved.min"
                    :max="globalSliderMax"
                    :step="0.01"
                    hide-details
                    class="flex-grow-1"
                    thumb-label
                    @update:model-value="(val: number) => updateBoost(tagName, val)"
                  >
                    <template #thumb-label="{ modelValue }">
                      {{ formatMultiplier(modelValue) }}
                    </template>
                  </v-slider>

                  <!-- Current value display -->
                  <span class="text-body-2 flex-shrink-0" style="min-width: 60px; text-align: right;">
                    {{ formatMultiplier(preferences.boost[tagName]) }}
                  </span>

                  <!-- Expand range button (always visible) -->
                  <v-btn
                    icon="mdi-plus"
                    size="small"
                    variant="text"
                    density="compact"
                    :disabled="globalSliderMax >= sliderConfigResolved.absoluteMax"
                    @click="expandSliderRange(tagName)"
                  />

                  <!-- Delete button -->
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    density="compact"
                    @click="removeTag(tagName)"
                  />
                </div>
              </template>
            </v-list-item>
          </v-list>

          <v-alert v-else type="info" variant="tonal" class="mt-4">
            No tag preferences configured yet. Add tags above to get started.
          </v-alert>
        </div>

        <!-- Status / Feedback -->
        <v-alert v-if="saveError" type="error" variant="tonal" class="mt-4" closable @click:close="saveError = ''">
          {{ saveError }}
        </v-alert>

        <v-alert v-if="saveSuccess" type="success" variant="tonal" class="mt-4" closable @click:close="saveSuccess = false">
          Preferences saved successfully
        </v-alert>
      </div>

      <div v-else class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>
    </v-card-text>

    <v-card-actions v-if="courseId && !loading">
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="!hasChanges"
        @click="resetToSaved"
      >
        Reset
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="saving"
        :disabled="!hasChanges"
        @click="savePreferences"
      >
        Save Preferences
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { getDataLayer, Tag, CourseDBInterface, UserDBInterface } from '@vue-skuilder/db';
import { getCurrentUser } from '../stores/useAuthStore';

/**
 * User's tag preference state, matching the backend schema.
 */
interface UserTagPreferenceState {
  boost: Record<string, number>;
  updatedAt: string;
}

/**
 * Slider configuration for tag preferences.
 */
interface SliderConfig {
  min?: number;        // default: 0
  startingMax?: number; // default: 2
  absoluteMax?: number; // default: 10
}

const DEFAULT_SLIDER_CONFIG: Required<SliderConfig> = {
  min: 0,
  startingMax: 2,
  absoluteMax: 10,
};

const STRATEGY_KEY = 'UserTagPreferenceFilter';

export default defineComponent({
  name: 'UserTagPreferences',

  props: {
    /**
     * Course ID to configure preferences for.
     * If not provided, component shows a prompt to select a course.
     */
    courseId: {
      type: String as PropType<string>,
      required: false,
      default: '',
    },

    /**
     * Slider configuration (min, startingMax, absoluteMax).
     * All fields optional, defaults: { min: 0, startingMax: 2, absoluteMax: 10 }
     */
    sliderConfig: {
      type: Object as PropType<SliderConfig>,
      required: false,
      default: () => ({}),
    },
  },

  emits: ['preferences-saved', 'preferences-changed'],

  data() {
    return {
      loading: true,
      saving: false,
      saveError: '',
      saveSuccess: false,

      // Current working state
      preferences: {
        boost: {} as Record<string, number>,
      },

      // Saved state for comparison
      savedPreferences: {
        boost: {} as Record<string, number>,
      },

      // Per-tag current max range (for dynamic expansion)
      tagMaxRanges: {} as Record<string, number>,

      // Available tags from course
      availableTags: [] as Tag[],

      // Autocomplete model
      tagToAdd: null as string | null,

      // DB references
      courseDB: null as CourseDBInterface | null,
      user: null as UserDBInterface | null,
    };
  },

  computed: {
    /**
     * Resolved slider config with defaults
     */
    sliderConfigResolved(): Required<SliderConfig> {
      return {
        min: this.sliderConfig.min ?? DEFAULT_SLIDER_CONFIG.min,
        startingMax: this.sliderConfig.startingMax ?? DEFAULT_SLIDER_CONFIG.startingMax,
        absoluteMax: this.sliderConfig.absoluteMax ?? DEFAULT_SLIDER_CONFIG.absoluteMax,
      };
    },

    /**
     * List of tag names that have preferences (sorted alphabetically)
     */
    tagNames(): string[] {
      return Object.keys(this.preferences.boost).sort();
    },

    /**
     * Global max for all sliders (highest tagMaxRanges value)
     * Ensures all sliders have the same visual scale
     */
    globalSliderMax(): number {
      const maxValues = Object.values(this.tagMaxRanges);
      if (maxValues.length === 0) {
        return this.sliderConfigResolved.startingMax;
      }
      return Math.max(...maxValues);
    },

    /**
     * Tags available to add (not already in preferences)
     */
    availableTagsToAdd(): Tag[] {
      const usedTags = new Set(Object.keys(this.preferences.boost));
      return this.availableTags.filter((t) => !usedTags.has(t.name));
    },

    /**
     * Check if current preferences differ from saved state
     */
    hasChanges(): boolean {
      const currentTags = Object.keys(this.preferences.boost).sort();
      const savedTags = Object.keys(this.savedPreferences.boost).sort();

      if (currentTags.length !== savedTags.length) {
        return true;
      }

      if (currentTags.join(',') !== savedTags.join(',')) {
        return true;
      }

      return currentTags.some(
        (tag) => this.preferences.boost[tag] !== this.savedPreferences.boost[tag]
      );
    },
  },

  watch: {
    courseId: {
      immediate: true,
      async handler(newCourseId: string) {
        if (newCourseId) {
          await this.loadPreferences();
        } else {
          this.loading = false;
        }
      },
    },
  },

  methods: {
    /**
     * Load preferences from strategy state and available tags from course
     */
    async loadPreferences() {
      this.loading = true;
      this.saveError = '';

      try {
        // Get user and course DB
        this.user = (await getCurrentUser()) ?? null;
        if (!this.user) {
          throw new Error('User not available');
        }

        this.courseDB = getDataLayer().getCourseDB(this.courseId);

        // Load available tags
        const tagStubs = await this.courseDB.getCourseTagStubs();
        this.availableTags = tagStubs.rows.map((r) => r.doc!).filter(Boolean);

        // Load saved preferences
        const state = await this.user.getStrategyState<UserTagPreferenceState>(
          this.courseId,
          STRATEGY_KEY
        );

        if (state) {
          this.preferences.boost = { ...state.boost };
        } else {
          // No preferences yet - start fresh
          this.preferences.boost = {};
        }

        // Store saved state for comparison
        this.savedPreferences.boost = { ...this.preferences.boost };

        // Initialize tag max ranges, auto-expanding if saved value exceeds startingMax
        this.tagMaxRanges = {};
        Object.keys(this.preferences.boost).forEach((tag) => {
          const savedValue = this.preferences.boost[tag];
          const startingMax = this.sliderConfigResolved.startingMax;

          // If saved value exceeds startingMax, expand range to accommodate it
          // (capped at absoluteMax)
          if (savedValue > startingMax) {
            this.tagMaxRanges[tag] = Math.min(
              Math.ceil(savedValue),
              this.sliderConfigResolved.absoluteMax
            );
          } else {
            this.tagMaxRanges[tag] = startingMax;
          }
        });
      } catch (e) {
        console.error('Failed to load preferences:', e);
        this.saveError = 'Failed to load preferences. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Add a tag to preferences with default multiplier of 1.0
     */
    addTag(tagName: string | null) {
      if (tagName && !(tagName in this.preferences.boost)) {
        this.preferences.boost[tagName] = 1.0;
        this.tagMaxRanges[tagName] = this.sliderConfigResolved.startingMax;
        this.$emit('preferences-changed', this.preferences);
      }
      // Clear the autocomplete
      this.$nextTick(() => {
        this.tagToAdd = null;
      });
    },

    /**
     * Remove a tag from preferences
     */
    removeTag(tagName: string) {
      delete this.preferences.boost[tagName];
      delete this.tagMaxRanges[tagName];
      this.$emit('preferences-changed', this.preferences);
    },

    /**
     * Update boost multiplier for a tag
     */
    updateBoost(tagName: string, value: number) {
      this.preferences.boost[tagName] = value;
      this.$emit('preferences-changed', this.preferences);
    },

    /**
     * Expand the global slider range by 1 and move the triggering tag's slider to new max
     */
    expandSliderRange(tagName: string) {
      const currentGlobalMax = this.globalSliderMax;
      if (currentGlobalMax < this.sliderConfigResolved.absoluteMax) {
        const newGlobalMax = currentGlobalMax + 1;

        // Expand all tag ranges to the new global max
        // (ensures all sliders stay synchronized)
        Object.keys(this.tagMaxRanges).forEach((tag) => {
          this.tagMaxRanges[tag] = Math.max(this.tagMaxRanges[tag], newGlobalMax);
        });

        // Move the triggering tag's slider to new max
        this.preferences.boost[tagName] = newGlobalMax;
        this.$emit('preferences-changed', this.preferences);
      }
    },

    /**
     * Format multiplier for display
     */
    formatMultiplier(value: number): string {
      if (value === 0) {
        return '0x';
      }
      if (value < 0.1) {
        return value.toFixed(2) + 'x';
      }
      return value.toFixed(1) + 'x';
    },

    /**
     * Reset to last saved state
     */
    resetToSaved() {
      this.preferences.boost = { ...this.savedPreferences.boost };
      this.saveSuccess = false;
      this.saveError = '';

      // Reset tag max ranges, auto-expanding if saved value exceeds startingMax
      this.tagMaxRanges = {};
      Object.keys(this.preferences.boost).forEach((tag) => {
        const savedValue = this.preferences.boost[tag];
        const startingMax = this.sliderConfigResolved.startingMax;

        if (savedValue > startingMax) {
          this.tagMaxRanges[tag] = Math.min(
            Math.ceil(savedValue),
            this.sliderConfigResolved.absoluteMax
          );
        } else {
          this.tagMaxRanges[tag] = startingMax;
        }
      });
    },

    /**
     * Save preferences to strategy state
     */
    async savePreferences() {
      if (!this.user || !this.courseId) {
        this.saveError = 'Unable to save - user or course not available';
        return;
      }

      this.saving = true;
      this.saveError = '';
      this.saveSuccess = false;

      try {
        const state: UserTagPreferenceState = {
          boost: { ...this.preferences.boost },
          updatedAt: new Date().toISOString(),
        };

        await this.user.putStrategyState<UserTagPreferenceState>(
          this.courseId,
          STRATEGY_KEY,
          state
        );

        // Update saved state
        this.savedPreferences.boost = { ...this.preferences.boost };

        this.saveSuccess = true;
        this.$emit('preferences-saved', state);
      } catch (e) {
        console.error('Failed to save preferences:', e);
        this.saveError = 'Failed to save preferences. Please try again.';
      } finally {
        this.saving = false;
      }
    },
  },
});
</script>

<style scoped>
/* Additional styles if needed */
</style>
