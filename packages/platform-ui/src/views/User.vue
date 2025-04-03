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
  </div>
</template>

<script lang="ts">
import confetti from 'canvas-confetti';
import { defineComponent, PropType } from 'vue';
import { User } from '@vue-skuilder/db';
import { useConfigStore } from '@/stores/useConfigStore';
import { getCurrentUser } from '@/stores/useAuthStore';
import { useRoute } from 'vue-router';

interface Language {
  name: string;
  code: string;
}

export default defineComponent({
  name: 'UserSettings',

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
      u: {} as User,
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
    };
  },

  async created() {
    this.u = await getCurrentUser();
    this.configLanguages.forEach((l) => {
      console.log(`afweatifvwzeatfvwzeta` + l.name);
    });
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
  },
});
</script>

<style scoped></style>
