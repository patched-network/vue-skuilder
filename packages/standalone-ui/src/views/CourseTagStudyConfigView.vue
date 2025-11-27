<template>
  <v-container>
    <SessionTagFilter
      :course-id="courseId"
      :initial-filter="initialFilter"
      @start-filtered-session="onStartSession"
    />
  </v-container>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SessionTagFilter } from '@vue-skuilder/common-ui';
import { useStudyConfigStore } from '../stores/studyConfig'; // Assuming a store is created

export default defineComponent({
  name: 'CourseTagStudyConfigView', // Renamed component
  components: {
    SessionTagFilter,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const store = useStudyConfigStore();

    const courseId = computed(() => route.params.courseId as string);

    const initialFilter = computed(() => {
      const tag = route.query.tag as string | undefined;
      return {
        include: tag ? [tag] : [],
        exclude: [],
      };
    });

    const onStartSession = (config: { filter: any; time: number }) => {
      store.setFilter(config.filter);
      store.setTime(config.time);
      router.push('/study');
    };

    return {
      courseId,
      initialFilter,
      onStartSession,
    };
  },
});
</script>