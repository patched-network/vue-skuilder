<template>
  <div v-if="!updatePending">
    <slot name="header" :course-config="courseConfig" :course-id="courseId">
      <h1 class="text-h4 mb-2">{{ courseConfig.name }}</h1>
    </slot>

    <p class="text-body-2">
      {{ courseConfig.description }}
    </p>

    <slot
      name="actions"
      :user-is-registered="userIsRegistered"
      :course-id="courseId"
      :edit-mode="editMode"
      :register="register"
      :drop="drop"
    >
      <!-- Default fallback content if no actions slot provided -->
      <transition name="component-fade" mode="out-in">
        <div v-if="userIsRegistered">
          <v-btn color="success" class="me-2">Start a study session</v-btn>
          <v-btn v-if="editMode === 'full'" data-cy="add-content-btn" color="indigo-lighten-1" class="me-2">
            <v-icon start>mdi-plus</v-icon>
            Add content
          </v-btn>
          <v-btn
            v-if="editMode === 'full'"
            color="green-darken-2"
            title="Rank course content for difficulty"
            class="me-2"
          >
            <v-icon start>mdi-format-list-numbered</v-icon>
            Arrange
          </v-btn>
          <v-btn v-if="editMode === 'full'" color="error" size="small" variant="outlined" @click="drop">
            Drop this course
          </v-btn>
        </div>
        <div v-else>
          <v-btn data-cy="register-btn" color="primary" class="me-2" @click="register">Register</v-btn>
          <v-btn variant="outlined" color="primary" class="me-2">Start a trial study session</v-btn>
        </div>
      </transition>
    </slot>

    <slot name="additional-content"></slot>

    <v-card class="my-2">
      <v-toolbar density="compact">
        <v-toolbar-title>Tags</v-toolbar-title>
        <v-toolbar-items>
          <v-btn variant="text">({{ tags.length }})</v-btn>
        </v-toolbar-items>
      </v-toolbar>
      <v-card-text>
        <span v-for="(tag, i) in tags" :key="i">
          <slot name="tag-link" :tag="tag" :course-id="courseId">
            <v-chip variant="tonal" class="me-2 mb-2">
              {{ tag.name }}
            </v-chip>
          </slot>
        </span>
      </v-card-text>
    </v-card>

    <course-card-browser
      class="my-3"
      :course-id="courseId"
      :view-lookup-function="viewLookupFunction"
      :edit-mode="editMode"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
// import { MidiConfig } from '@vue-skuilder/courses'; // Removed to break circular dependency
import CourseCardBrowser from './CourseCardBrowser.vue';
import { log } from '@vue-skuilder/common';
import { CourseDBInterface, Tag, UserDBInterface, getDataLayer } from '@vue-skuilder/db';
import { CourseConfig } from '@vue-skuilder/common';
import { getCurrentUser } from '../stores/useAuthStore';

export default defineComponent({
  name: 'CourseInformation',

  components: {
    // MidiConfig, // Removed to break circular dependency
    CourseCardBrowser,
  },

  props: {
    courseId: {
      type: String as PropType<string>,
      required: true,
    },
    viewLookupFunction: {
      type: Function,
      required: false,
      default: (x: unknown) => {
        console.warn('No viewLookupFunction provided to CourseInformation');
        return null;
      },
    },
    editMode: {
      type: String as PropType<'none' | 'readonly' | 'full'>,
      required: false,
      default: 'full',
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
    // isPianoCourse removed - piano-specific logic should be in wrapper component
  },

  async created() {
    this.courseDB = getDataLayer().getCourseDB(this.courseId);
    this.user = await getCurrentUser();

    const userCourses = await this.user.getCourseRegistrationsDoc();

    // Admin users always have edit access (for studio mode)
    if (this.user.getUsername() === 'admin') {
      this.userIsRegistered = true;
    } else {
      this.userIsRegistered =
        userCourses.courses.filter((c) => {
          return c.courseID === this.courseId && (c.status === 'active' || c.status === undefined);
        }).length === 1;
    }

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
  transition:
    transform 0.3s ease,
    max-height 0.3s ease;
}
.component-scale-enter,
.component-fade-leave-to {
  max-height: 0px;
  transform: scale(1, 0);
  overflow: hidden;
}
</style>
