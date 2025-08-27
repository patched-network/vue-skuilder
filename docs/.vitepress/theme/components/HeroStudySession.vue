<!-- HeroStudySession.vue - Wrapper for hero section integration -->
<template>
  <div class="hero-study-session">
    <EmbeddedCourse 
      course-id="2aeb8315ef78f3e89ca386992d00825b" 
      :session-time-limit="5"
      :session-config="{ likesConfetti: true }"
    />
  </div>
</template>

<script setup lang="ts">
// This is a simple wrapper around EmbeddedCourse for hero section use
// All the logic is in EmbeddedCourse component
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