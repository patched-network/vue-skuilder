<template>
  <div>
    <h1>Tag: {{ tagId }}</h1>
    <div class="d-flex justify-end mb-4">
      <v-btn
        color="primary"
        :to="{ name: 'course-tag-study-config', params: { courseId: courseId }, query: { tag: tagId } }"
      >
        <v-icon start>mdi-school</v-icon>
        Study this Tag
      </v-btn>
    </div>
    <course-card-browser :course-id="courseId" :tag-id="tagId" :view-lookup-function="viewLookup" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { CourseCardBrowser } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';

export default defineComponent({
  name: 'TagViewer', // Changed name from TagEditorView
  components: {
    CourseCardBrowser,
  },
  props: {
    tagId: {
      type: String,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
  },
  methods: {
    viewLookup(x: unknown) {
      return allCourseWare.getView(x);
    },
  },
});
</script>