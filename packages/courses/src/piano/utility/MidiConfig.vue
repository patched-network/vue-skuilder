<template>
  <v-card>
    <v-toolbar dense>
      <v-toolbar-title>Configure Midi Device</v-toolbar-title>
    </v-toolbar>
    <v-card-text>
      <v-form v-if="midiSupported" onsubmit="return false;">
        <v-select
          v-model="selectedInput"
          :items="inputs"
          label="Select Input"
          hint="Play some notes on your input device to test the connection"
        ></v-select>
        <v-select v-model="selectedOutput" :items="outputs" label="Select Output"></v-select>
        <v-divider class="my-4"></v-divider>
        <h3 class="text-subtitle-1 mb-2">Keyboard Range</h3>

        <v-select
          v-model="selectedKeyboardRange"
          :items="keyboardRangeOptions"
          label="Select Keyboard Range"
          @update:model-value="updateCustomRangeFromPreset"
        ></v-select>

        <div v-if="selectedKeyboardRange === 'custom'" class="custom-range-inputs d-flex gap-4">
          <v-select
            v-model="lowestNote"
            :items="noteOptions"
            label="Lowest Note"
            @update:model-value="updateRangeAndCheckChanges"
          ></v-select>

          <v-select
            v-model="highestNote"
            :items="noteOptions"
            label="Highest Note"
            @update:model-value="updateRangeAndCheckChanges"
          ></v-select>
        </div>

        <piano-range-visualizer :lowest-note="lowestNote" :highest-note="highestNote" />

        <div class="d-flex justify-space-between mt-3">
          <v-btn color="primary" @click="playSound">Test midi output</v-btn>
          <v-btn
            :loading="updatePending"
            :disabled="!configChanged && !updatePending"
            color="info"
            class="save-button"
            @click="saveSettings"
          >
            Save these settings
          </v-btn>
        </div>
      </v-form>
      <div v-else>
        <p>This quilt requires a midi input device, which is not supported by this browser.</p>
        <div>
          <p>Try one of the following browsers:</p>
          <ul>
            <li>
              <a href="https://www.google.com/chrome/">Google Chrome</a>
            </li>
            <li>
              <a href="https://www.microsoft.com/edge">Microsoft Edge</a>
            </li>
            <li>
              <a href="https://brave.com/">Brave</a>
            </li>
          </ul>
        </div>
      </div>
      <!-- Input: {{selectedInput}}
        Output: {{selectedOutput}} -->
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted } from 'vue';
import { alertUser } from '@vue-skuilder/common-ui';
import SkMidi from './midi';
import { Status } from '@vue-skuilder/common';
import { User } from '@vue-skuilder/db';
import { InputEventNoteon } from 'webmidi';
import PianoRangeVisualizer from './PianoRangeVisualizer.vue';

