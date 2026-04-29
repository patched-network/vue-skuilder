<template>
  <v-container>
    <v-row>
      <v-col>
        <div class="text-h6 mb-4">NotationMC Debug</div>
        <NotationMCView :data="viewData" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import NotationMCView from '@courseware/piano/questions/notationMC/NotationMCView.vue';

const CORRECT = `X:1\nL:1/4\nM:4/4\nK:C\n|C D E F|`;

const DISTRACTORS = [
  `X:1\nL:1/4\nM:4/4\nK:C\n|E D C D|`,
  `X:1\nL:1/4\nM:4/4\nK:C\n|C D E G|`,
  `X:1\nL:1/4\nM:4/4\nK:C\n|G E D C|`,
].join('\n---\n');

export default defineComponent({
  name: 'NotationMCDebug',

  components: { NotationMCView },

  setup() {
    const viewData = computed(() => [
      {
        Correct: CORRECT,
        Distractors: DISTRACTORS,
      },
    ]);

    return { viewData };
  },
});
</script>
