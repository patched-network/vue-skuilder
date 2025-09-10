# EmbeddedCourse Component Test

Test page for EmbeddedCourse component development and debugging.

<script setup lang="ts">
import EmbeddedCourse from '../.vitepress/theme/components/EmbeddedCourse.vue'
</script>

## Embedded "local" course

<EmbeddedCourse course-id="@skuilder/hero-course" :session-time-limit="5" />


## Embedded "remote" course

This is loaded from a static deployed course from another repo at https://patched-network.github.io/demo-chess

NB: it is not running content for a chess course, but a repackaging of the golang course.

<EmbeddedCourse course-id="@skuilder/external-test" :session-time-limit="5" />
