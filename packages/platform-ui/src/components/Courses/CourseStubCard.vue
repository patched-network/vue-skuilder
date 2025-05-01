<template>
  <v-card v-if="!updatePending && courseConfig" data-cy="available-course-card">
    <v-card-item>
      <v-card-title data-cy="course-title">
        {{ courseConfig.name }}
        <v-icon v-if="isPrivate" icon="mdi-eye-off" class="ml-2"></v-icon>
      </v-card-title>
    </v-card-item>

    <v-card-text>
      Questions: {{ questionCount }}
      <p>{{ courseConfig.description }}</p>
    </v-card-text>

    <v-card-actions>
      <v-btn color="primary" @click="navigateToInfo">More Info</v-btn>
      <v-btn data-cy="register-course-button" :loading="addingCourse" color="primary" @click="registerForCourse">
        Register
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { getCurrentUser } from '@vue-skuilder/common-ui';
import { CourseConfig, log } from '@vue-skuilder/common';
import { getDataLayer } from '@vue-skuilder/db';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CourseStubCard',

  props: {
    courseId: {
      type: String,
      required: true,
    },
  },
  emits: ['refresh'],

  data() {
    return {
      courseConfig: null as CourseConfig | null,
      questionCount: 0,
      isPrivate: false,
      updatePending: true,
      addingCourse: false,
    };
  },

  async created() {
    try {
      const db = getDataLayer().getCourseDB(this.courseId);
      this.courseConfig = (await db.getCourseConfig())!;
      this.isPrivate = !this.courseConfig.public;
      this.questionCount = (await db.getCourseInfo()).cardCount;
      this.updatePending = false;
    } catch (e) {
      console.error(`Error loading course ${this.courseId}: ${e}`);
    }
  },

  methods: {
    async registerForCourse() {
      this.addingCourse = true;
      log(`Attempting to register for ${this.courseId}.`);
      await (await getCurrentUser()).registerForCourse(this.courseId);
      this.$emit('refresh');
    },
    navigateToInfo() {
      const path = `/q/${this.courseConfig?.name.replaceAll(' ', '_')}`;
      this.$router.push(path);
    },
  },
});
</script>
