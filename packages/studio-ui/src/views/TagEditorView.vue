<template>
  <div>
    <h1>Tag: {{ tagId }}</h1>
    <course-card-browser :course-id="courseId" :tag-id="tagId" :view-lookup-function="viewLookup" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { CourseCardBrowser } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';

export default defineComponent({
  name: 'TagEditorView',

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