// src/base-course/CompositionViewable.ts

import moment from 'moment';
import { computed, ComputedRef, ref, Ref } from 'vue';
import { CardRecord, QuestionRecord } from '@vue-skuilder/db';
import { HotKey } from '../utils/SkldrMouseTrap';
import { Question } from './Displayable';
import { ViewData, Answer } from '@vue-skuilder/common';

// Core interfaces to ensure type safety
export interface ViewableUtils {
  startTime: Ref<moment.Moment>;
  hotKeys: Ref<HotKey[]>;
  timeSpent: ComputedRef<number>;
  logger: ViewableLogger;
  getURL: (item: string, dataShapeIndex?: number) => string;
  emitResponse: (record: CardRecord) => void;
}

export interface ViewableLogger {
  log: (message?: unknown, ...params: unknown[]) => void;
  error: (message?: unknown, ...params: unknown[]) => void;
  warn: (message?: unknown, ...params: unknown[]) => void;
}

export interface QuestionViewUtils<Q extends Question> {
  priorSessionViews: Ref<number>;
  priorAttempts: Ref<number>;
  priorAnswers: Ref<[Answer, string][]>;
  maxAttemptsPerView: Ref<number>;
  maxSessionViews: Ref<number>;
  question: Ref<Q | undefined>;
  submitAnswer: (answer: Answer, submittingClass?: string) => QuestionRecord;
}

// Base composable for viewable functionality
export function useViewable(
  props: { data: ViewData[] },
  emit: (event: string, ...args: unknown[]) => void,
  componentName: string
): ViewableUtils {
  const startTime = ref(moment.utc());
  const hotKeys = ref<HotKey[]>([]);

  const logger: ViewableLogger = {
    log: (message?: unknown, ...params: unknown[]) =>
      console.log(`[${componentName}]: `, message, ...params),
    error: (message?: unknown, ...params: unknown[]) =>
      console.error(`[${componentName}]: `, message, ...params),
    warn: (message?: unknown, ...params: unknown[]) =>
      console.warn(`[${componentName}]: `, message, ...params),
  };

  const timeSpent = computed(() => Math.abs(moment.utc().diff(startTime.value, 'milliseconds')));

  const getURL = (item: string, dataShapeIndex = 0): string => {
    try {
      if (props.data[dataShapeIndex]?.[item]) {
        return URL.createObjectURL(props.data[dataShapeIndex][item] as Blob);
      }
    } catch (error) {
      logger.error('Error creating URL for item:', item, error);
    }
    return '';
  };

  const emitResponse = (record: CardRecord) => {
    emit('emitResponse', record);
  };

  return {
    startTime,
    hotKeys,
    timeSpent,
    logger,
    getURL,
    emitResponse,
  };
}

// Question view composable
export function useQuestionView<Q extends Question>(
  viewableUtils: ViewableUtils
  // modifyDifficulty?: number
): QuestionViewUtils<Q> {
  const priorSessionViews = ref(0);
  const priorAttempts = ref(0);
  const priorAnswers = ref<[Answer, string][]>([]);
  const maxAttemptsPerView = ref(3);
  const maxSessionViews = ref(2);
  const question = ref<Q>();

  const submitAnswer = (answer: Answer, submittingClass?: string): QuestionRecord => {
    viewableUtils.logger.log('submitAnswer called...');

    if (!question.value) {
      throw new Error('Question not initialized');
    }

    priorAnswers.value.push([answer, submittingClass ?? '']);

    const evaluation = question.value.evaluate(answer, viewableUtils.timeSpent.value);

    viewableUtils.logger.log(`evaluation of answer ${answer}:`, evaluation);

    const record: QuestionRecord = {
      ...evaluation,
      priorAttemps: priorAttempts.value,
      courseID: '',
      cardID: '',
      timeSpent: viewableUtils.timeSpent.value,
      timeStamp: viewableUtils.startTime.value,
      userAnswer: answer,
    };

    if (!evaluation.isCorrect) {
      priorAttempts.value++;
    }

    viewableUtils.emitResponse(record);
    return record;
  };

  return {
    priorSessionViews,
    priorAttempts,
    priorAnswers,
    maxAttemptsPerView,
    maxSessionViews,
    question,
    submitAnswer,
  };
}

// Helper functions
export function isQuestionView(component: unknown): component is QuestionViewUtils<Question> {
  return (
    typeof component === 'object' &&
    component !== null &&
    'submitAnswer' in component &&
    'priorAttempts' in component
  );
}

// Example usage in a child component:
/*
import { defineComponent, PropType } from 'vue';
import { useViewable, useQuestionView } from './CompositionViewable';
import { MyCustomQuestion } from './types';

export default defineComponent({
  name: 'MyCustomQuestionView',
  props: {
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
    modifyDifficulty: Number,
  },
  setup(props, { emit }) {
    const viewableUtils = useViewable(props, emit, 'MyCustomQuestionView');
    const questionUtils = useQuestionView<MyCustomQuestion>(viewableUtils, props.modifyDifficulty);

    // Initialize question
    questionUtils.question.value = new MyCustomQuestion(props.data);

    // Add custom logic here
    const customMethod = () => {
      viewableUtils.logger.log('Custom method called');
      // ...
    };

    return {
      ...viewableUtils,
      ...questionUtils,
      customMethod,
    };
  },
  template: `
    <div data-viewable="MyCustomQuestionView">
      <!-- Your template here -->
    </div>
  `
});
*/
