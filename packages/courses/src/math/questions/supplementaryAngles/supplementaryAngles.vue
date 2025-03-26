<template>
  <div data-viewable="CalculateSupplementaryAngle">
    <h2>What is the measurement of the highlighted angle?</h2>
    <canvas ref="canvasRef" width="300" height="300"> </canvas>
    <br />
    <user-input-number v-model="answer" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount, PropType } from 'vue';
import { UserInputNumber, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { SupplementaryAngles } from './index';
import { randomInt, cos, sin } from '../../utility';
import paper from 'paper';
import { ViewData } from '@vue-skuilder/common';
import { nextTick } from 'vue';

export default defineComponent({
  name: 'CalculateSupplementaryAngle',

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
    const viewableUtils = useViewable(props, emit, 'CalculateSupplementaryAngle');
    const questionUtils = useQuestionView<SupplementaryAngles>(viewableUtils);

    const answer = ref('');
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const paperScope = ref<paper.PaperScope>();

    // Initialize question immediately
    questionUtils.question.value = new SupplementaryAngles(props.data);

    const getBisectingPoint = (
      p: paper.PaperScope,
      width: number,
      baseAngle: number,
      firstAngle: number,
      secondAngle: number,
      height: number,
      scale: number = 30
    ): paper.Point => {
      return new p.Point(
        width / 2 + scale * cos(baseAngle + (firstAngle + secondAngle) / 2),
        height / 2 + scale * sin(baseAngle + (firstAngle + secondAngle) / 2)
      );
    };

    onMounted(async () => {
      await nextTick();
      if (!canvasRef.value) return;

      paperScope.value = new paper.PaperScope();
      paperScope.value.setup(canvasRef.value);
      const p = paperScope.value;

      const width = canvasRef.value.width;
      const height = canvasRef.value.height;

      const baseAngle = randomInt(0, 360);

      const xOffset = width * cos(baseAngle);
      const yOffset = width * sin(baseAngle);

      const baseLine = new p.Path.Line({
        from: new p.Point(width / 2 + xOffset, height / 2 + yOffset),
        to: new p.Point(width / 2 - xOffset, height / 2 - yOffset),
      });
      baseLine.strokeColor = new paper.Color('black');

      let sum: number = 0;
      const armPaths: paper.Path[] = [];

      if (!questionUtils.question.value) return;

      for (let i = 0; i < questionUtils.question.value.angles.length; i++) {
        const currentAngle = questionUtils.question.value.angles[i];
        sum += currentAngle;

        console.log(`drawing angle ${i}:
          angle: ${currentAngle}
          angleSum: ${sum}
          `);

        let nextArm: number;
        const thisArm: number = sum - currentAngle;
        if (i === questionUtils.question.value.angles.length - 1) {
          nextArm = 180;
        } else {
          nextArm = sum;
        }

        const firstArm: paper.Point = new p.Point(
          width / 2 + 30 * cos(baseAngle + thisArm),
          height / 2 + 30 * sin(baseAngle + thisArm)
        );
        const middleArm: paper.Point = getBisectingPoint(p, width, baseAngle, thisArm, nextArm, height);
        const secondArm: paper.Point = new p.Point(
          width / 2 + 30 * cos(baseAngle + nextArm),
          height / 2 + 30 * sin(baseAngle + nextArm)
        );

        const xOff = width * cos(baseAngle + sum);
        const yOff = width * sin(baseAngle + sum);

        const angleLine = new p.Path.Line({
          from: new p.Point(width / 2, height / 2),
          to: new p.Point(width / 2 + xOff, height / 2 + yOff),
        });
        angleLine.strokeColor = new paper.Color(0, 0, 0);
        armPaths.push(angleLine);

        if (questionUtils.question.value.targetAngleIndex === i) {
          console.log(`drawing targetAngle at i = ${i}:
            baseAngle: ${baseAngle}
            targetAngle: ${currentAngle}
            sum: ${sum}
            nextAngle: ${nextArm}
            `);

          const fill = new paper.Color(0.1, 0.5, 0.8, 0.35);

          const arc = new p.Path.Arc({
            from: firstArm,
            through: middleArm,
            to: secondArm,
          });
          arc.strokeColor = new paper.Color(0.1, 0.5, 0.8, 0.75);
          arc.strokeWidth = 3;
          arc.fillColor = fill;

          const triangle = new p.Path();
          triangle.closed = true;
          triangle.add(firstArm);
          triangle.add(new paper.Point(width / 2, height / 2));
          triangle.add(secondArm);
          triangle.fillColor = fill;
        } else {
          const measure = new paper.PointText(middleArm);
          measure.content = currentAngle.toString() + '°';

          let intersection: boolean = true;
          let scale: number = 20;

          while (intersection) {
            intersection = false;
            measure.bounds!.center = getBisectingPoint(p, width, baseAngle, thisArm, nextArm, height, scale);
            armPaths.forEach((path) => {
              if (path.intersects(measure)) {
                intersection = true;
              }
            });
            scale += 7;
          }
        }
      }
    });

    onBeforeUnmount(() => {
      paperScope.value = undefined;
    });

    return {
      answer,
      canvasRef,
      ...viewableUtils,
      ...questionUtils,
    };
  },
});
</script>

<style lang="css" scoped>
canvas {
  display: block;
  margin-left: auto;
  margin-right: auto;
  padding: 10px;
}
</style>
