<template>
  <div data-viewable="DecadeFactHorizontal" class="text-h5">
    <template v-if="question">
      {{ question.a }} {{ question.symbol }} {{ question.b }} =
      <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { DecadeFact } from './index';
import { UserInputNumber, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'DecadeFactHorizontal',

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
    const viewableUtils = useViewable(props, emit, 'DecadeFactHorizontal');
    const questionUtils = useQuestionView<DecadeFact>(viewableUtils);

    const answer = ref('');

    questionUtils.question.value = new DecadeFact(props.data);
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
