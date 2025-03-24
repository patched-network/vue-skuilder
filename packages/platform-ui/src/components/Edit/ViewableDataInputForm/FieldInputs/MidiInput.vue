<template>
  <div>
    <div v-if="recording">
      <span class="text-h5">
        Now Recording from device:
        <span class="font-weight-black">{{ midi.configuredInput }}</span>
      </span>
    </div>
    <syllable-seq-vis v-if="true" ref="inputVis" :seq="SylSeq" last-t-ssuggestion="5000" />
    <v-btn color="primary" :disabled="hasRecording()" @click="play">
      Preview
      <v-icon end>volume_up</v-icon>
    </v-btn>
    <v-btn color="error" :disabled="hasRecording()" @click="reset">
      Clear and try again
      <v-icon end>close</v-icon>
    </v-btn>
    <v-checkbox v-model="transpositions" label="Include Transpositions" @click.capture="reset"></v-checkbox>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FieldInput from '../OptionsFieldInput';
import SkMidi, {
  eventsToSyllableSequence,
  SyllableSequence,
  transposeSyllableSeq,
} from '../../../../courses/piano/utility/midi';
import SyllableSeqVis from '../../../../courses/piano/utility/SyllableSeqVis.vue';

export default defineComponent({
  name: 'MidiInput',
  components: {
    SyllableSeqVis,
  },
  extends: FieldInput,

  data() {
    return {
      midi: null as SkMidi | null,
      recording: false,
      SylSeq: eventsToSyllableSequence([]) as SyllableSequence,
      display: false,
      transpositions: false,
    };
  },

  async created() {
    try {
      this.midi = await SkMidi.instance();
      this.record();
      // [ ] this wasn't updated when the dataInputFormStore / fieldInputStore components were created ?
      this.store[this.field.name] = this.getTransposedSeqs;
    } catch (e) {
      throw new Error(`MidiInput.created: ${e}`);
    }
  },

  methods: {
    record() {
      if (!this.midi) return;
      this.midi.record();
      this.midi.addNoteonListenter((e) => {
        this.SylSeq.append(e);
        (this.$refs.inputVis as InstanceType<typeof SyllableSeqVis>).updateBounds();
      });
      this.recording = true;
    },

    getTransposedSeqs() {
      if (!this.midi) return [];
      if (this.transpositions) {
        return [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((shift) => {
          return transposeSyllableSeq(this.midi!.recording, shift);
        });
      } else {
        return [this.midi.recording];
      }
    },

    clearData() {
      if (!this.midi) return;
      console.log('midiInput clearing data...');
      this.midi.stopRecording();
      this.midi.eraseRecording();
      this.SylSeq = eventsToSyllableSequence([]);
      this.record();
      this.recording = true;

      this.store.convertedInput[this.field.name] = this.midi.recording;
      this.store.validation[this.field.name] = false;
      this.store[this.field.name] = this.getTransposedSeqs;
    },

    hasRecording(): boolean {
      return this.midi?.hasRecording ?? false;
    },

    reset() {
      this.clearData();
    },

    play() {
      if (!this.midi) return;
      this.midi.play();
      this.display = true;
      this.validate();
    },
  },
});
</script>
