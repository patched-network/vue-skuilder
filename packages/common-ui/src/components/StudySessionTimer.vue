<!-- @vue-skuilder/common-ui/src/components/study/StudySessionTimer.vue -->
<template>
  <v-tooltip
    v-model="showTooltip"
    location="right"
    :open-delay="0"
    :close-delay="200"
    color="secondary"
    class="text-subtitle-1"
  >
    <template #activator="{ props }">
      <v-progress-circular
        alt="Time remaining in study session"
        size="64"
        width="8"
        rotate="0"
        :color="timerColor"
        :model-value="percentageRemaining"
      >
        <v-btn
          v-if="isActive"
          v-bind="props"
          icon
          color="grey-lighten-4"
          location="bottom left"
          @click="addSessionTime"
        >
          <v-icon v-if="isActive" size="large">mdi-plus</v-icon>
        </v-btn>
      </v-progress-circular>
    </template>
    {{ formattedTimeRemaining }}
  </v-tooltip>
</template>

<script lang="ts">
import { defineComponent, computed, toRefs } from 'vue';

export default defineComponent({
  name: 'StudySessionTimer',

  props: {
    /**
     * Time remaining in seconds
     */
    timeRemaining: {
      type: Number,
      required: true,
    },
    /**
     * Total session time limit in minutes
     */
    sessionTimeLimit: {
      type: Number,
      required: true,
      default: 5,
    },
    /**
     * Whether the timer is currently active
     */
    isActive: {
      type: Boolean,
      required: true,
      default: false,
    },
    /**
     * Whether the tooltip should be shown
     */
    showTooltip: {
      type: Boolean,
      required: false,
      default: false,
    },
  },

  emits: ['add-time'],

  setup(props, { emit }) {
    const { timeRemaining, sessionTimeLimit, isActive } = toRefs(props);

    /**
     * Formats the time remaining into a readable string
     */
    const formattedTimeRemaining = computed(() => {
      let timeString = '';
      const seconds = timeRemaining.value;

      if (seconds > 60) {
        timeString = Math.floor(seconds / 60).toString() + ':';
      }

      const secondsRemaining = seconds % 60;
      timeString += secondsRemaining >= 10 ? secondsRemaining : '0' + secondsRemaining;

      if (seconds <= 60) {
        timeString += ' seconds';
      }

      timeString += ' left!';

      return timeString;
    });

    /**
     * Calculates the percentage of time remaining for the progress indicator
     */
    const percentageRemaining = computed(() => {
      return timeRemaining.value > 60
        ? 100 * (timeRemaining.value / (60 * sessionTimeLimit.value))
        : 100 * (timeRemaining.value / 60);
    });

    /**
     * Determines the color of the timer based on time remaining
     */
    const timerColor = computed(() => {
      return timeRemaining.value > 60 ? 'primary' : 'orange darken-3';
    });

    /**
     * Handles adding time to the session
     */
    const addSessionTime = () => {
      console.log(`[timer] addSessionTime called`);
      if (isActive.value) {
        emit('add-time');
      } else {
        console.log(`[timer] addSessionTime called when session is not active`);
      }
    };

    return {
      formattedTimeRemaining,
      percentageRemaining,
      timerColor,
      addSessionTime,
    };
  },
});
</script>

<style scoped>
/* The component inherits styles from parent application */
</style>
