<template>
  <div v-if="sessionPrepared" class="StudySession">
    <v-row align="center">
      <!-- <h1 class="text-h3" v-if="courseNames[courseID]">{{ courseNames[courseID] }}:</h1> -->
      <v-spacer></v-spacer>
      <v-progress-circular v-if="loading" color="primary" indeterminate size="32" width="4" />
    </v-row>

    <br />

    <div v-if="sessionFinished" class="text-h4">
      <p>Study session finished! Great job!</p>
      <p v-if="sessionController">{{ sessionController.report }}</p>
      <p>
        Start <a @click="$emit('session-finished')">another study session</a>, or try
        <router-link :to="`/edit/${courseID}`">adding some new content</router-link> to challenge yourself and others!
      </p>
      <heat-map :activity-records-getter="() => user.getActivityRecords()" />
    </div>

    <div v-else ref="shadowWrapper">
      <card-viewer
        ref="cardViewer"
        :class="loading ? 'muted' : ''"
        :view="view"
        :data="data"
        :card_id="cardID"
        :course_id="courseID"
        :session-order="cardCount"
        :user_elo="user_elo(courseID)"
        :card_elo="card_elo"
        @emit-response="processResponse($event)"
      />
    </div>

    <br />
    <div v-if="sessionController">
      <span v-for="i in sessionController.failedCount" :key="i" class="text-h5">•</span>
    </div>

    <!--
      todo: reinstate tag editing at session-time ?

    <div v-if="!sessionFinished && editTags">
      <p>Add tags to this card:</p>
      <sk-tags-input :course-i-d="courseID" :card-i-d="cardID" />
    </div> -->

    <v-row align="center" class="footer-controls pa-5">
      <v-col cols="auto" class="d-flex flex-grow-0 mr-auto">
        <StudySessionTimer
          :time-remaining="timeRemaining"
          :session-time-limit="sessionTimeLimit"
          @add-time="incrementSessionClock"
        />
      </v-col>

      <v-spacer></v-spacer>

      <v-col cols="auto" class="footer-right">
        <SkMouseTrap />
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { defineComponent, markRaw, PropType } from 'vue';
import { ViewComponent } from '../composables';
import { isQuestionView } from '../composables/CompositionViewable';
import HeatMap from './HeatMap.vue';
import SkMouseTrap from './SkMouseTrap.vue';
import { alertUser } from './SnackbarService';
import StudySessionTimer from './StudySessionTimer.vue';
import CardViewer from './cardRendering/CardViewer.vue';

import { CourseElo, Status, toCourseElo, ViewData } from '@vue-skuilder/common';
import {
  CardHistory,
  CardRecord,
  ClassroomDBInterface,
  ContentSourceID,
  CourseRegistrationDoc,
  DataLayerProvider,
  docIsDeleted,
  getStudySource,
  HydratedCard,
  isQuestionRecord,
  isReview,
  ResponseResult,
  SessionController,
  StudyContentSource,
  StudySessionRecord,
  UserDBInterface,
} from '@vue-skuilder/db';
import confetti from 'canvas-confetti';

import { StudySessionConfig } from './StudySession.types';

interface StudyRefs {
  shadowWrapper: HTMLDivElement;
  cardViewer: InstanceType<typeof CardViewer>;
}

type StudyInstance = ReturnType<typeof defineComponent> & {
  $refs: StudyRefs;
};

