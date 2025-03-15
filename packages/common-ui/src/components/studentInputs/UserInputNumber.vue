<template>
  <v-container class="pa-0">
    <v-text-field
      ref="input"
      v-model="answer"
      prepend-icon="edit"
      :autofocus="autofocus"
      row-height="24"
      toggle-keys="[13,32]"
      class="text-h5"
      :rules="[isNumeric]"
      @keyup.enter="submitAnswer(makeNumeric(answer))"
    ></v-text-field>
  </v-container>
</template>

<script lang="ts">
import { Answer } from '@vue-skuilder/common';
import UserInput from './BaseUserInput';
import { defineComponent } from 'vue';

type InputNumberRefs = {
  input: HTMLInputElement;
};

type InputNumberInstance = ReturnType<typeof defineComponent> & {
  $refs: InputNumberRefs;
};

export default defineComponent({
  name: 'UserInputNumber',

  ref: {} as InputNumberRefs,

  extends: UserInput,

  methods: {
    mounted(this: InputNumberInstance) {
      this.$refs.input.focus();
    },

    isNumeric(s: string): boolean {
      return !isNaN(Number.parseFloat(s));
    },

    makeNumeric(num: Answer): number {
      if (typeof num === 'string') {
        return Number.parseFloat(num);
      } else {
        throw new Error('Expected a string, got ' + typeof num);
      }
    },
  },
});
</script>

<style scoped>
.userInput {
  border: none;
  text-align: center;
  border-bottom: 1px black;
}
</style>
