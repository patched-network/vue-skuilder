<template>
  <div v-if="sessionPrepared" class="StudySession">
    <v-row align="center">
      <v-col>
        <h1 class="text-h3">
          {{ courseNames[courseID] }}:
          <v-progress-circular v-if="loading" color="primary" indeterminate size="32" width="4" />
        </h1>
        <v-spacer></v-spacer>
      </v-col>
    </v-row>

    <br />

    <div v-if="sessionFinished" class="text-h4">
      <p>Study session finished! Great job!</p>
      <p v-if="sessionController">{{ sessionController.report }}</p>
      <p>
        Start <a @click="$emit('session-finished')">another study session</a>, or try
        <router-link :to="`/edit/${courseID}`">adding some new content</router-link> to challenge yourself and others!
      </p>
      <heat-map activity-records-getter="user.getActivityRecords" />
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
import { defineComponent, PropType } from 'vue';
import { isQuestionView } from '../composables/CompositionViewable';
import { alertUser } from './SnackbarService';
import ViewComponent from '../composables/Displayable';
import SkMouseTrap from './SkMouseTrap.vue';
import StudySessionTimer from './StudySessionTimer.vue';
import HeatMap from './HeatMap.vue';
import CardViewer from './cardRendering/CardViewer.vue';

import {
  ContentSourceID,
  getStudySource,
  isReview,
  StudyContentSource,
  StudySessionItem,
  docIsDeleted,
  CardData,
  CardHistory,
  CardRecord,
  DisplayableData,
  isQuestionRecord,
  CourseRegistrationDoc,
  DataLayerProvider,
  UserDBInterface,
} from '@vue-skuilder/db';
import { SessionController, StudySessionRecord } from '@vue-skuilder/db';
import { newInterval } from '@vue-skuilder/db';
import {
  adjustCourseScores,
  CourseElo,
  toCourseElo,
  isCourseElo,
  displayableDataToViewData,
  ViewData,
  Status,
} from '@vue-skuilder/common';
import confetti from 'canvas-confetti';
import moment from 'moment';

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

  emits: ['session-finished', 'session-started', 'card-loaded', 'card-response', 'time-changed'],

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
      sessionController: null as SessionController | null,
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
    this.initSession();
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
      console.log(`[StudySession] starting study session w/ sources: ${JSON.stringify(this.contentSources)}`);

      this.sessionContentSources = (
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
      ).filter((s) => s !== null);

      this.timeRemaining = this.sessionTimeLimit * 60;

      const sessionClassroomDBs = await Promise.all(
        this.contentSources
          .filter((s) => s.type === 'classroom')
          .map(async (c) => this.dataLayer.getClassroomDB(c.id, this.user))
      );

      sessionClassroomDBs.forEach((db) => {
        db.setChangeFcn(this.handleClassroomMessage());
      });

      this.sessionController = new SessionController(this.sessionContentSources, 60 * this.sessionTimeLimit);
      this.sessionController.sessionRecord = this.sessionRecord;

      await this.sessionController.prepareSession();
      this.intervalHandler = setInterval(this.tick, 1000);

      this.sessionPrepared = true;

      this.contentSources
        .filter((s) => s.type === 'course')
        .forEach(async (c) => (this.courseNames[c.id] = (await dataLayer.getCourseConfig(c.id)).name));

      console.log(`[StudySession] Session created:
        ${this.sessionController.toString()}
        User courses: ${this.contentSources
          .filter((s) => s.type === 'course')
          .map((c) => c.id)
          .toString()}
        User classrooms: ${sessionClassroomDBs.map((db) => db._id)}
      `);

      this.$emit('session-started');
      this.loadCard(this.sessionController.nextCard());
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

      if (isQuestionRecord(r)) {
        console.log(`[StudySession] Question is ${r.isCorrect ? '' : 'in'}correct`);
        if (r.isCorrect) {
          try {
            if (this.$refs.shadowWrapper) {
              this.$refs.shadowWrapper.setAttribute(
                'style',
                `--r: ${255 * (1 - (r.performance as number))}; --g:${255}`
              );
              this.$refs.shadowWrapper.classList.add('correct');
            }
          } catch (e) {
            // swallow error
            console.warn(`[StudySession] Error setting shadowWrapper style: ${e}`);
          }

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

          if (r.priorAttemps === 0) {
            const item: StudySessionItem = {
              ...this.currentCard.item,
            };
            this.loadCard(this.sessionController!.nextCard('dismiss-success'));

            cardHistory.then((history: CardHistory<CardRecord>) => {
              this.scheduleReview(history, item);
              if (history.records.length === 1) {
                this.updateUserAndCardElo(0.5 + (r.performance as number) / 2, this.courseID, this.cardID);
              } else {
                const k = Math.ceil(32 / history.records.length);
                this.updateUserAndCardElo(0.5 + (r.performance as number) / 2, this.courseID, this.cardID, k);
              }
            });
          } else {
            this.loadCard(this.sessionController!.nextCard('marked-failed'));
          }
        } else {
          try {
            if (this.$refs.shadowWrapper) {
              this.$refs.shadowWrapper.classList.add('incorrect');
            }
          } catch (e) {
            // swallow error
            console.warn(`[StudySession] Error setting shadowWrapper style: ${e}`);
          }

          cardHistory.then((history: CardHistory<CardRecord>) => {
            if (history.records.length !== 1 && r.priorAttemps === 0) {
              this.updateUserAndCardElo(0, this.courseID, this.cardID);
            }
          });

          // [ ]  v3 version. Keep an eye on this -
          if (isQuestionView(this.$refs.cardViewer?.$refs.activeView)) {
            const view = this.$refs.cardViewer.$refs.activeView;

            if (this.currentCard.records.length >= view.maxAttemptsPerView) {
              const sessionViews: number = this.countCardViews(this.courseID, this.cardID);
              if (sessionViews >= view.maxSessionViews) {
                this.loadCard(this.sessionController!.nextCard('dismiss-failed'));
                this.updateUserAndCardElo(0, this.courseID, this.cardID);
              } else {
                this.loadCard(this.sessionController!.nextCard('marked-failed'));
              }
            }
          }
        }
      } else {
        this.loadCard(this.sessionController!.nextCard('dismiss-success'));
      }

      this.clearFeedbackShadow();
    },

    async updateUserAndCardElo(userScore: number, course_id: string, card_id: string, k?: number) {
      if (k) {
        console.warn(`k value interpretation not currently implemented`);
      }
      const courseDB = dayaLayer.getCourseDB(this.currentCard.card.course_id);
      const userElo = toCourseElo(this.userCourseRegDoc!.courses.find((c) => c.courseID === course_id)!.elo);
      const cardElo = (await courseDB.getCardEloData([this.currentCard.card.card_id]))[0];

      if (cardElo && userElo) {
        const eloUpdate = adjustCourseScores(userElo, cardElo, userScore);
        this.userCourseRegDoc!.courses.find((c) => c.courseID === course_id)!.elo = eloUpdate.userElo;

        Promise.all([
          this.user!.updateUserElo(course_id, eloUpdate.userElo),
          courseDB.updateCardElo(card_id, eloUpdate.cardElo),
        ]).then((results) => {
          const user = results[0];
          const card = results[1];

          if (user.ok && card && card.ok) {
            console.log(
              `[StudySession] Updated ELOS:
              \tUser: ${JSON.stringify(eloUpdate.userElo)})
              \tCard: ${JSON.stringify(eloUpdate.cardElo)})
              `
            );
          }
        });
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

    async scheduleReview(history: CardHistory<CardRecord>, item: StudySessionItem) {
      const nextInterval = newInterval(this.$props.user, history);
      const nextReviewTime = moment.utc().add(nextInterval, 'seconds');

      if (isReview(item)) {
        console.log(`[StudySession] Removing previously scheduled review for: ${item.cardID}`);
        this.user!.removeScheduledCardReview(this.user!.getUsername(), item.reviewID);
      }

      this.user!.scheduleCardReview({
        user: this.user!.getUsername(),
        course_id: history.courseID,
        card_id: history.cardID,
        time: nextReviewTime,
        scheduledFor: item.contentSourceType,
        schedulingAgentId: item.contentSourceID,
      });
    },

    async loadCard(item: StudySessionItem | null) {
      if (this.loading) {
        console.warn(`Attempted to load card while loading another...`);
        return;
      }

      console.log(`[StudySession] loading: ${JSON.stringify(item)}`);
      if (item === null) {
        this.sessionFinished = true;
        this.$emit('session-finished', this.sessionRecord);
        return;
      }
      this.cardType = item.status;

      const qualified_id = item.qualifiedID;
      this.loading = true;
      const [_courseID, _cardID] = qualified_id.split('-');

      console.log(`[StudySession] Now displaying: ${qualified_id}`);

      try {
        const tmpCardData = await getCourseDoc<CardData>(_courseID, _cardID);

        if (!isCourseElo(tmpCardData.elo)) {
          tmpCardData.elo = toCourseElo(tmpCardData.elo);
        }

        const tmpView: ViewComponent = this.getViewComponent(tmpCardData.id_view);
        const tmpDataDocs = tmpCardData.id_displayable_data.map((id) => {
          return getCourseDoc<DisplayableData>(_courseID, id, {
            attachments: true,
            binary: true,
          });
        });

        const tmpData = [];

        for (const docPromise of tmpDataDocs) {
          const doc = await docPromise;
          tmpData.unshift(displayableDataToViewData(doc));
        }

        this.cardCount++;
        this.data = tmpData;
        this.view = tmpView;
        this.cardID = _cardID;
        this.courseID = _courseID;
        this.card_elo = tmpCardData.elo.global.score;

        this.sessionRecord.push({
          card: {
            course_id: _courseID,
            card_id: _cardID,
            card_elo: tmpCardData.elo.global.score,
          },
          item: item,
          records: [],
        });

        this.$emit('card-loaded', {
          courseID: _courseID,
          cardID: _cardID,
          cardCount: this.cardCount,
        });
      } catch (e) {
        console.warn(`[StudySession] Error loading card ${JSON.stringify(item)}:\n\t${JSON.stringify(e)}, ${e}`);
        this.loading = false;

        const err = e as Error;
        if (docIsDeleted(err) && isReview(item)) {
          console.warn(`Card was deleted: ${qualified_id}`);
          this.user!.removeScheduledCardReview(this.user!.getUsername(), item.reviewID);
        }

        this.loadCard(this.sessionController!.nextCard('dismiss-error'));
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
    box-shadow: rgba(var(--r), var(--g), 0, 0.25) 0px 7px 8px -4px, rgba(var(--r), var(--g), 0, 0.25) 0px 12px 17px 2px,
      rgba(var(--r), var(--g), 0, 0.25) 0px 5px 22px 4px;
  }
  100% {
    box-shadow: rgba(0, 150, 0, 0) 0px 0px;
  }
}

@keyframes greenFade {
  0% {
    box-shadow: rgba(0, 150, 0, 0.25) 0px 7px 8px -4px, rgba(0, 150, 0, 0.25) 0px 12px 17px 2px,
      rgba(0, 150, 0, 0.25) 0px 5px 22px 4px;
  }
  100% {
    box-shadow: rgba(0, 150, 0, 0) 0px 0px;
  }
}
@keyframes purpleFade {
  0% {
    box-shadow: rgba(115, 0, 75, 0.25) 0px 7px 8px -4px, rgba(115, 0, 75, 0.25) 0px 12px 17px 2px,
      rgba(115, 0, 75, 0.25) 0px 5px 22px 4px;
  }
  100% {
    box-shadow: rgba(115, 0, 75, 0) 0px 0px;
  }
}
</style>
