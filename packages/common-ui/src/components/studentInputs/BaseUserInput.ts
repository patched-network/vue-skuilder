import { useCardPreviewModeStore } from '@/stores/useCardPreviewModeStore';
import { log } from '@vue-skuilder/common';
import { defineComponent } from 'vue';
import { ViewComponent } from '../../../base-course/Displayable';
import { Answer } from '@vue-skuilder/common';
// import { QuestionView } from '../../../base-course/CompositionViewable';
import { isQuestionView } from '@/base-course/CompositionViewable';
import { QuestionRecord } from '@vue-skuilder/db';

export default defineComponent({
  name: 'UserInput',
  data() {
    return {
      answer: '' as Answer,
      previewModeStore: useCardPreviewModeStore(),
    };
  },
  computed: {
    autofocus(): boolean {
      return !this.previewModeStore.previewMode;
    },
    autoFocus(): boolean {
      return this.autofocus;
    },
  },
  methods: {
    submitAnswer(answer: Answer): QuestionRecord {
      return this.submit(answer);
    },
    // isQuestionView(a: any): a is QuestionView<Question> {
    //   return (a as QuestionView<Question>).submitAnswer !== undefined;
    // },
    submit(answer: Answer) {
      return this.getQuestionViewAncestor().submitAnswer(answer, this.$options.name ?? 'UserInput');
    },
    getQuestionViewAncestor(): ViewComponent {
      let ancestor = this.$parent;
      let count = 0;

      while (ancestor && !isQuestionView(ancestor)) {
        const nextAncestor = ancestor.$parent;
        if (!nextAncestor) {
          const err = `
UserInput.submit() has failed.
The input element has no QuestionView ancestor element.`;
          log(err);
          throw new Error(err);
        }
        ancestor = nextAncestor;
        count++;

        if (count > 100) {
          const err = `
UserInput.submit() has failed.
Exceeded maximum ancestor lookup depth.`;
          log(err);
          throw new Error(err);
        }
      }

      if (!ancestor) {
        throw new Error('No QuestionView ancestor found');
      }

      return ancestor;
    },
  },
});
