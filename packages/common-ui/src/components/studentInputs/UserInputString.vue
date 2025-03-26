<template>
  <v-container class="pa-0">
    <v-text-field
      v-model="answer"
      :autofocus="autofocus"
      :prepend-icon="prependIcon"
      type="text"
      variant="underlined"
      single-line
      hide-details
      @keyup.enter="submitAnswer(answer)"
    ></v-text-field>
  </v-container>
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
