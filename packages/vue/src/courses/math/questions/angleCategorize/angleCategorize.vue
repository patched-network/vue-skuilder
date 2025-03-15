<template>
  <div data-viewable="AngleCategorizeV">
    <template v-if="question">
      <h2>What kind of angle is this?</h2>
      <canvas ref="canvasRef" width="300" height="300"> </canvas>

      <radio-multiple-choice :choice-list="question.answers" :mouse-trap="mouseTrap" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, PropType } from 'vue';
import { RadioMultipleChoice, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { AngleCategorize, AngleCategories } from './index';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import { randomInt } from '../../utility';

export default defineComponent({
  name: 'AngleCategorizeV',

  components: {
    RadioMultipleChoice,
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
    const viewableUtils = useViewable(props, emit, 'AngleCategorizeV');
    const questionUtils = useQuestionView<AngleCategorize>(viewableUtils, props.modifyDifficulty);
    const canvasRef = ref<HTMLCanvasElement | null>(null);

    // Initialize question immediately
    questionUtils.question.value = new AngleCategorize(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const angle = computed(() => {
      if (!question.value) return 0;

      const category = question.value.angleCategory;
      if (category === AngleCategories.ACUTE) {
        return randomInt(10, 83);
      } else if (category === AngleCategories.RIGHT) {
        return 90;
      } else if (category === AngleCategories.OBTUSE) {
        return randomInt(97, 173);
      } else if (category === AngleCategories.STRAIGHT) {
        return 180;
      } else if (category === AngleCategories.REFLEX) {
        return randomInt(190, 350);
      } else {
        throw new Error('Unknown Angle type on AngleCategorize question');
      }
    });

    onMounted(() => {
      if (!canvasRef.value) return;

      const width = canvasRef.value.width;
      const height = canvasRef.value.height;
      const ctx = canvasRef.value.getContext('2d');
      if (!ctx) return;

      const baseArm = randomInt(0, 360);
      const otherArm = baseArm + angle.value;

      ctx.moveTo(width / 2, height / 2);
      const x = width / 2 + width * Math.cos((baseArm / 360) * 2 * Math.PI);
      const y = height / 2 + width * Math.sin((baseArm / 360) * 2 * Math.PI);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.moveTo(width / 2, height / 2);
      const x2 = width / 2 + width * Math.cos((otherArm / 360) * 2 * Math.PI);
      const y2 = height / 2 + width * Math.sin((otherArm / 360) * 2 * Math.PI);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.moveTo(width / 2, height / 2);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 25, (baseArm / 360) * 2 * Math.PI, (otherArm / 360) * 2 * Math.PI);
      ctx.stroke();
    });

    return {
      ...viewableUtils,
      ...questionUtils,
      canvasRef,
      question,
    };
  },
});
</script>

<style lang="css" scoped>
#canvas {
  display: block;
  margin-left: auto;
  margin-right: auto;
}
</style>
