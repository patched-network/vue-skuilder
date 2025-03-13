<template>
  <div data-viewable="TrueFalse">
    <RadioSelect :choice-list="['True', 'False']" :MouseTrap="MouseTrap" :submit="submit" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import RadioSelect from './RadioMultipleChoice.vue';

export default defineComponent({
  name: 'TrueFalse',
  components: {
    RadioSelect,
  },
  props: {
    MouseTrap: {
      type: Object as PropType<any>,
      required: true,
    },
    submit: {
      type: Function as PropType<(selection: number) => void>,
      required: true,
    },
  },
});
</script>
