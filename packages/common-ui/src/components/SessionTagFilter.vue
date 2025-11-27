<template>
  <div class="session-tag-filter pa-4">
    <div class="text-h5 mb-4">Study Configuration for {{ courseId }}</div>

    <!-- Tag Selection -->
    <v-select
      v-model="filter.include"
      :items="allTags"
      label="Include cards with these tags"
      multiple
      chips
      closable-chips
      class="mb-4"
      variant="outlined"
      placeholder="Select tags to study"
    ></v-select>

    <v-select
      v-model="filter.exclude"
      :items="allTags"
      label="Exclude cards with these tags"
      multiple
      chips
      closable-chips
      class="mb-4"
      variant="outlined"
      placeholder="Select tags to ignore"
    ></v-select>

    <!-- Time Limit -->
    <v-text-field
      v-model.number="timeLimit"
      class="time-limit-field"
      variant="outlined"
      label="Study Session Timelimit"
      prepend-inner-icon="mdi-clock-outline"
      :suffix="timeLimit === 1 ? 'minute' : 'minutes'"
      type="number"
      min="1"
    />

    <!-- Start Button -->
    <v-btn
      color="success"
      size="large"
      block
      class="start-btn mt-4"
      :disabled="filter.include.length === 0"
      @click="startSession"
    >
      <v-icon start>mdi-play</v-icon>
      Start Filtered Session
    </v-btn>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, onMounted } from 'vue';
import { getCourseTagStubs } from '@vue-skuilder/db';

// Re-defining TagFilter here to avoid dependency complexities.
// In a real scenario, this might be shared from @vue-skuilder/common.
interface TagFilter {
  include: string[];
  exclude: string[];
}

export default defineComponent({
  name: 'SessionTagFilter',
  props: {
    courseId: {
      type: String,
      required: true,
    },
    initialFilter: {
      type: Object as PropType<TagFilter>,
      default: () => ({ include: [], exclude: [] }),
    },
    initialTime: {
      type: Number,
      default: 5,
    },
  },
  emits: ['start-filtered-session'],

  setup(props, { emit }) {
    const allTags = ref<string[]>([]);
    const filter = ref<TagFilter>({ ...props.initialFilter });
    const timeLimit = ref<number>(props.initialTime);

    onMounted(async () => {
      try {
        const tagStubs = await getCourseTagStubs(props.courseId);
        allTags.value = tagStubs.map(stub => stub.name);
      } catch (error) {
        console.error("Failed to load course tags:", error);
      }
    });

    const startSession = () => {
      emit('start-filtered-session', {
        filter: filter.value,
        time: timeLimit.value,
      });
    };

    return {
      allTags,
      filter,
      timeLimit,
      startSession,
    };
  },
});
</script>

<style scoped>
.session-tag-filter {
  max-width: 600px;
  margin: auto;
}
.time-limit-field {
  width: 100%;
}
</style>