<template>
  <v-card v-if="!updatePending && courseConfig" data-cy="available-course-card">
    <v-card-item>
      <v-card-title data-cy="course-title" @click="routeToCourse">
        {{ courseConfig.name }}
        <v-icon v-if="isPrivate" icon="mdi-eye-off" class="ml-2"></v-icon>
      </v-card-title>
    </v-card-item>

    <v-card-text>
      Questions: {{ questionCount }}
      <p>{{ courseConfig.description }}</p>
    </v-card-text>

    <v-card-actions>
      <router-link :to="`/q/${courseConfig.name.replaceAll(' ', '_')}`" style="text-decoration: none">
        <v-btn color="primary">More Info</v-btn>
      </router-link>
      <v-btn data-cy="register-course-button" :loading="addingCourse" color="primary" @click="registerForCourse">
        Register
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { log } from '@vue-skuilder/common';
import { getDataLayer } from '@vue-skuilder/db';
import { CourseConfig } from '@vue-skuilder/common';
import { useRouter } from 'vue-router';
import { getCurrentUser } from '@/stores/useAuthStore';

export default defineComponent({
  name: 'CourseStubCard',

  props: {
    _id: {
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
      const db = getDataLayer().getCourseDB(this._id);
      this.courseConfig = (await db.getCourseConfig())!;
      this.isPrivate = !this.courseConfig.public;
      this.questionCount = (await db.getCourseInfo()).cardCount;
      this.updatePending = false;
    } catch (e) {
      console.error(`Error loading course ${this._id}: ${e}`);
    }
  },

  methods: {
    async registerForCourse() {
      this.addingCourse = true;
      log(`Attempting to register for ${this._id}.`);
      await (await getCurrentUser()).registerForCourse(this._id);
      this.$emit('refresh');
    },
  },
});
</script>
