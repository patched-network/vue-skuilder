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
        <!-- Avoid Tags Section -->
        <div class="mb-6">
          <h3 class="text-subtitle-1 font-weight-bold mb-2">
            <v-icon start size="small">mdi-eye-off</v-icon>
            Avoid These Topics
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Cards with these tags won't be shown during study sessions.
          </p>

          <v-chip-group column>
            <v-chip
              v-for="tag in preferences.avoid"
              :key="`avoid-${tag}`"
              closable
              color="error"
              variant="tonal"
              @click:close="removeAvoidTag(tag)"
            >
              {{ tag }}
            </v-chip>
          </v-chip-group>

          <v-autocomplete
            v-model="tagToAvoid"
            :items="availableTagsForAvoid"
            item-title="name"
            item-value="name"
            label="Add tag to avoid"
            placeholder="Search tags..."
            density="compact"
            variant="outlined"
            clearable
            hide-details
            class="mt-2"
            @update:model-value="addAvoidTag"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props">
                <template #subtitle>
                  {{ item.raw.snippet }}
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
        </div>

        <v-divider class="my-4" />

        <!-- Prefer Tags Section -->
        <div class="mb-6">
          <h3 class="text-subtitle-1 font-weight-bold mb-2">
            <v-icon start size="small">mdi-star</v-icon>
            Prefer These Topics
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Cards with these tags will be prioritized during study sessions.
          </p>

          <v-chip-group column>
            <v-chip
              v-for="tag in preferences.prefer"
              :key="`prefer-${tag}`"
              closable
              color="success"
              variant="tonal"
              @click:close="removePreferTag(tag)"
            >
              {{ tag }}
              <template #append>
                <v-tooltip location="top">
                  <template #activator="{ props }">
                    <span v-bind="props" class="ml-1 text-caption">
                      {{ formatBoost(preferences.boost[tag]) }}
                    </span>
                  </template>
                  Boost multiplier
                </v-tooltip>
              </template>
            </v-chip>
          </v-chip-group>

          <v-autocomplete
            v-model="tagToPrefer"
            :items="availableTagsForPrefer"
            item-title="name"
            item-value="name"
            label="Add tag to prefer"
            placeholder="Search tags..."
            density="compact"
            variant="outlined"
            clearable
            hide-details
            class="mt-2"
            @update:model-value="addPreferTag"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props">
                <template #subtitle>
                  {{ item.raw.snippet }}
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
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
  prefer: string[];
  avoid: string[];
  boost: Record<string, number>;
  updatedAt: string;
}

const DEFAULT_BOOST = 1.5;
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
        prefer: [] as string[],
        avoid: [] as string[],
        boost: {} as Record<string, number>,
      },

      // Saved state for comparison
      savedPreferences: {
        prefer: [] as string[],
        avoid: [] as string[],
        boost: {} as Record<string, number>,
      },

      // Available tags from course
      availableTags: [] as Tag[],

      // Autocomplete models
      tagToAvoid: null as string | null,
      tagToPrefer: null as string | null,

      // DB references
      courseDB: null as CourseDBInterface | null,
      user: null as UserDBInterface | null,
    };
  },

  computed: {
    /**
     * Tags available to add to "avoid" list (not already avoided or preferred)
     */
    availableTagsForAvoid(): Tag[] {
      const usedTags = new Set([...this.preferences.avoid, ...this.preferences.prefer]);
      return this.availableTags.filter((t) => !usedTags.has(t.name));
    },

    /**
     * Tags available to add to "prefer" list (not already avoided or preferred)
     */
    availableTagsForPrefer(): Tag[] {
      const usedTags = new Set([...this.preferences.avoid, ...this.preferences.prefer]);
      return this.availableTags.filter((t) => !usedTags.has(t.name));
    },

    /**
     * Check if current preferences differ from saved state
     */
    hasChanges(): boolean {
      const currentAvoid = [...this.preferences.avoid].sort().join(',');
      const savedAvoid = [...this.savedPreferences.avoid].sort().join(',');
      const currentPrefer = [...this.preferences.prefer].sort().join(',');
      const savedPrefer = [...this.savedPreferences.prefer].sort().join(',');

      return currentAvoid !== savedAvoid || currentPrefer !== savedPrefer;
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
          this.preferences.prefer = [...state.prefer];
          this.preferences.avoid = [...state.avoid];
          this.preferences.boost = { ...state.boost };
        } else {
          // No preferences yet - start fresh
          this.preferences.prefer = [];
          this.preferences.avoid = [];
          this.preferences.boost = {};
        }

        // Store saved state for comparison
        this.savedPreferences.prefer = [...this.preferences.prefer];
        this.savedPreferences.avoid = [...this.preferences.avoid];
        this.savedPreferences.boost = { ...this.preferences.boost };
      } catch (e) {
        console.error('Failed to load preferences:', e);
        this.saveError = 'Failed to load preferences. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Add a tag to the avoid list
     */
    addAvoidTag(tagName: string | null) {
      if (tagName && !this.preferences.avoid.includes(tagName)) {
        this.preferences.avoid.push(tagName);
        this.$emit('preferences-changed', this.preferences);
      }
      // Clear the autocomplete
      this.$nextTick(() => {
        this.tagToAvoid = null;
      });
    },

    /**
     * Remove a tag from the avoid list
     */
    removeAvoidTag(tagName: string) {
      const index = this.preferences.avoid.indexOf(tagName);
      if (index > -1) {
        this.preferences.avoid.splice(index, 1);
        this.$emit('preferences-changed', this.preferences);
      }
    },

    /**
     * Add a tag to the prefer list
     */
    addPreferTag(tagName: string | null) {
      if (tagName && !this.preferences.prefer.includes(tagName)) {
        this.preferences.prefer.push(tagName);
        // Set default boost
        this.preferences.boost[tagName] = DEFAULT_BOOST;
        this.$emit('preferences-changed', this.preferences);
      }
      // Clear the autocomplete
      this.$nextTick(() => {
        this.tagToPrefer = null;
      });
    },

    /**
     * Remove a tag from the prefer list
     */
    removePreferTag(tagName: string) {
      const index = this.preferences.prefer.indexOf(tagName);
      if (index > -1) {
        this.preferences.prefer.splice(index, 1);
        delete this.preferences.boost[tagName];
        this.$emit('preferences-changed', this.preferences);
      }
    },

    /**
     * Format boost multiplier for display
     */
    formatBoost(boost: number | undefined): string {
      const value = boost ?? DEFAULT_BOOST;
      return `${value.toFixed(1)}x`;
    },

    /**
     * Reset to last saved state
     */
    resetToSaved() {
      this.preferences.prefer = [...this.savedPreferences.prefer];
      this.preferences.avoid = [...this.savedPreferences.avoid];
      this.preferences.boost = { ...this.savedPreferences.boost };
      this.saveSuccess = false;
      this.saveError = '';
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
          prefer: [...this.preferences.prefer],
          avoid: [...this.preferences.avoid],
          boost: { ...this.preferences.boost },
          updatedAt: new Date().toISOString(),
        };

        await this.user.putStrategyState<UserTagPreferenceState>(
          this.courseId,
          STRATEGY_KEY,
          state
        );

        // Update saved state
        this.savedPreferences.prefer = [...this.preferences.prefer];
        this.savedPreferences.avoid = [...this.preferences.avoid];
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
