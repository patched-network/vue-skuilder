<template>
  <div class="text-subtitle-1">
    <v-alert v-if="isNewUser" type="success" class="text-subtitle-1" variant="tonal" :prepend-icon="'mdi-check'">
      Welcome, {{ username }}! Please take a moment to look through these settings:
    </v-alert>

    <h1 class="text-h3">Account Settings</h1>
    <h2 class="text-h4">General:</h2>

    <v-checkbox
      v-model="configStore.config.likesConfetti"
      label="I like confetti"
      @update:model-value="updateConfetti"
    />
    <v-checkbox v-model="configStore.config.darkMode" label="I like the dark" @update:model-value="updateDark" />
    <!-- <h2 class="text-h4">Languages:</h2>
    I am near-fluent or better in the following languages:
    {{ selectedLanguages.toString() }}
    <v-checkbox
      v-for="(language, i) in configLanguages"
      :key="i"
      :label="language.name"
      :value="language.code"
      v-model="selectedLanguages"
      @update:model-value="updateLanguage"
    /> -->

    <v-divider class="my-6" />

    <h2 class="text-h4 mb-4">Learning Preferences:</h2>
    <p class="text-body-2 text-medium-emphasis mb-4">Customize how content is presented in your registered courses.</p>

    <v-select
      v-model="selectedCourseId"
      :items="registeredCourses"
      item-title="name"
      item-value="courseID"
      label="Select a course"
      variant="outlined"
      density="comfortable"
      class="mb-4"
      style="max-width: 400px"
    >
      <template #item="{ props, item }">
        <v-list-item v-bind="props">
          <template #subtitle>
            {{ item.raw.courseID }}
          </template>
        </v-list-item>
      </template>
    </v-select>

    <user-tag-preferences
      v-if="selectedCourseId"
      :course-id="selectedCourseId"
      @preferences-saved="onPreferencesSaved"
    />
  </div>
</template>

<script lang="ts">
import { getCurrentUser, useConfigStore, UserTagPreferences } from '@vue-skuilder/common-ui';
import { UserDBInterface, getDataLayer } from '@vue-skuilder/db';
import { CourseConfig } from '@vue-skuilder/common';
import confetti from 'canvas-confetti';
import { defineComponent, PropType } from 'vue';
import { useRoute } from 'vue-router';

interface Language {
  name: string;
  code: string;
}

export default defineComponent({
  name: 'UserSettings',

  components: {
    UserTagPreferences,
  },

  props: {
    username: {
      type: String as PropType<string>,
      required: true,
    },
  },

  setup() {
    const configStore = useConfigStore();
    const route = useRoute();

    const darkMode = configStore.config.darkMode;
    const likesConfetti = configStore.config.likesConfetti;

    const isNewUser = route.path.endsWith('new');

    return { configStore, darkMode, likesConfetti, route, isNewUser };
  },

  data() {
    return {
      u: {} as UserDBInterface,
      configLanguages: [
        {
          name: 'English',
          code: 'en',
        },
        {
          name: 'French',
          code: 'fr',
        },
      ] as Language[],
      selectedLanguages: [] as string[],
      registeredCourses: [] as CourseConfig[],
      selectedCourseId: '' as string,
    };
  },

  async created() {
    this.u = await getCurrentUser();
    this.configLanguages.forEach((l) => {
      console.log(`afweatifvwzeatfvwzeta` + l.name);
    });

    // Load registered courses for preferences selector
    await this.loadRegisteredCourses();
  },

  methods: {
    updateDark(): void {
      this.configStore.updateDarkMode(this.configStore.config.darkMode);
    },

    updateConfetti(): void {
      this.configStore.updateLikesConfetti(this.configStore.config.likesConfetti);

      if (this.configStore.config.likesConfetti) {
        confetti({
          origin: {
            x: 0.5,
            y: 1,
          },
        });
      }
    },

    async loadRegisteredCourses(): Promise<void> {
      try {
        const activeCourses = await this.u.getActiveCourses();
        const dataLayer = getDataLayer();

        // Fetch course configs for display names
        const courseConfigs = await Promise.all(
          activeCourses.map(async (reg) => {
            try {
              const courseDB = dataLayer.getCourseDB(reg.courseID);
              return await courseDB.getCourseConfig();
            } catch {
              // Return minimal config if fetch fails
              return { courseID: reg.courseID, name: reg.courseID } as CourseConfig;
            }
          })
        );

        this.registeredCourses = courseConfigs.filter(Boolean);
      } catch (e) {
        console.error('Failed to load registered courses:', e);
      }
    },

    onPreferencesSaved(): void {
      // Could show a snackbar or other feedback here
      console.log('Preferences saved for course:', this.selectedCourseId);
    },
  },
});
</script>

<style scoped></style>
