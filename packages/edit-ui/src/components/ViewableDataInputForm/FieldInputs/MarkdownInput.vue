<template>
  <v-textarea
    ref="inputField"
    v-model="modelValue"
    variant="filled"
    :name="field.name"
    :label="field.name"
    :rules="vuetifyRules()"
    :hint="validationStatus.msg"
    :autofocus="autofocus"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FieldInput from './OptionsFieldInput';

export default defineComponent({
  name: 'MarkdownInput',
  extends: FieldInput,
  setup(props, ctx) {
    // Get all the setup logic from parent
    const parentSetup = FieldInput.setup?.(props, ctx);

    return {
      ...parentSetup,
    };
  },
});
</script>

<style scoped>
/* @import url('https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.css'); */
</style>
