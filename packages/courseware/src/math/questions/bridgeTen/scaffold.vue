<template>
  <div data-viewable="BridgeTenScaffold" class="text-h5">
    <template v-if="question">
      {{ question.a }} + {{ question.b }} = {{ question.a }} + {{ question.toTen }} + ?
      <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { BridgeTen } from './index';
import { UserInputNumber, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'BridgeTenScaffold',

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
    const viewableUtils = useViewable(props, emit, 'BridgeTenScaffold');
    const questionUtils = useQuestionView<BridgeTen>(viewableUtils);

    const answer = ref('');

    questionUtils.question.value = new BridgeTen(props.data);
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