export interface MidiDevice {
  title: string;
  value: string;
}
export default defineComponent({
  name: 'MidiConfig',

  components: {
    PianoRangeVisualizer,
  },

  props: {
    _id: {
      type: String,
      required: true,
    },
    user: {
      type: Object as () => User,
      required: true,
    },
  },

  setup(props) {
    const midi = ref<SkMidi>();
    const midiSupported = ref(true);
    const inputs = ref<MidiDevice[]>([]);
    const outputs = ref<MidiDevice[]>([]);
    const selectedInput = ref<string>('');
    const selectedOutput = ref<string>('');
    const updatePending = ref(false);

    // managing config state updates
    const savedInputId = ref<string>('');
    const savedOutputId = ref<string>('');
    const configChanged = ref(false);

    // Keyboard range
    const selectedKeyboardRange = ref('full-88');
    const lowestNote = ref(21); // A0
    const highestNote = ref(108); // C8
    const savedKeyboardRange = ref('');
    const savedLowestNote = ref(0);
    const savedHighestNote = ref(0);

    const noteOptions = ref<Array<{ title: string; value: number }>>([]);

    // Initialize noteOptions with all MIDI notes (0-127) with proper naming
    const initNoteOptions = () => {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const options = [];

      // Generate all 128 MIDI notes with proper labeling
      for (let i = 0; i <= 127; i++) {
        const octave = Math.floor(i / 12) - 1;
        const noteName = noteNames[i % 12];

        options.push({
          title: `${noteName}${octave} (${i})`, // Format: "C4 (60)"
          value: i,
        });
      }

      noteOptions.value = options;
    };

    const keyboardRangeOptions = ref([
      { title: 'Full 88-key Piano (A0-C8)', value: 'full-88' },
      { title: '76-key Keyboard (E1-G7)', value: '76-key' },
      { title: '61-key Keyboard (C2-C7)', value: '61-key' },
      { title: '49-key Keyboard (C3-C7)', value: '49-key' },
      { title: '37-key Keyboard (C3-C6)', value: '37-key' },
      { title: '25-key Keyboard (C4-C6)', value: '25-key' },
      { title: 'Custom Range', value: 'custom' },
    ]);

    const checkConfigChanged = () => {
      configChanged.value =
        selectedInput.value !== savedInputId.value ||
        selectedOutput.value !== savedOutputId.value ||
        selectedKeyboardRange.value !== savedKeyboardRange.value ||
        (selectedKeyboardRange.value === 'custom' &&
          (lowestNote.value !== savedLowestNote.value || highestNote.value !== savedHighestNote.value));
    };

    const updateCustomRangeFromPreset = () => {
      switch (selectedKeyboardRange.value) {
        case 'full-88':
          lowestNote.value = 21; // A0
          highestNote.value = 108; // C8
          break;
        case '76-key':
          lowestNote.value = 28; // E1
          highestNote.value = 103; // G7
          break;
        case '61-key':
          lowestNote.value = 36; // C2
          highestNote.value = 96; // C7
          break;
        case '49-key':
          lowestNote.value = 48; // C3
          highestNote.value = 96; // C7
          break;
        case '37-key':
          lowestNote.value = 48; // C3
          highestNote.value = 84; // C6
          break;
        case '25-key':
          lowestNote.value = 60; // C4
          highestNote.value = 84; // C6
          break;
      }
      checkConfigChanged();
    };

    const updateRangeAndCheckChanges = () => {
      // Ensure lowest is always below highest
      if (lowestNote.value >= highestNote.value) {
        highestNote.value = lowestNote.value + 12; // At least an octave higher
      }
      checkConfigChanged();
    };

    const playSound = () => {
      midi.value?.play([
        {
          note: {
            number: 64,
            name: 'E',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.4251968503937008,
          timestamp: 0,
        },
        {
          note: {
            number: 64,
            name: 'E',
            octave: 4,
          },
          velocity: 0.3779527559055118,
          type: 'noteoff',
          timestamp: 511.90500000002794,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.5275590551181102,
          timestamp: 535.8800000001211,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          velocity: 0.33858267716535434,
          type: 'noteoff',
          timestamp: 674.9899999999907,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.5590551181102362,
          timestamp: 1070.8800000000047,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          velocity: 0.3464566929133858,
          type: 'noteoff',
          timestamp: 1214.8999999999069,
        },
        {
          note: {
            number: 64,
            name: 'E',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.5118110236220472,
          timestamp: 1424.9400000000605,
        },
        {
          note: {
            number: 64,
            name: 'E',
            octave: 4,
          },
          velocity: 0.2755905511811024,
          type: 'noteoff',
          timestamp: 1576.9150000000373,
        },
        {
          note: {
            number: 62,
            name: 'D',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.3937007874015748,
          timestamp: 1756.9149999999208,
        },
        {
          note: {
            number: 62,
            name: 'D',
            octave: 4,
          },
          velocity: 0.36220472440944884,
          type: 'noteoff',
          timestamp: 1926.9899999998743,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.5196850393700787,
          timestamp: 1970.9600000000792,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          velocity: 0.36220472440944884,
          type: 'noteoff',
          timestamp: 2126.009999999893,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.5984251968503937,
          timestamp: 2502.0050000000047,
        },
        {
          note: {
            number: 60,
            name: 'C',
            octave: 4,
          },
          velocity: 0.3858267716535433,
          type: 'noteoff',
          timestamp: 2853.920000000042,
        },
        {
          note: {
            number: 67,
            name: 'G',
            octave: 4,
          },
          type: 'noteon',
          velocity: 0.6850393700787402,
          timestamp: 2875.8649999999907,
        },
        {
          note: {
            number: 67,
            name: 'G',
            octave: 4,
          },
          velocity: 0.6377952755905512,
          type: 'noteoff',
          timestamp: 4497.004999999888,
        },
      ]);
    };

    const indicateHeardNotes = (note: InputEventNoteon) => {
      alertUser({
        text: `I hear a ${note.note.name}!`,
        status: Status.ok,
      });
    };

    watch(selectedInput, () => {
      midi.value?.selectInput(selectedInput.value);
      checkConfigChanged();
    });

    watch(selectedOutput, () => {
      midi.value?.selectOutput(selectedOutput.value);
      checkConfigChanged();
    });

    const retrieveSettings = async () => {
      const s = await props.user.getCourseSettings(props._id);

      if (s?.midiinput) {
        const savedInput = s.midiinput.toString();
        const inputExists = inputs.value.some((input) => input.value === savedInput);
        if (inputExists) {
          selectedInput.value = savedInput;
          savedInputId.value = savedInput;
        }
      }

      if (s?.midioutput) {
        const savedOutput = s.midioutput.toString();
        const outputExists = outputs.value.some((output) => output.value === savedOutput);
        if (outputExists) {
          selectedOutput.value = savedOutput;
          savedOutputId.value = savedOutput;
        }
      }

      // Load keyboard range settings
      if (s?.keyboardRange) {
        savedKeyboardRange.value = s.keyboardRange.toString();
        selectedKeyboardRange.value = savedKeyboardRange.value;
      }

      if (s?.lowestNote) {
        savedLowestNote.value = parseInt(s.lowestNote.toString());
        lowestNote.value = savedLowestNote.value;
      }

      if (s?.highestNote) {
        savedHighestNote.value = parseInt(s.highestNote.toString());
        highestNote.value = savedHighestNote.value;
      }

      // If we have custom values but not the 'custom' range type, set it
      if (s?.lowestNote && s?.highestNote && !s?.keyboardRange) {
        selectedKeyboardRange.value = 'custom';
      }

      // Initialize with no pending changes after loading
      configChanged.value = false;
    };

    const saveSettings = async () => {
      updatePending.value = true;
      await props.user.updateCourseSettings(props._id, [
        {
          key: 'midiinput',
          value: selectedInput.value,
        },
        {
          key: 'midioutput',
          value: selectedOutput.value,
        },
        {
          key: 'keyboardRange',
          value: selectedKeyboardRange.value,
        },
        {
          key: 'lowestNote',
          value: lowestNote.value,
        },
        {
          key: 'highestNote',
          value: highestNote.value,
        },
      ]);

      // Update saved state references
      savedInputId.value = selectedInput.value;
      savedOutputId.value = selectedOutput.value;
      savedKeyboardRange.value = selectedKeyboardRange.value;
      savedLowestNote.value = lowestNote.value;
      savedHighestNote.value = highestNote.value;

      configChanged.value = false;
      updatePending.value = false;

      alertUser({
        text: 'Settings updated.',
        status: Status.ok,
      });
    };

    onMounted(async () => {
      initNoteOptions();
      try {
        midi.value = await SkMidi.instance();
        midiSupported.value = midi.value.state === 'ready' || midi.value.state === 'nodevice';
      } catch (e) {
        console.log(`Error on midi Init: ${e}`);
        midiSupported.value = false;
      }

      if (midiSupported.value) {
        midi.value?.addNoteonListenter(indicateHeardNotes);
        if (midi.value) {
          inputs.value = midi.value.inputs
            .filter((i) => i.state === 'connected')
            .map((i) => ({
              title: `${i.manufacturer}: ${i.name}`,
              value: i.id,
            }));
          outputs.value = midi.value?.outputs
            .filter((i) => i.state === 'connected')
            .map((i) => ({
              title: `${i.manufacturer}: ${i.name}`,
              value: i.id,
            }));
        } else {
          inputs.value = [{ title: 'No inputs available', value: '' }];
          outputs.value = [{ title: 'No outputs available', value: '' }];
        }

        await retrieveSettings();

        // Only set defaults if no saved settings were loaded
        if (!selectedInput.value && inputs.value.length > 0) {
          selectedInput.value = inputs.value[0].value;
        }

        if (!selectedOutput.value && outputs.value.length > 0) {
          selectedOutput.value = outputs.value[0].value;
        }
      }
    });

    return {
      midiSupported,
      inputs,
      outputs,
      selectedInput,
      selectedOutput,
      updatePending,
      playSound,
      saveSettings,
      configChanged,
      lowestNote,
      highestNote,
      keyboardRangeOptions,
      selectedKeyboardRange,
      noteOptions,
      updateCustomRangeFromPreset,
      updateRangeAndCheckChanges,
    };
  },
});
</script>

<style scoped>
.save-button {
  transition: opacity 0.5s ease-out;
  opacity: 1;
}

.save-button.v-btn--disabled:not(.v-btn--loading) {
  opacity: 0;
}
</style>
