<template>
  <div data-viewable="TrueFalse">
    {{ question.a }} &equals; {{ question.b }}

    <TFSelect :submit="submit" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from 'vue';
import { useViewable, useQuestionView } from '@/base-course/CompositionViewable';
import { EqualityTest } from './index';
import TFSelect from '@/base-course/Components/TrueFalse.vue';
import { ViewData } from '@/base-course/Interfaces/ViewData';

export default defineComponent({
  name: 'TrueFalse',

  components: {
    TFSelect,
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
    const viewableUtils = useViewable(props, emit, 'TrueFalse');
    const questionUtils = useQuestionView<EqualityTest>(viewableUtils, props.modifyDifficulty);

    // Initialize question
    questionUtils.question.value = new EqualityTest(props.data);

    const question = computed(() => new EqualityTest(props.data));

    const submit = (selection: number) => {
      alert(question.value.isCorrect(selection === 0));
    };

    return {
      question,
      submit,
    };
  },
});
</script>
