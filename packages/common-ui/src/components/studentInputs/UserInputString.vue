<template>
  <span class="user-input-container">
    <input
      v-model="answer"
      :autofocus="autofocus"
      type="text"
      class="user-input-string"
      ref="input"
      @keyup.enter="submitAnswer(answer)"
    />
  </span>
</template>

<script lang="ts">
// @compositionstart="onCompositionStart"
// @compositionend="onCompositionEnd"
import UserInput from './BaseUserInput';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'UserInputString',
  extends: UserInput,

  props: {
    icon: {
      type: Boolean,
      required: false,
    },
  },

  computed: {
    prependIcon(): string {
      return this.icon ? 'edit' : '';
    },
  },

  mounted() {
    (this.$refs.input as HTMLInputElement)?.focus();
  },

  methods: {
    // debugInput(e: Event) {
    //   const target = e.target as HTMLInputElement;
    //   console.log('Input event:', {
    //     value: target.value,
    //     currentAnswer: this.answer,
    //     target,
    //   });
    // },
    // debugKeyup(e: KeyboardEvent) {
    //   const target = e.target as HTMLInputElement;
    //   console.log('Keyup event:', {
    //     key: e.key,
    //     value: target.value,
    //     currentAnswer: this.answer,
    //     target,
    //   });
    // },
  },
});
</script>

<style scoped>
.user-input-container {
  display: inline-block;
  min-width: 6em;
  vertical-align: baseline;
}

.user-input-string {
  display: inline-block;
  background: transparent;
  border: none;
  border-bottom: 1px solid currentColor;
  color: currentColor;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  margin: 0;
  text-align: center;
  width: 100%;
  outline: none;
}

.user-input-string:focus {
  border-bottom: 2px solid currentColor;
}
</style>
