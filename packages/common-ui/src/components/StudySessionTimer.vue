<!-- @vue-skuilder/common-ui/src/components/StudySessionTimer.vue -->
<template>
  <v-tooltip location="right" :open-delay="0" :close-delay="200" color="secondary" class="text-subtitle-1">
    <template #activator="{ props }">
      <div class="timer-container" v-bind="props" @mouseenter="hovered = true" @mouseleave="hovered = false">
        <v-progress-circular
          alt="Time remaining in study session"
          size="64"
          width="8"
          rotate="0"
          :color="timerColor"
          :model-value="percentageRemaining"
        >
          <v-btn
            v-if="timeRemaining > 0 && hovered"
            icon
            color="transparent"
            location="bottom left"
            @click="addSessionTime"
          >
            <v-icon size="large">mdi-plus</v-icon>
          </v-btn>
        </v-progress-circular>
      </div>
    </template>
    {{ formattedTimeRemaining }}
  </v-tooltip>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue';

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
  },

  emits: ['add-time'],

  setup(props, { emit }) {
    const hovered = ref(false);

    /**
     * Formats the time remaining into a readable string
     */
    const formattedTimeRemaining = computed(() => {
      let timeString = '';
      const seconds = props.timeRemaining;

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
      return props.timeRemaining > 60
        ? 100 * (props.timeRemaining / (60 * props.sessionTimeLimit))
        : 100 * (props.timeRemaining / 60);
    });

    /**
     * Determines the color of the timer based on time remaining
     */
    const timerColor = computed(() => {
      return props.timeRemaining > 60 ? 'primary' : 'orange darken-3';
    });

    /**
     * Handles adding time to the session
     */
    const addSessionTime = () => {
      emit('add-time');
    };

    return {
      hovered,
      formattedTimeRemaining,
      percentageRemaining,
      timerColor,
      addSessionTime,
    };
  },
});
</script>

<style scoped>
.timer-container {
  display: inline-flex;
  cursor: pointer;
}
</style>
