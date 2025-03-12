<template>
  <div v-if="initialized" data-viewable="Playback">
    <div v-if="state === 'ready'">
      <div class="text-h4">{{ promptText }} <note-display :chroma="firstNoteChroma" /></div>
      <div class="text-h5">Listen...<span v-if="recording"> and Repeat</span></div>

      <div class="progressContainer">
        <div id="progress" ref="progressBar"></div>
      </div>

      <v-btn color="primary" autofocus @click="clearAttempt"> Play again <v-icon end>volume_up</v-icon> </v-btn>

      <syllable-seq-vis v-if="true" ref="inputVisRef" :seq="inputSeq" :last-t-ssuggestion="lastTSsuggestion" />
      <syllable-seq-vis v-if="graded" :seq="gradedSeq" />
    </div>
    <div v-else-if="state === 'nodevice'">No midi device detected. Please attach one!</div>
    <div v-else-if="state === 'notsupported'">
      <p>This exercise requires a midi input device, which is not supported by this browser ☹</p>
      <div>
        <p>Please try again with one of the following browsers:</p>
        <ul>
          <li><a href="https://www.google.com/chrome/">Google Chrome</a></li>
          <li><a href="https://www.microsoft.com/edge">Microsoft Edge</a></li>
          <li><a href="https://brave.com/">Brave</a></li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType, onMounted, onBeforeUnmount } from 'vue';
import { useViewable, useQuestionView } from '@/base-course/CompositionViewable';
import SkMidi, { eventsToSyllableSequence, SyllableSequence } from '../../utility/midi';
import { EchoQuestion } from '.';
import moment from 'moment';
import SyllableSeqVis from '../../utility/SyllableSeqVis.vue';
import NoteDisplay from '../../NoteDisplay.vue';
import { alertUser } from '@vue-skuilder/common-ui';
import { Status } from '@vue-skuilder/common';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import { SkldrMouseTrap } from '@vue-skuilder/common-ui';

