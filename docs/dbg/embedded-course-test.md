# EmbeddedCourse Component Test

Test page for EmbeddedCourse component development and debugging.

<script setup lang="ts">
import EmbeddedCourse from '../.vitepress/theme/components/EmbeddedCourse.vue'
</script>

## Embedded "local" course

<EmbeddedCourse course-id="@skuilder/hero-course" :session-time-limit="5" :debug="true" />
