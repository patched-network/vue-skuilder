import { Displayable, Question, Answer } from '@/base-course/Course';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import { QuestionRecord, CardRecord } from '@/db/types';
import moment, { duration } from 'moment';
import MouseTrap from 'mousetrap';
import { Prop, Vue } from 'vue-property-decorator';
import { log } from 'util';

// @Component
export default abstract class Viewable extends Vue {
    @Prop() public data: ViewData[];
    protected startTime: moment.Moment = moment();
    protected MouseTrap: MousetrapInstance = new MouseTrap(this.$el);

    /**
     * Returns the time in milliseconds since the element was created
     */
    public get timeSpent(): number {
        return Math.abs(moment().diff(this.startTime, 'milliseconds'));
    }

    /**
     * Called when a user is finished with a card, and triggers
     * the display of new content.
     */
    protected emitResponse(r: CardRecord) {
        this.$emit('emitResponse', r);
    }
}

// tslint:disable-next-line:max-classes-per-file
export abstract class QuestionView<Q extends Question> extends Viewable {
    protected priorAttempts: number = 0; // starts at the 1st attempt
    public abstract get question(): Q;

    protected submitAnswer(answer: Answer) {
        log('QuestionView.submitAnswer called...');

        const record: QuestionRecord = {
            priorAttemps: this.priorAttempts,
            cardID: '',
            isCorrect: this.question.isCorrect(answer),
            timeSpent: this.timeSpent,
            timeStamp: this.startTime,
            userAnswer: answer
        };

        this.emitResponse(record);
    }
}

// tslint:disable-next-line:max-classes-per-file
export abstract class InformationView<D extends Displayable> extends Viewable {
    // is there anything to do here?
}
