import { Prop, Vue } from 'vue-property-decorator';
import { Answer, Question } from '@/base-course/Displayable';
import { QuestionView } from '@/base-course/Viewable';
import { log } from 'util';

export default abstract class UserInput extends Vue {
    /**
     * This is the .submitAnswer from the parent
     */
    protected submitAnswer: (answer: Answer) => void = this.submit;

    protected answer: Answer = '';

    /**
     * Use this lifecycle method to apply focus()
     * to the input element.
     */
    public abstract mounted(): void;

    private isQuestionView(a: any): a is QuestionView<Question> {
        return (a as QuestionView<Question>).submitAnswer !== undefined;
    }

    private submit(answer: Answer) {
        return this.getQuestionViewAncestor().submitAnswer(answer);
    }

    private getQuestionViewAncestor(): QuestionView<Question> {
        let ancestor = this.$parent;

        let count = 0;

        while (!this.isQuestionView(ancestor)) {
            ancestor = ancestor.$parent;
            count++;

            if (count > 100) {
                const err: string =
                    `
UserInput.submit() has failed.
The input element has no QuestionView ancestor element.`;
                log(err);
                throw new Error(err);
            }
        }

        return ancestor;
    }

}
