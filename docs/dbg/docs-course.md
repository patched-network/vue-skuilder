# Docs Course (prototype)

A course about skuilder, embedded in its own docs. Questions about a docs page stay locked until
you've read that page, or met its introduction card in a session. Read a page, come back, start a
session: that page's questions come up first.

How it works: [docs/course-src/README.md](https://github.com/patched-network/vue-skuilder/blob/master/docs/course-src/README.md).

<script setup lang="ts">
import DocsCourse from '../.vitepress/theme/components/DocsCourse.vue'
</script>

<DocsCourse :session-time-limit="5" :progress-open="true" />
