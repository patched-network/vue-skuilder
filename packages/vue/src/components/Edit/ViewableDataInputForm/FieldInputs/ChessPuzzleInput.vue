<template>
  <v-text-field
    ref="inputField"
    v-model="modelValue"
    variant="filled"
    :name="field.name"
    :label="field.name"
    :rules="vuetifyRules()"
    :autofocus="autofocus"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FieldInput from '../OptionsFieldInput';
import { CourseElo } from '@vue-skuilder/common';
// import { FieldDefinition } from '../../../../base-course/Interfaces/FieldDefinition';

export default defineComponent({
  name: 'ChessPuzzleInput',
  extends: FieldInput,

  setup(props, ctx) {
    // Get all the setup logic from parent
    const parentSetup = FieldInput.setup?.(props, ctx);

    const generateELO = () => {
      if (!parentSetup) {
        return;
      }

      const split = (parentSetup.modelValue.value as string).split(',');
      const elo = parseInt(split[3]);
      const count = parseInt(split[6]);

      const crsElo: CourseElo = {
        global: {
          score: elo,
          count,
        },
        tags: {},
        misc: {},
      };

      const tags = generateTags();
      tags.forEach((t) => {
        crsElo.tags[t] = {
          score: elo,
          count,
        };
      });

      console.log('generateELO', JSON.stringify(crsElo));

      return crsElo;
    };

    const generateTags = () => {
      if (!parentSetup) {
        return [];
      }

      console.log(`CPI.generateTags: modelValue: ${parentSetup.modelValue.value}`);

      const split = (parentSetup.modelValue.value as string).split(',');
      const themes = split[7].split(' ');
      const openingTags = split[9].split(' ');

      return themes.map((t) => `theme-${t}`).concat(openingTags.map((t) => `opening-${t}`));
    };

    return {
      ...parentSetup,
      generateELO,
      generateTags,
    };
  },
});
</script>