export default defineComponent({
  name: 'StudySession',

  ref: {} as StudyRefs,

  components: {
    CardViewer,
    StudySessionTimer,
    SkMouseTrap,
    HeatMap,
  },

  props: {
    sessionTimeLimit: {
      type: Number,
      required: true,
    },
    contentSources: {
      type: Array as PropType<ContentSourceID[]>,
      required: true,
    },
    user: {
      type: Object as PropType<UserDBInterface>,
      required: true,
    },
    dataLayer: {
      type: Object as PropType<DataLayerProvider>,
      required: true,
    },
    sessionConfig: {
      type: Object as PropType<StudySessionConfig>,
      default: () => ({ likesConfetti: false }),
    },
    getViewComponent: {
      type: Function as PropType<(viewId: string) => ViewComponent>,
      required: true,
    },
  },

  emits: [
    'session-finished',
    'session-started',
    'card-loaded',
    'card-response',
    'time-changed',
    'session-prepared',
    'session-error',
  ],

  data() {
    return {
      // editTags: false,
      cardID: '',
      view: null as ViewComponent | null,
      data: [] as ViewData[],
      courseID: '',
      card_elo: 1000,
      courseNames: {} as { [courseID: string]: string },
      cardCount: 1,
      sessionController: null as SessionController<ViewComponent> | null,
      sessionPrepared: false,
      sessionFinished: false,
      sessionRecord: [] as StudySessionRecord[],
      percentageRemaining: 100,
      timerIsActive: true,
      loading: false,
      userCourseRegDoc: null as CourseRegistrationDoc | null,
      sessionContentSources: [] as StudyContentSource[],
      timeRemaining: 300, // 5 minutes * 60 seconds
      intervalHandler: null as NodeJS.Timeout | null,
      cardType: '',
    };
  },

  computed: {
    currentCard(): StudySessionRecord {
      return this.sessionRecord[this.sessionRecord.length - 1];
    },
  },

  // watch: {
  //   editCard: {
  //     async handler(value: boolean) {
  //       if (value) {
  //         this.dataInputFormStore.dataInputForm.dataShape = await getCardDataShape(this.courseID, this.cardID);

  //         const cfg = await getCredentialledCourseConfig(this.courseID);
  //         this.dataInputFormStore.dataInputForm.course = cfg!;

  //         this.editCardReady = true;

  //         for (const oldField in this.dataInputFormStore.dataInputForm.localStore) {
  //           if (oldField) {
  //             console.log(`[Study] Removing old data: ${oldField}`);
  //             delete this.dataInputFormStore.dataInputForm.localStore[oldField];
  //           }
  //         }

  //         for (const field in this.data[0]) {
  //           if (field) {
  //             console.log(`[Study] Writing ${field}: ${this.data[0][field]} to the dataInputForm state...`);
  //             this.dataInputFormStore.dataInputForm.localStore[field] = this.data[0][field];
  //           }
  //         }
  //       } else {
  //         this.editCardReady = false;
  //       }
  //     },
  //   },
  // },

  async created() {
    this.userCourseRegDoc = await this.user.getCourseRegistrationsDoc();
    console.log('[StudySession] Created lifecycle hook - starting initSession');
    await this.initSession();
    console.log('[StudySession] InitSession completed in created hook');
  },

  methods: {
    user_elo(courseID: string): CourseElo {
      const courseDoc = this.userCourseRegDoc!.courses.find((c) => c.courseID === courseID);
      if (courseDoc) {
        return toCourseElo(courseDoc.elo);
      }
      return toCourseElo(undefined);
    },

    handleClassroomMessage() {
      return (v: unknown) => {
        alertUser({
          text: this.user?.getUsername() || '[Unknown user]',
          status: Status.ok,
        });
        console.log(`[StudySession] There was a change in the classroom DB:`);
        console.log(`[StudySession] change: ${v}`);
        console.log(`[StudySession] Stringified change: ${JSON.stringify(v)}`);
        return {};
      };
    },

    incrementSessionClock() {
      const max = 60 * this.sessionTimeLimit - this.timeRemaining;
      this.sessionController!.addTime(Math.min(max, 60));
      this.tick();
    },

    tick() {
      this.timeRemaining = this.sessionController!.secondsRemaining;

      this.percentageRemaining =
        this.timeRemaining > 60
          ? 100 * (this.timeRemaining / (60 * this.sessionTimeLimit))
          : 100 * (this.timeRemaining / 60);

      this.$emit('time-changed', this.timeRemaining);

      if (this.timeRemaining === 0) {
        clearInterval(this.intervalHandler!);
      }
    },

    async initSession() {
      let sessionClassroomDBs: ClassroomDBInterface[] = [];
      try {
        console.log(`[StudySession] starting study session w/ sources: ${JSON.stringify(this.contentSources)}`);
        console.log('[StudySession] Beginning preparation process');

        this.sessionContentSources = markRaw(
          (
            await Promise.all(
              this.contentSources.map(async (s) => {
                try {
                  return await getStudySource(s, this.user);
                } catch (e) {
                  console.error(`Failed to load study source: ${s.type}/${s.id}`, e);
                  return null;
                }
              })
            )
          ).filter((s: unknown) => s !== null)
        );

        this.timeRemaining = this.sessionTimeLimit * 60;

        sessionClassroomDBs = await Promise.all(
          this.contentSources
            .filter((s) => s.type === 'classroom')
            .map(async (c) => await this.dataLayer.getClassroomDB(c.id, 'student'))
        );

        sessionClassroomDBs.forEach((_db) => {
          // db.setChangeFcn(this.handleClassroomMessage());
        });

        this.sessionController = markRaw(
          new SessionController<ViewComponent>(
            this.sessionContentSources,
            60 * this.sessionTimeLimit,
            this.dataLayer,
            this.getViewComponent
          )
        );
        this.sessionController.sessionRecord = this.sessionRecord;

        await this.sessionController.prepareSession();
        this.intervalHandler = setInterval(this.tick, 1000);

        this.sessionPrepared = true;

        console.log('[StudySession] Session preparation complete, emitting session-prepared event');
        this.$emit('session-prepared');
        console.log('[StudySession] Event emission completed');
      } catch (error) {
        console.error('[StudySession] Error during session preparation:', error);
        // Notify parent component about the error
        this.$emit('session-error', { message: 'Failed to prepare study session', error });
      }

      try {
        this.contentSources
          .filter((s) => s.type === 'course')
          .forEach(
            async (c) => (this.courseNames[c.id] = (await this.dataLayer.getCoursesDB().getCourseConfig(c.id)).name)
          );

        console.log(`[StudySession] Session created:
          ${this.sessionController?.toString() || 'Session controller not initialized'}
          User courses: ${this.contentSources
            .filter((s) => s.type === 'course')
            .map((c) => c.id)
            .toString()}
          User classrooms: ${sessionClassroomDBs.map((db: any) => db._id).toString() || 'No classrooms'}
        `);
      } catch (error) {
        console.error('[StudySession] Error during final session setup:', error);
      }

      if (this.sessionController) {
        try {
          this.$emit('session-started');
          this.loadCard(await this.sessionController.nextCard());
        } catch (error) {
          console.error('[StudySession] Error loading next card:', error);
          this.$emit('session-error', { message: 'Failed to load study card', error });
        }
      } else {
        console.error('[StudySession] Cannot load card: session controller not initialized');
        this.$emit('session-error', { message: 'Study session initialization failed' });
      }
    },

    countCardViews(course_id: string, card_id: string): number {
      return this.sessionRecord.filter((r) => r.card.course_id === course_id && r.card.card_id === card_id).length;
    },

    async processResponse(this: StudyInstance, r: CardRecord) {
      this.$emit('card-response', r);

      this.timerIsActive = true;

      r.cardID = this.cardID;
      r.courseID = this.courseID;
      this.currentCard.records.push(r);

      console.log(`[StudySession] StudySession.processResponse is running...`);
      const cardHistory = this.logCardRecord(r);

      // Get view constraints for response processing
      let maxAttemptsPerView = 1;
      let maxSessionViews = 1;
      if (isQuestionView(this.$refs.cardViewer?.$refs.activeView)) {
        const view = this.$refs.cardViewer.$refs.activeView;
        maxAttemptsPerView = view.maxAttemptsPerView;
        maxSessionViews = view.maxSessionViews;
      }
      const sessionViews = this.countCardViews(this.courseID, this.cardID);

      // Process response through SessionController
      const result: ResponseResult = await this.sessionController!.submitResponse(
        r,
        cardHistory,
        this.userCourseRegDoc!,
        this.currentCard,
        this.courseID,
        this.cardID,
        maxAttemptsPerView,
        maxSessionViews,
        sessionViews
      );

      // Handle UI feedback based on result
      this.handleUIFeedback(result);

      // Handle navigation based on result
      if (result.shouldLoadNextCard) {
        this.loadCard(await this.sessionController!.nextCard(result.nextCardAction));
      }

      // Clear feedback shadow if requested
      if (result.shouldClearFeedbackShadow) {
        this.clearFeedbackShadow();
      }
    },

    handleUIFeedback(result: ResponseResult) {
      if (result.isCorrect) {
        // Handle correct response UI
        try {
          if (this.$refs.shadowWrapper && result.performanceScore !== undefined) {
            this.$refs.shadowWrapper.setAttribute(
              'style',
              `--r: ${255 * (1 - result.performanceScore)}; --g:${255}`
            );
            this.$refs.shadowWrapper.classList.add('correct');
          }
        } catch (e) {
          console.warn(`[StudySession] Error setting shadowWrapper style: ${e}`);
        }

        // Show confetti for correct responses
        if (this.sessionConfig.likesConfetti) {
          confetti({
            origin: {
              y: 1,
              x: 0.25 + 0.5 * Math.random(),
            },
            disableForReducedMotion: true,
            angle: 60 + 60 * Math.random(),
          });
        }
      } else {
        // Handle incorrect response UI
        try {
          if (this.$refs.shadowWrapper) {
            this.$refs.shadowWrapper.classList.add('incorrect');
          }
        } catch (e) {
          console.warn(`[StudySession] Error setting shadowWrapper style: ${e}`);
        }
      }
    },

    clearFeedbackShadow() {
      setTimeout(() => {
        try {
          if (this.$refs.shadowWrapper) {
            (this.$refs.shadowWrapper as HTMLElement).classList.remove('correct', 'incorrect');
          }
        } catch (e) {
          // swallow error
          console.warn(`[StudySession] Error clearing shadowWrapper style: ${e}`);
        }
      }, 1250);
    },

    async logCardRecord(r: CardRecord): Promise<CardHistory<CardRecord>> {
      return await this.user!.putCardRecord(r);
    },

    async loadCard(card: HydratedCard | null) {
      if (this.loading) {
        console.warn(`Attempted to load card while loading another...`);
        return;
      }

      console.log(`[StudySession] loading: ${JSON.stringify(card)}`);
      if (card === null) {
        this.sessionFinished = true;
        this.$emit('session-finished', this.sessionRecord);
        return;
      }
      this.cardType = card.item.status;

      this.loading = true;

      try {
        this.cardCount++;
        this.data = card.data;
        this.view = markRaw(card.view);
        this.cardID = card.item.cardID;
        this.courseID = card.item.courseID;
        this.card_elo = card.item.elo || 1000;

        this.sessionRecord.push({
          card: {
            course_id: card.item.courseID,
            card_id: card.item.cardID,
            card_elo: this.card_elo,
          },
          item: card.item,
          records: [],
        });

        this.$emit('card-loaded', {
          courseID: card.item.courseID,
          cardID: card.item.cardID,
          cardCount: this.cardCount,
        });
      } catch (e) {
        console.warn(`[StudySession] Error loading card ${JSON.stringify(card)}:\n\t${JSON.stringify(e)}, ${e}`);
        this.loading = false;

        const err = e as Error;
        if (docIsDeleted(err) && isReview(card.item)) {
          console.warn(`Card was deleted: ${card.item.courseID}::${card.item.cardID}`);
          this.user!.removeScheduledCardReview((card.item as any).reviewID);
        }

        this.loadCard(await this.sessionController!.nextCard('dismiss-error'));
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>

<style scoped>
.footer-controls {
  position: fixed;
  bottom: 0;
  background-color: var(--v-background); /* Match your app's background color */
  z-index: 100;
}

.footer-right {
  position: fixed;
  bottom: 0;
  right: 0;
  background-color: var(--v-background); /* Match your app's background color */
  z-index: 100;
}

.correct {
  animation: varFade 1250ms ease-out;
}

.incorrect {
  animation: purpleFade 1250ms ease-out;
}

a {
  text-decoration: underline;
}

@keyframes varFade {
  0% {
    box-shadow:
      rgba(var(--r), var(--g), 0, 0.25) 0px 7px 8px -4px,
      rgba(var(--r), var(--g), 0, 0.25) 0px 12px 17px 2px,
      rgba(var(--r), var(--g), 0, 0.25) 0px 5px 22px 4px;
  }
  100% {
    box-shadow: rgba(0, 150, 0, 0) 0px 0px;
  }
}

@keyframes greenFade {
  0% {
    box-shadow:
      rgba(0, 150, 0, 0.25) 0px 7px 8px -4px,
      rgba(0, 150, 0, 0.25) 0px 12px 17px 2px,
      rgba(0, 150, 0, 0.25) 0px 5px 22px 4px;
  }
  100% {
    box-shadow: rgba(0, 150, 0, 0) 0px 0px;
  }
}
@keyframes purpleFade {
  0% {
    box-shadow:
      rgba(115, 0, 75, 0.25) 0px 7px 8px -4px,
      rgba(115, 0, 75, 0.25) 0px 12px 17px 2px,
      rgba(115, 0, 75, 0.25) 0px 5px 22px 4px;
  }
  100% {
    box-shadow: rgba(115, 0, 75, 0) 0px 0px;
  }
}
</style>
