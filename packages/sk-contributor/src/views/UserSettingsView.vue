<template>
  <v-container>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-3">mdi-cog</v-icon>
        User Settings
      </v-card-title>
      
      <v-card-text>
        <div v-if="loading">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          Loading settings...
        </div>
        
        <div v-else>
          <!-- Study Preferences -->
          <v-card variant="outlined" class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start>mdi-clock-outline</v-icon>
              Study Preferences
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-slider
                    v-model="sessionTimeLimit"
                    label="Session Time Limit (minutes)"
                    :min="1"
                    :max="30"
                    :step="1"
                    thumb-label="always"
                    @update:model-value="updateSessionTimeLimit"
                  >
                    <template #append>
                      <v-text-field
                        v-model="sessionTimeLimit"
                        type="number"
                        style="width: 80px"
                        density="compact"
                        hide-details
                        variant="outlined"
                        :min="1"
                        :max="30"
                        @update:model-value="updateSessionTimeLimit"
                      />
                    </template>
                  </v-slider>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Interface Options -->
          <v-card variant="outlined" class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start>mdi-palette-outline</v-icon>
              Interface Options
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="darkMode"
                    label="Dark Mode"
                    color="primary"
                    @update:model-value="updateDarkMode"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="likesConfetti"
                    label="Enable Confetti"
                    color="primary"
                    @update:model-value="updateConfetti"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Account Actions -->
          <v-card variant="outlined">
            <v-card-title class="text-h6">
              <v-icon start>mdi-account-outline</v-icon>
              Account Management
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12">
                  <v-btn
                    variant="outlined"
                    color="warning"
                    @click="resetToDefaults"
                  >
                    <v-icon start>mdi-restore</v-icon>
                    Reset to Defaults
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-btn variant="outlined" @click="$router.back()">
          <v-icon start>mdi-arrow-left</v-icon>
          Back
        </v-btn>
        <v-spacer />
        <v-btn variant="text" color="success" v-if="!loading">
          <v-icon start>mdi-check</v-icon>
          Settings Saved
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useConfigStore } from '@vue-skuilder/common-ui';

const loading = ref(true);
const configStore = useConfigStore();

// Reactive references to config values
const sessionTimeLimit = ref(5);
const darkMode = ref(false);
const likesConfetti = ref(false);

// Update methods
const updateSessionTimeLimit = async (value: number) => {
  sessionTimeLimit.value = value;
  await configStore.updateSessionTimeLimit(value);
};

const updateDarkMode = async (value: boolean) => {
  darkMode.value = value;
  await configStore.updateDarkMode(value);
};

const updateConfetti = async (value: boolean) => {
  likesConfetti.value = value;
  await configStore.updateLikesConfetti(value);
};

const resetToDefaults = async () => {
  configStore.resetDefaults();
  await configStore.updateSessionTimeLimit(5);
  await configStore.updateDarkMode(false);
  await configStore.updateLikesConfetti(false);
  
  // Update local refs
  sessionTimeLimit.value = 5;
  darkMode.value = false;
  likesConfetti.value = false;
};

// Load current settings on mount
onMounted(async () => {
  try {
    await configStore.hydrate();
    
    // Update local refs with current config
    sessionTimeLimit.value = configStore.config.sessionTimeLimit;
    darkMode.value = configStore.config.darkMode;
    likesConfetti.value = configStore.config.likesConfetti;
  } catch (error) {
    console.error('Error loading user settings:', error);
  } finally {
    loading.value = false;
  }
});
</script>