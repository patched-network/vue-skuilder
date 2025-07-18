<template>
  <div>
    <course-information :course-id="courseId" :view-lookup-function="viewLookup" :edit-mode="editMode">
      <template #header="{ courseConfig: config }">
        <h1 class="text-h4 mb-2"><router-link to="/q">Quilts</router-link> / {{ config.name }}</h1>
      </template>

      <template #actions="{ userIsRegistered, courseId: id, editMode: mode, register, drop }">
        <transition name="component-fade" mode="out-in">
          <div v-if="userIsRegistered">
            <router-link :to="`/study/${id}`" class="me-2">
              <v-btn color="success">Start a study session</v-btn>
            </router-link>
            <router-link v-if="mode === 'full'" :to="`/edit/${id}`" class="me-2">
              <v-btn data-cy="add-content-btn" color="indigo-lighten-1">
                <v-icon start>mdi-plus</v-icon>
                Add content
              </v-btn>
            </router-link>
            <router-link v-if="mode === 'full'" :to="`/courses/${id}/elo`" class="me-2">
              <v-btn color="green-darken-2" title="Rank course content for difficulty">
                <v-icon start>mdi-format-list-numbered</v-icon>
                Arrange
              </v-btn>
            </router-link>
            <v-btn v-if="mode === 'full'" color="error" size="small" variant="outlined" @click="drop">
              Drop this course
            </v-btn>
          </div>
          <div v-else>
            <v-btn data-cy="register-btn" color="primary" class="me-2" @click="register">Register</v-btn>
            <router-link :to="`/q/${id}/preview`">
              <v-btn variant="outlined" color="primary" class="me-2">Start a trial study session</v-btn>
            </router-link>
          </div>
        </transition>
      </template>

      <template #tag-link="{ tag, courseId: id }">
        <router-link :to="`/q/${id}/tags/${tag.name}`">
          <v-chip variant="tonal" class="me-2 mb-2">
            {{ tag.name }}
          </v-chip>
        </router-link>
      </template>

      <template #additional-content>
        <midi-config v-if="isPianoCourse" :_id="courseId" :user="user" class="my-3" />
      </template>
    </course-information>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { CourseInformation, getCurrentUser } from '@vue-skuilder/common-ui';
import { MidiConfig, allCourses } from '@vue-skuilder/courseware';
import { UserDBInterface, getDataLayer } from '@vue-skuilder/db';
import { CourseConfig } from '@vue-skuilder/common';

export default defineComponent({
  name: 'CourseInformationWrapper',

  components: {
    CourseInformation,
    MidiConfig,
  },

  props: {
    courseId: {
      type: String as PropType<string>,
      required: true,
    },
  },

  data() {
    return {
      courseConfig: {} as CourseConfig,
      user: null as UserDBInterface | null,
      editMode: 'full' as 'none' | 'readonly' | 'full',
    };
  },

  computed: {
    isPianoCourse(): boolean {
      return this.courseConfig.name?.toLowerCase().includes('piano') ?? false;
    },
  },

  async created() {
    const dataLayer = getDataLayer();
    const courseDB = dataLayer.getCourseDB(this.courseId);
    this.courseConfig = await courseDB.getCourseConfig();
    this.user = await getCurrentUser();

    // Determine edit mode based on data layer capabilities
    this.editMode = dataLayer.isReadOnly() ? 'readonly' : 'full';
  },

  methods: {
    viewLookup(x: unknown) {
      return allCourses.getView(x);
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
</style>
