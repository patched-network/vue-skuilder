<template>
  <div>
    <!-- <v-textarea v-if="testRoute" v-model="md" variant="outlined" label="Type Here" name="name" /> -->
    <span v-for="(token, i) in tokens" :key="i">
      <md-token-renderer v-if="token.type" :token="token" :last="i === tokens.length - 1" />
    </span>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import MdTokenRenderer from './MdTokenRenderer.vue';
import * as marked from 'marked';

export default defineComponent({
  name: 'MarkdownRenderer',
  components: {
    MdTokenRenderer,
  },
  props: {
    md: {
      type: String as PropType<string>,
      required: true,
    },
  },
  computed: {
    tokens(): marked.MarkedToken[] {
      // lexer() types its output as Token, which adds Tokens.Generic; that only
      // comes from marked extensions, and none are registered.
      return marked.lexer(this.md) as marked.MarkedToken[];
    },
  },
});
</script>

<style lang="css" scoped></style>