export default defineComponent({
  // this class name *may* be used as a lookup for dynamic component.
  // eslint-disable-next-line
  name: 'Playback',

  components: {
    SyllableSeqVis,
    NoteDisplay,
  },

  props: {
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
    modifyDifficulty: {
      type: Number,
      required: false,
      default: 0,
    },
  },

  setup(props, { emit }) {
    const viewableUtils = useViewable(props, emit, 'Playback');
    const questionUtils = useQuestionView<EchoQuestion>(viewableUtils);

    // State
    const midi = ref<SkMidi>();
    const initialized = ref(false);
    const state = ref('notSet');
    const recording = ref(false);
    const playbackProgress = ref(0);
    const playbackStartTime = ref(moment.utc());
    const playbackDuration = ref(0);
    const attempts = ref(0);
    const gradedSeq = ref<SyllableSequence>(eventsToSyllableSequence([]));
    const graded = ref(false);
    const inputSeq = ref<SyllableSequence>(eventsToSyllableSequence([]));
    const lastTSsuggestion = ref(0);
    const errMsg = ref('');
    const notesOn = ref(0);
    const notesOff = ref(0);

    // Refs
    const progressBar = ref<HTMLDivElement>();
    const inputVisRef = ref<InstanceType<typeof SyllableSeqVis>>();

    // Initialize question
    questionUtils.question.value = new EchoQuestion(props.data);

    // Computed
    const question = computed(() => new EchoQuestion(props.data));

    const promptText = computed(() => {
      return eventsToSyllableSequence(question.value.midi).syllables[0].notes.length > 1
        ? 'Lowest note of first chord:'
        : 'First note:';
    });

    const firstNoteChroma = computed(() => {
      if (initialized.value) {
        return eventsToSyllableSequence(question.value.midi).rootNote.number % 12;
      }
      return 0;
    });

    // Methods
    const init = () => {
      if (state.value) {
        if (state.value !== midi.value?.state) {
          initialized.value = false;
          state.value = midi.value?.state || 'notSet';
          initialized.value = true;
        }
      } else {
        state.value = midi.value?.state || 'notSet';
        initialized.value = true;
      }

      viewableUtils.logger.log(`Playback is running init with state: ${state.value}`);

      if (state.value === 'ready') {
        playbackDuration.value = question.value.duration;
        play();
      }
    };

    const runProgressBar = () => {
      try {
        if (progressBar.value) {
          progressBar.value.style.animationName = '';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (progressBar.value) {
                progressBar.value.style.animationDuration = playbackDuration.value + 'ms';
                progressBar.value.style.animationName = 'progress';
              }
            });
          });
        }
      } catch {
        setTimeout(runProgressBar, 50);
      }
    };

    const record = () => {
      midi.value?.record();
      recording.value = true;

      // attach listeners
      midi.value?.addNoteonListenter((e) => {
        notesOn.value++;
        inputSeq.value.append(e);
        inputVisRef.value?.updateBounds();
        if (notesOn.value + notesOff.value >= question.value.midi.length) {
          submit();
        }
      });

      midi.value?.addNoteoffListenter(() => {
        notesOff.value++;
        if (notesOn.value + notesOff.value >= question.value.midi.length) {
          submit();
        }
      });
    };

    const play = () => {
      midi.value?.stopRecording();
      midi.value?.eraseRecording();
      playbackStartTime.value = moment.utc();
      notesOn.value = 0;
      notesOff.value = 0;
      recording.value = false;
      playbackProgress.value = 0;

      runProgressBar();

      midi.value?.play(question.value.midi);

      setTimeout(() => {
        viewableUtils.logger.log('done playback...');
        record();
      }, question.value.lastNoteOnTimestamp);
    };

    const submit = () => {
      if (!midi.value?.recording) return false;

      const qSylSeq = eventsToSyllableSequence(question.value.midi);
      const aSylSeq = eventsToSyllableSequence(midi.value.recording);
      gradedSeq.value = qSylSeq.grade(aSylSeq);
      inputSeq.value = eventsToSyllableSequence([]);

      if (!questionUtils.submitAnswer(midi.value.recording).isCorrect) {
        attempts.value++;
        graded.value = true;
        if (attempts.value < questionUtils.maxAttemptsPerView.value) {
          play();
        }
        return false;
      }
      return true;
    };

    const clearAttempt = () => {
      if (notesOn.value > 0) {
        submit();
      } else {
        play();
      }
    };

    // Lifecycle
    onMounted(async () => {
      try {
        midi.value = await SkMidi.instance();
        midi.value.setStateChangeListener(() => {
          init();
        });
        initialized.value = true;
      } catch (error) {
        alertUser({
          status: Status.error,
          text: 'Midi device not supported',
        });
        errMsg.value = JSON.stringify(error);
        state.value = 'notsupported';
        initialized.value = true;
      }

      init();

      // Bind space key
      SkldrMouseTrap.bind([
        {
          hotkey: 'space',
          callback: clearAttempt,
          command: 'Clear attempt or play again',
        },
      ]);
    });

    onBeforeUnmount(() => {
      SkldrMouseTrap.reset();
    });

    return {
      ...viewableUtils,
      ...questionUtils,
      initialized,
      state,
      recording,
      inputSeq,
      lastTSsuggestion,
      gradedSeq,
      graded,
      promptText,
      firstNoteChroma,
      progressBar,
      inputVisRef,
      clearAttempt,
      notesOn,
    };
  },
});
</script>

<style lang="css">
@keyframes progress {
  0% {
    width: 0%;
  }

  100% {
    width: 100%;
  }
}

.progressContainer {
  background-color: #eee;
  height: 5px;
}

#progress {
  background-color: blue;
  width: 100%;
  height: 5px;
  animation-timing-function: linear;
}

.hidden {
  opacity: 0;
}
</style>
