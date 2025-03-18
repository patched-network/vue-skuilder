<template>
  <div class="piano-range-container">
    <div class="piano-wrapper" ref="pianoWrapper">
      <svg :width="svgWidth" :height="keyHeight + 20" class="piano-svg">
        <!-- Background to show full piano range for context -->
        <g class="background-keys" opacity="0.15">
          <template v-for="i in 88" :key="`bg-${i}`">
            <rect
              v-if="isWhiteKey(i + 20)"
              :x="getKeyPosition(i + 20)"
              y="0"
              :width="whiteKeyWidth"
              :height="keyHeight"
              class="white-key"
              stroke="#999"
              stroke-width="1"
            />
          </template>
          <template v-for="i in 88" :key="`bg-black-${i}`">
            <rect
              v-if="!isWhiteKey(i + 20)"
              :x="getKeyPosition(i + 20)"
              y="0"
              :width="blackKeyWidth"
              :height="blackKeyHeight"
              class="black-key"
            />
          </template>
        </g>

        <!-- Selected range highlighted -->
        <g class="selected-range">
          <!-- White keys in selected range -->
          <template v-for="note in 128" :key="`white-${note}`">
            <rect
              v-if="isWhiteKey(note) && note >= lowestNote && note <= highestNote"
              :x="getKeyPosition(note)"
              y="0"
              :width="whiteKeyWidth"
              :height="keyHeight"
              class="white-key active"
              stroke="#666"
              stroke-width="1"
            />
          </template>

          <!-- Black keys in selected range -->
          <template v-for="note in 128" :key="`black-${note}`">
            <rect
              v-if="!isWhiteKey(note) && note >= lowestNote && note <= highestNote"
              :x="getKeyPosition(note)"
              y="0"
              :width="blackKeyWidth"
              :height="blackKeyHeight"
              class="black-key active"
            />
          </template>
        </g>

        <!-- Range markers -->
        <g class="range-markers">
          <rect
            :x="getKeyPosition(lowestNote) - 2"
            y="0"
            :width="4"
            :height="keyHeight + 5"
            class="range-marker start"
          />
          <rect
            :x="getKeyPosition(highestNote) + whiteKeyWidth - 2"
            y="0"
            :width="4"
            :height="keyHeight + 5"
            class="range-marker end"
          />
        </g>

        <!-- Note labels at extremes -->
        <text :x="getKeyPosition(lowestNote) + 3" :y="keyHeight + 12" class="note-label">
          {{ getNoteLabel(lowestNote) }}
        </text>
        <text
          :x="getKeyPosition(highestNote) + whiteKeyWidth - 3"
          :y="keyHeight + 12"
          text-anchor="end"
          class="note-label"
        >
          {{ getNoteLabel(highestNote) }}
        </text>
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';

export default defineComponent({
  name: 'PianoRangeVisualizer',

  props: {
    lowestNote: {
      type: Number,
      required: true,
    },
    highestNote: {
      type: Number,
      required: true,
    },
    // Optional max width to fit in parent container
    maxWidth: {
      type: Number,
      default: 1000,
    },
  },

  setup(props) {
    const pianoWrapper = ref<HTMLElement | null>(null);
    const containerWidth = ref(800);

    // Piano dimensions
    const keyHeight = 100;
    const blackKeyHeight = 60;

    // Calculate piano dimensions based on range
    // const keysInFullRange = 88; // Standard piano: A0 (21) to C8 (108)
    const totalWhiteKeys = computed(() => {
      let count = 0;
      for (let note = 21; note <= 108; note++) {
        if (isWhiteKey(note)) count++;
      }
      return count;
    });

    const whiteKeyWidth = computed(() => {
      return Math.min(22, containerWidth.value / Math.max(25, totalWhiteKeys.value));
    });

    const blackKeyWidth = computed(() => whiteKeyWidth.value * 0.6);

    const svgWidth = computed(() => {
      return Math.min(props.maxWidth, whiteKeyWidth.value * totalWhiteKeys.value + 10);
    });

    // Determine if a note is a white key
    const isWhiteKey = (noteNumber: number) => {
      const note = noteNumber % 12;
      return [0, 2, 4, 5, 7, 9, 11].includes(note);
    };

    // Position calculation for keys
    const getKeyPosition = (noteNumber: number) => {
      let whiteKeyCount = 0;
      for (let i = 21; i < noteNumber; i++) {
        if (isWhiteKey(i)) whiteKeyCount++;
      }

      if (isWhiteKey(noteNumber)) {
        return whiteKeyCount * whiteKeyWidth.value;
      } else {
        // For black keys, position them between white keys
        return whiteKeyCount * whiteKeyWidth.value - blackKeyWidth.value / 2;
      }
    };

    const getNoteLabel = (noteNumber: number) => {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const note = noteNumber % 12;
      const octave = Math.floor(noteNumber / 12) - 1;
      return `${noteNames[note]}${octave}`;
    };

    onMounted(() => {
      if (pianoWrapper.value) {
        containerWidth.value = pianoWrapper.value.clientWidth;

        // Add resize listener to adjust for window size changes
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            containerWidth.value = entry.contentRect.width;
          }
        });

        resizeObserver.observe(pianoWrapper.value);
      }
    });

    return {
      pianoWrapper,
      keyHeight,
      blackKeyHeight,
      whiteKeyWidth,
      blackKeyWidth,
      svgWidth,
      isWhiteKey,
      getKeyPosition,
      getNoteLabel,
    };
  },
});
</script>

<style scoped>
.piano-range-container {
  margin: 20px 0;
}

.piano-wrapper {
  width: 100%;
  overflow-x: hidden;
  margin: 10px 0;
}

.piano-svg {
  display: block;
  width: 100%;
  height: auto;
}

.white-key {
  fill: white;
}

.black-key {
  fill: #333;
}

.white-key.active {
  fill: #e6f2ff;
}

.black-key.active {
  fill: #1a1a1a;
}

.range-marker {
  fill: #ff5252;
}

.note-label {
  font-size: 12px;
  fill: #333;
  font-weight: bold;
}
</style>
