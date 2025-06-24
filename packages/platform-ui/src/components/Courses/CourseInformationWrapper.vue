<template>
  <div>
    <course-information :course-id="courseId" :view-lookup-function="viewLookup" />
    <midi-config v-if="isPianoCourse" :_id="courseId" :user="user" class="my-3" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { CourseInformation, getCurrentUser } from '@vue-skuilder/common-ui';
import { MidiConfig, allCourses } from '@vue-skuilder/courses';
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
    };
  },

  computed: {
    isPianoCourse(): boolean {
      return this.courseConfig.name?.toLowerCase().includes('piano') ?? false;
    },
  },

  methods: {
    viewLookup(x: unknown) {
      return allCourses.getView(x);
    },
  },

  async created() {
    const courseDB = getDataLayer().getCourseDB(this.courseId);
    this.courseConfig = await courseDB.getCourseConfig();
    this.user = await getCurrentUser();
  },
});
</script>
