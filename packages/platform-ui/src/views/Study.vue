<template>
  <div v-if="!inSession">
    <SessionConfiguration
      :initial-time-limit="sessionTimeLimit"
      @init-study-session="(sources, timeLimit) => initStudySession(sources, timeLimit)"
    />
  </div>
  <div v-else>
    <div v-if="previewMode && previewCourseConfig" align="center">
      <v-row>
        <v-col>
          <span class="text-h5">
            Quilt preview for <em>{{ previewCourseConfig.name }}</em>
          </span>
          <v-btn size="small" color="primary" @click="registerUserForPreviewCourse">Join</v-btn>
          <router-link :to="`/quilts/${previewCourseConfig.courseID}`">
            <v-btn size="small" color="secondary">More info</v-btn>
          </router-link>
          <v-spacer></v-spacer>
        </v-col>
      </v-row>
    </div>
    <div v-else-if="previewMode">
      <v-row>
        <v-col>
          <span class="text-h5">... No course was specified for the preview.</span>
          <div>(this shouldn't happen)...</div>
        </v-col>
      </v-row>
    </div>

    <StudySession
      v-if="sessionPrepared"
      :content-sources="sessionContentSources"
      :session-time-limit="sessionTimeLimit"
      :user="user as UserDBInterface"
      :session-config="studySessionConfig"
      :get-view-component="getViewComponent"
      @session-finished="handleSessionFinished"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import SessionConfiguration from '@/components/Study/SessionConfiguration.vue';
import { StudySession, type StudySessionConfig } from '@vue-skuilder/common-ui';
import { ContentSourceID, UserDBInterface, getDataLayer } from '@vue-skuilder/db';
import { getCurrentUser } from '@/stores/useAuthStore';
import { Router } from 'vue-router';
import { CourseConfig } from '@vue-skuilder/common';
import { useConfigStore } from '@/stores/useConfigStore';
import { useDataInputFormStore } from '@/stores/useDataInputFormStore';
import Courses from '@vue-skuilder/courses';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default defineComponent({
  name: 'StudyView',

  components: {
    SessionConfiguration,
    StudySession,
  },

  inject: {
    router: {
      from: 'router',
    },
  },

  props: {
    /**
     * If present, user will engage in a study session for the specified (non-registered) course.
     */
    previewCourseID: {
      type: String,
      required: false,
      default: '',
    },
    /**
     * If true, the user will engage in a study session for a
     * random (public) course they are not already registered for.
     */
    randomPreview: {
      type: Boolean,
      required: false,
    },
    /**
     * If present, user will engage in a study session for the specified (registered) course.
     */
    focusCourseID: {
      type: String,
      required: false,
      default: '',
    },
  },

  data() {
    return {
      user: null as UserDBInterface | null,
      studySessionConfig: undefined as StudySessionConfig | undefined,
      previewCourseConfig: undefined as CourseConfig | undefined,
      previewMode: false,
      sessionTimeLimit: 5,
      inSession: false,
      sessionPrepared: false,
      sessionContentSources: [] as ContentSourceID[],
      dataInputFormStore: useDataInputFormStore(),
      getViewComponent: (view_id: string) => Courses.getView(view_id),
    };
  },

  async created() {
    this.user = await getCurrentUser();
    this.studySessionConfig = {
      likesConfetti: useConfigStore().config.likesConfetti,
    };

    let singletonStudyCourseID = '';

    if (this.randomPreview) {
      const userCourseRegDoc = await this.user.getCourseRegistrationsDoc();
      const allCourses = (await getDataLayer().getCoursesDB().getCourseList()).rows.map((r) => r.id);
      const unRegisteredCourses = allCourses.filter((c) => {
        return !userCourseRegDoc.courses.some((rc) => rc.courseID === c);
      });
      if (unRegisteredCourses.length > 0) {
        singletonStudyCourseID = unRegisteredCourses[randomInt(0, unRegisteredCourses.length)];
      } else {
        singletonStudyCourseID = allCourses[randomInt(0, allCourses.length)];
      }
    }

    if (this.previewCourseID) {
      this.previewMode = true;
      getDataLayer()
        .getCoursesDB()
        .getCourseList()
        .then((courses) => {
          courses.rows.forEach((c) => {
            if (c.id === this.previewCourseID) {
              this.previewCourseConfig = c.doc!;
              this.previewCourseConfig!.courseID = c.id;
            }
          });
        });

      console.log(`[Study] COURSE PREVIEW MODE FOR ${this.previewCourseID}`);
      await this.user!.registerForCourse(this.previewCourseID, true);

      singletonStudyCourseID = this.previewCourseID;
    }

    if (this.focusCourseID) {
      console.log(`[Study] FOCUS study session: ${this.focusCourseID}`);
      singletonStudyCourseID = this.focusCourseID;
    }

    if (singletonStudyCourseID) {
      this.initStudySession([{ type: 'course', id: singletonStudyCourseID }], this.sessionTimeLimit);
    }
  },

  methods: {
    refreshRoute() {
      (this.router as Router).go(0);
    },

    async initStudySession(sources: ContentSourceID[], timeLimit: number) {
      console.log(`[Study] starting study session w/ sources: ${JSON.stringify(sources)}`);

      this.sessionContentSources = sources;
      this.sessionTimeLimit = timeLimit;
      this.inSession = true;
      this.sessionPrepared = true;
    },

    registerUserForPreviewCourse() {
      this.user!.registerForCourse(this.previewCourseConfig!.courseID!).then(() =>
        (this.router as Router).push(`/quilts/${this.previewCourseConfig!.courseID!}`)
      );
    },

    handleSessionFinished() {
      this.refreshRoute();
    },
  },
});
</script>
