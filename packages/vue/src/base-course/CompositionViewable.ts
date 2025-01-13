// src/base-course/CompositionViewable.ts

import moment from 'moment';
import MouseTrap from 'mousetrap';
import {
  defineComponent,
  PropType,
  ref,
  computed,
  Ref,
  onMounted,
  onUnmounted,
  ComputedRef,
} from 'vue';
import { HotKey } from '../SkldrMouseTrap';
import { Answer, Displayable, Question } from './Displayable';
import { ViewData } from './Interfaces/ViewData';
import { CardRecord, QuestionRecord } from '../db/types';
import { Viewable } from './OptionsViewable';

// Core interfaces to ensure type safety
export interface ViewableUtils {
  startTime: Ref<moment.Moment>;
  mouseTrap: Ref<MouseTrap.MousetrapInstance | undefined>;
  hotKeys: Ref<HotKey[]>;
  timeSpent: ComputedRef<number>;
  logger: ViewableLogger;
  getURL: (item: string, dataShapeIndex?: number) => string;
  emitResponse: (record: CardRecord) => void;
}

export interface ViewableLogger {
  log: (message?: any, ...params: any[]) => void;
  error: (message?: any, ...params: any[]) => void;
  warn: (message?: any, ...params: any[]) => void;
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
  emit: (event: string, ...args: any[]) => void,
  componentName: string
): ViewableUtils {
  const startTime = ref(moment.utc());
  const mouseTrap = ref<MouseTrap.MousetrapInstance>();
  const hotKeys = ref<HotKey[]>([]);

  // Initialize MouseTrap
  onMounted(() => {
    const el = document.querySelector(`[data-viewable="${componentName}"]`);
    if (el) {
      mouseTrap.value = new MouseTrap(el);
    } else {
      console.warn(`[${componentName}]: Could not find element for MouseTrap initialization`);
    }
  });

  // Cleanup
  onUnmounted(() => {
    if (mouseTrap.value) {
      mouseTrap.value.reset();
    }
  });

  const logger: ViewableLogger = {
    log: (message?: any, ...params: any[]) =>
      console.log(`[${componentName}]: `, message, ...params),
    error: (message?: any, ...params: any[]) =>
      console.error(`[${componentName}]: `, message, ...params),
    warn: (message?: any, ...params: any[]) =>
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
    mouseTrap,
    hotKeys,
    timeSpent,
    logger,
    getURL,
    emitResponse,
  };
}

// Question view composable
export function useQuestionView<Q extends Question>(
  viewableUtils: ViewableUtils,
  modifyDifficulty?: number
): QuestionViewUtils<Q> {
  const priorSessionViews = ref(0);
  const priorAttempts = ref(0);
  const priorAnswers = ref<[Answer, string][]>([]);
  const maxAttemptsPerView = ref(3);
  const maxSessionViews = ref(1);
  const question = ref<Q>();

  const submitAnswer = (answer: Answer, submittingClass?: string): QuestionRecord => {
    viewableUtils.logger.log('submitAnswer called...');

    if (!question.value) {
      throw new Error('Question not initialized');
    }

    priorAnswers.value.push([answer, submittingClass ?? '']);

    const evaluation = question.value.evaluate(answer, viewableUtils.timeSpent.value);

    viewableUtils.logger.log('evaluation:', evaluation);

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

// Information view composable
export function useInformationView<D extends Displayable>() {
  const displayable = ref<D>();

  return {
    displayable,
  };
}

// Base component definitions that can be extended
export const ViewableComponent = defineComponent({
  name: 'ViewableComponent',
  props: {
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
  },
  setup(props, { emit }) {
    return useViewable(props, emit, 'ViewableComponent');
  },
});

export const QuestionViewComponent = defineComponent({
  name: 'QuestionViewComponent',
  props: {
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
    modifyDifficulty: Number,
  },
  setup(props, { emit }) {
    const viewableUtils = useViewable(props, emit, 'QuestionViewComponent');
    const questionUtils = useQuestionView(viewableUtils, props.modifyDifficulty);

    return {
      ...viewableUtils,
      ...questionUtils,
    };
  },
});

// Helper functions
export function isQuestionView(component: any): component is QuestionViewUtils<Question> {
  return 'submitAnswer' in component && 'priorAttempts' in component;
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
