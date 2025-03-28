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
      <v-btn color="primary" @click="routeToCourse">More Info</v-btn>
      <v-btn data-cy="register-course-button" :loading="addingCourse" color="primary" @click="registerForCourse">
        Register
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { log } from '@vue-skuilder/common';
import { getCourseDB } from '@vue-skuilder/db';
import { getCourseConfig } from '@vue-skuilder/db';
import { DocType } from '@vue-skuilder/db';
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
      const db = await getCourseDB(this._id);
      this.courseConfig = (await getCourseConfig(this._id))!;
      this.isPrivate = !this.courseConfig.public;
      this.questionCount = (
        await db.find({
          limit: 1000,
          selector: {
            docType: DocType.CARD,
          },
        })
      ).docs.length;
      this.updatePending = false;
    } catch (e) {
      console.error(`Error loading course ${this._id}: ${e}`);
    }
  },

  methods: {
    routeToCourse() {
      useRouter().push(`/q/${this.courseConfig!.name.replace(' ', '_')}`);
    },

    async registerForCourse() {
      this.addingCourse = true;
      log(`Attempting to register for ${this._id}.`);
      await (await getCurrentUser()).registerForCourse(this._id);
      this.$emit('refresh');
    },
  },
});
</script>
