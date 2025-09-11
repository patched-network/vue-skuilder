# EmbeddedCourse Component Test

Test page for EmbeddedCourse component development and debugging.

<script setup lang="ts">
import EmbeddedCourse from '../.vitepress/theme/components/EmbeddedCourse.vue'
</script>

## Embedded "remote" course

This is loaded from a static deployed course from another repo at https://patched-network.github.io/demo-chess

<EmbeddedCourse course-id="@skuilder/demo-chess" :session-time-limit="5" />
