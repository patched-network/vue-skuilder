<template>
  <div data-viewable="NumberBondSplit" class="text-h5">
    <template v-if="question">
      {{ question.whole }} = {{ question.part }} + ?
      <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { NumberBond } from './index';
import { UserInputNumber, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'NumberBondSplit',

  components: {
    UserInputNumber,
  },

  props: {
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
    modifyDifficulty: {
      type: Number,
      required: false,
      default: 0,
    },
  },

  setup(props, { emit }) {
    const viewableUtils = useViewable(props, emit, 'NumberBondSplit');
    const questionUtils = useQuestionView<NumberBond>(viewableUtils);

    const answer = ref('');

    questionUtils.question.value = new NumberBond(props.data);
    const question = computed(() => questionUtils.question.value);

    return {
      ...viewableUtils,
      ...questionUtils,
      answer,
      question,
    };
  },
});
</script>
