<template>
  <v-container>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-3">mdi-cog</v-icon>
        User Settings
      </v-card-title>
      
      <v-card-text>
        <v-alert type="info" class="mb-4">
          <v-icon start>mdi-information</v-icon>
          Settings panel is coming soon! This will allow you to customize your learning experience.
        </v-alert>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-h6">Study Preferences</v-card-title>
              <v-card-text>
                <p class="text-body-2">Configure session length, difficulty settings, and review scheduling.</p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-h6">Interface Options</v-card-title>
              <v-card-text>
                <p class="text-body-2">Customize theme, keyboard shortcuts, and display preferences.</p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-title class="text-h6">Account Management</v-card-title>
              <v-card-text>
                <p class="text-body-2">Manage your profile information and data privacy settings.</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
      
      <v-card-actions>
        <v-btn variant="outlined" @click="$router.back()">
          <v-icon start>mdi-arrow-left</v-icon>
          Back
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
// Placeholder for user settings view
</script>