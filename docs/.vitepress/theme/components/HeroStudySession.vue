<!-- HeroStudySession.vue - the frontpage demo: the docs course (a course about skuilder).
     The Go course that used to be here is on dbg/embedded-course-test. -->
<template>
  <div class="hero-study-session">
    <DocsCourse :session-time-limit="5" :show-progress="false" />
  </div>
</template>

<script setup lang="ts">
import DocsCourse from './DocsCourse.vue';
</script>

<style scoped>
.hero-study-session {
  width: 100%;
  height: 100%;
}

/* Override EmbeddedCourse styles for hero context */
.hero-study-session :deep(.embedded-course) {
  margin: 0; /* Remove default margins in hero */
  border: none; /* Remove border since wrapper has border */
  background: transparent; /* Transparent background since wrapper has background */
  border-radius: 0; /* No border radius since wrapper handles it */
  padding: 0; /* Remove padding since wrapper provides it */
  min-height: 300px; /* Ensure good height in hero */
}

.hero-study-session :deep(.debug-info) {
  display: none; /* Hide debug info in hero */
}
</style>
