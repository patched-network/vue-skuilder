<template>
  <v-container>
    <v-row>
      <v-col cols="12" class="text-center">
        <h1 class="text-h3 mb-6">{{ courseConfig.title }}</h1>
        <p class="text-body-1 mb-6">{{ courseConfig.description }}</p>

        <div v-if="isLoggedIn">
          <v-btn color="primary" size="large" to="/study"> Start Learning </v-btn>
        </div>
        <div v-else class="d-flex flex-column align-center">
          <p class="text-body-1 mb-4">Please login to start learning</p>
          <UserLoginAndRegistrationContainer v-model="authDialogOpen" redirect-to-path="/study">
            <template #activator="{ props }">
              <v-btn color="primary" size="large" v-bind="props"> Login / Sign Up </v-btn>
            </template>
          </UserLoginAndRegistrationContainer>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useCourseConfig } from '../composables/useCourseConfig';
import { UserLoginAndRegistrationContainer, useAuthStore } from '@vue-skuilder/common-ui';
import { getDataLayer } from '@vue-skuilder/db';

const { courseConfig } = useCourseConfig();
const authStore = useAuthStore();
const authDialogOpen = ref(false);

const isLoggedIn = computed(() => authStore.isLoggedIn);
</script>
