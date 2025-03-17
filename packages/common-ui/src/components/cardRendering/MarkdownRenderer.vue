<template>
  <div>
    <!-- <v-textarea v-if="testRoute" v-model="md" variant="outlined" label="Type Here" name="name" /> -->
    <span v-for="(token, i) in tokens" :key="i">
      <md-token-renderer v-if="token.type" :token="token" :last="i === tokens.length - 1" />
      <audio-auto-player v-else-if="token.audio" :src="token.audio" />
      <!-- // [ ] insert img display here.  "if token.image ? (also see if the audio aboke is functional)" -->
    </span>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import MdTokenRenderer from './MdTokenRenderer.vue';
import AudioAutoPlayer from './AudioAutoPlayer.vue';
import * as marked from 'marked';

type SkldrToken =
  | marked.Token
  | {
      type: false;
      audio: string;
    };

// Using Options API with mixin
export default defineComponent({
  name: 'MarkdownRenderer',
  components: {
    MdTokenRenderer,
    AudioAutoPlayer,
  },
  props: {
    md: {
      type: String as PropType<string>,
      required: true,
    },
  },
  computed: {
    tokens(): SkldrToken[] {
      return marked.lexer(this.md);
    },
  },
});
</script>

<style lang="css" scoped></style>
