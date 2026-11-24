<template>
  <div data-viewable="TrueFalse">
    <RadioMultipleChoice :choice-list="['True', 'False']" :submit="submit" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import RadioMultipleChoice from './RadioMultipleChoice.vue';

export default defineComponent({
  name: 'TrueFalse',
  components: {
    RadioMultipleChoice,
  },
  props: {
    submit: {
      type: Function as PropType<(selection: number) => void>,
      required: true,
    },
  },
});
</script>
