<template>
  <div v-if="!updatePending">
    <h1 class="text-h4 mb-2"><router-link to="/q">Quilts</router-link> / {{ courseConfig.name }}</h1>

    <p class="text-body-2">
      {{ courseConfig.description }}
    </p>

    <transition name="component-fade" mode="out-in">
      <div v-if="userIsRegistered">
        <router-link :to="`/study/${courseId}`" class="me-2">
          <v-btn color="success">Start a study session</v-btn>
        </router-link>
        <router-link :to="`/edit/${courseId}`" class="me-2">
          <v-btn data-cy="add-content-btn" color="indigo-lighten-1">
            <v-icon start>mdi-plus</v-icon>
            Add content
          </v-btn>
        </router-link>
        <router-link :to="`/courses/${courseId}/elo`" class="me-2">
          <v-btn color="green-darken-2" title="Rank course content for difficulty">
            <v-icon start>mdi-format-list-numbered</v-icon>
            Arrange
          </v-btn>
        </router-link>
        <v-btn color="error" size="small" variant="outlined" @click="drop"> Drop this course </v-btn>
      </div>
      <div v-else>
        <v-btn data-cy="register-btn" color="primary" class="me-2" @click="register">Register</v-btn>
        <router-link :to="`/q/${courseId}/preview`">
          <v-btn variant="outlined" color="primary" class="me-2">Start a trial study session</v-btn>
        </router-link>
      </div>
    </transition>
    <midi-config v-if="isPianoCourse" :_id="courseId" :user="user" class="my-3" />

    <v-card class="my-2">
      <v-toolbar density="compact">
        <v-toolbar-title>Tags</v-toolbar-title>
        <v-toolbar-items>
          <v-btn variant="text">({{ tags.length }})</v-btn>
        </v-toolbar-items>
      </v-toolbar>
      <v-card-text>
        <span v-for="(tag, i) in tags" :key="i">
          <router-link :to="`/q/${courseId}/tags/${tag.name}`">
            <v-chip variant="tonal" class="me-2 mb-2">
              {{ tag.name }}
            </v-chip>
          </router-link>
        </span>
      </v-card-text>
    </v-card>

    <course-card-browser class="my-3" :course-id="courseId" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { MidiConfig } from '@vue-skuilder/courses';
import CourseCardBrowser from './CourseCardBrowser.vue';
import { log } from '@vue-skuilder/common';
import { CourseDBInterface, Tag, UserDBInterface, getDataLayer } from '@vue-skuilder/db';
import { CourseConfig } from '@vue-skuilder/common';
import { getCurrentUser } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'CourseInformation',

  components: {
    MidiConfig,
    CourseCardBrowser,
  },

  props: {
    courseId: {
      type: String as PropType<string>,
      required: true,
    },
  },

  data() {
    return {
      courseDB: null as CourseDBInterface | null,
      nameRules: [
        (value: string): string | boolean => {
          const max = 30;
          return value.length > max ? `Course name must be ${max} characters or less` : true;
        },
      ],
      updatePending: true,
      courseConfig: {} as CourseConfig,
      userIsRegistered: false,
      tags: [] as Tag[],
      user: null as UserDBInterface | null,
    };
  },

  computed: {
    isPianoCourse(): boolean {
      return this.courseConfig.name.toLowerCase().includes('piano');
    },
  },

  async created() {
    this.courseDB = getDataLayer().getCourseDB(this.courseId);
    this.user = await getCurrentUser();

    const userCourses = await this.user.getCourseRegistrationsDoc();
    this.userIsRegistered =
      userCourses.courses.filter((c) => {
        return c.courseID === this.courseId && (c.status === 'active' || c.status === undefined);
      }).length === 1;

    this.courseConfig = (await this.courseDB!.getCourseConfig())!;
    this.tags = (await this.courseDB!.getCourseTagStubs()).rows.map((r) => r.doc!);
    this.updatePending = false;
  },

  methods: {
    async register() {
      log(`Registering for ${this.courseId}`);
      const res = await this.user!.registerForCourse(this.courseId);
      if (res.ok) {
        this.userIsRegistered = true;
      }
    },

    async drop() {
      log(`Dropping course ${this.courseId}`);
      const res = await this.user!.dropCourse(this.courseId);
      if (res.ok) {
        this.userIsRegistered = false;
      }
    },
  },
});
</script>

<style scoped>
.component-fade-enter-active,
.component-fade-leave-active {
  transition: opacity 0.5s ease;
}
.component-fade-enter,
.component-fade-leave-to {
  opacity: 0;
}

.component-scale-enter-active,
.component-scale-leave-active {
  max-height: auto;
  transform: scale(1, 1);
  transform-origin: top;
  transition: transform 0.3s ease, max-height 0.3s ease;
}
.component-scale-enter,
.component-fade-leave-to {
  max-height: 0px;
  transform: scale(1, 0);
  overflow: hidden;
}
</style>
