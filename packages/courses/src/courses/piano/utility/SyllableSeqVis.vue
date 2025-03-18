<template>
  <div>
    <svg :width="510" :height="Math.max(3 * (high - low) + 10, 0)">
      <template v-for="syl in seq.syllables">
        <template v-for="note in syl.notes" :key="syl.timestamp + '-' + note.note.number">
          <circle
            :cx="((syl.timestamp - firstTS) * 500) / (lastTS - firstTS) + 4"
            :cy="3 * (high - note.note.number) + 4"
            :alt="note.note.name"
            r="3"
            :fill="note.isCorrect ? 'black' : note.isMissing ? 'none' : 'red'"
            :stroke="note.isMissing ? 'red' : 'none'"
            @mouseenter="sayNote(note)"
          />
        </template>
      </template>
    </svg>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType, onMounted } from 'vue';
import { SyllableSequence, NoteEvent } from './midi';

export default defineComponent({
  name: 'SyllableSeqVis',

  props: {
    seq: {
      type: Object as PropType<SyllableSequence>,
      required: true,
    },
    lastTSsuggestion: {
      type: Number,
      required: false,
      default: 0,
    },
  },

  setup(props) {
    const firstTS = ref(0); // in ms
    const lastTS = ref(0); // in ms
    const high = ref(0);
    const low = ref(500);

    const sayNote = (note: NoteEvent) => {
      console.log(`${JSON.stringify(note)}`);
    };

    const getLastTS = computed(() => {
      const min = 1;
      const ts = props.seq.syllables[props.seq.syllables.length - 1].timestamp;
      return Math.max(min, ts, props.lastTSsuggestion);
    });

    const getHeight = computed(() => {
      let highVal = 0;
      let lowVal = 500;
      props.seq.syllables.forEach((s) => {
        s.notes.forEach((n) => {
          if (n.note.number > highVal) {
            highVal = n.note.number;
          }
          if (n.note.number < lowVal) {
            lowVal = n.note.number;
          }
        });
      });
      return Math.max(3 * (highVal - lowVal) + 10, 0);
    });

    const updateBounds = () => {
      try {
        firstTS.value = props.seq.syllables[0].timestamp;
        const dataTS = props.seq.syllables[props.seq.syllables.length - 1].timestamp;
        const suggestedTS = firstTS.value + props.lastTSsuggestion;

        lastTS.value = Math.max(dataTS, suggestedTS);
      } catch (e) {
        console.log(`[SyllableSeqVis] Error updating bounds: ${e}`);
      }
      props.seq.syllables.forEach((s) => {
        s.notes.forEach((n) => {
          if (n.note.number > high.value) {
            high.value = n.note.number;
          }
          if (n.note.number < low.value) {
            low.value = n.note.number;
          }
        });
      });
    };

    onMounted(() => {
      console.log(`SyllableSeqVis created w/ input: \n${props.seq}`);
      updateBounds();
    });

    return {
      firstTS,
      lastTS,
      high,
      low,
      sayNote,
      getLastTS,
      getHeight,
      updateBounds,
    };
  },
});
</script>

<style lang="css" scoped>
svg {
  border: 1px;
}
</style>
