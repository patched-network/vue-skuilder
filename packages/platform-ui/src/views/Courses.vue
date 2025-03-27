<template>
  <v-container fluid>
    <!-- Fixed Action Button - Updated position classes -->
    <v-btn
      color="primary"
      fixed
      location="bottom right"
      icon="mdi-plus"
      size="large"
      class="mb-4 mr-4"
      v-bind="newCourseAttrs"
      v-on="newCourseAttrs.on"
    />

    <!-- Main Content Area -->
    <v-row>
      <!-- My Quilts Panel -->
      <v-col cols="12">
        <v-expansion-panels v-model="myQuiltsPanel">
          <v-expansion-panel>
            <v-expansion-panel-title data-cy="registered-quilts-panel">My Registered Quilts</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-row>
                <v-col v-for="course in registeredCourses" :key="course._id" cols="12" sm="6" md="4" lg="3">
                  <v-card variant="outlined" density="compact" class="pa-2">
                    <div class="d-flex align-center justify-space-between">
                      <div data-cy="registered-course" class="d-flex align-center">
                        <router-link
                          :to="`/q/${course.name.replace(' ', '_')}`"
                          class="text-subtitle-2"
                          data-cy="registered-course-title"
                        >
                          {{ course.name }}
                        </router-link>
                        <v-icon v-if="!course.public" size="x-small" class="ml-1">mdi-eye-off</v-icon>
                      </div>
                      <v-btn
                        size="x-small"
                        variant="text"
                        color="error"
                        data-cy="drop-course-button"
                        :loading="spinnerMap[course._id] !== undefined"
                        @click="dropCourse(course._id)"
                      >
                        Drop
                      </v-btn>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>

      <!-- Available Quilts Section -->
      <v-col cols="12" class="mt-4">
        <h2 class="text-h5 mb-3">Available Quilts</h2>
        <v-row>
          <v-col v-for="course in displayedAvailableCourses" :key="course._id" cols="12" sm="6" md="4" lg="3">
            <course-stub-card data-cy="available-course-card" :_id="course._id" @refresh="refreshData" />
          </v-col>
        </v-row>

        <!-- Show More Button -->
        <v-row v-if="hasMoreCourses" justify="center" class="mt-2">
          <v-btn variant="text" color="primary" @click="toggleShowMore">
            {{ showAllCourses ? 'Show Less' : 'Show More' }}
          </v-btn>
        </v-row>
      </v-col>
    </v-row>

    <!-- New Course Dialog -->
    <v-dialog v-model="newCourseDialog" fullscreen transition="dialog-bottom-transition" :scrim="false">
      <course-editor @course-editing-complete="processResponse()" />
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import CourseEditor from '@/components/Courses/CourseEditor.vue';
import CourseStubCard from '@/components/Courses/CourseStubCard.vue';
import _ from 'lodash';
import serverRequest from '../server';
import { ServerRequestType, CourseConfig } from '@vue-skuilder/common';
import { alertUser } from '@vue-skuilder/common-ui';
import { getCourseList, User } from '@vue-skuilder/db';
import { getCurrentUser } from '@/stores/useAuthStore';

type DBCourseConfig = CourseConfig & PouchDB.Core.IdMeta;

export default defineComponent({
  name: 'CoursesView',

  components: {
    CourseEditor,
    CourseStubCard,
  },

  data() {
    return {
      existingCourses: [] as DBCourseConfig[],
      registeredCourses: [] as DBCourseConfig[],
      awaitingCreateCourse: false,
      spinnerMap: {} as { [key: string]: boolean },
      newCourseDialog: false,
      user: null as User | null,
      myQuiltsPanel: 0, // Controls expansion panel
      showAllCourses: false,
      coursesPerPage: 8,
    };
  },

  computed: {
    availableCourses(): DBCourseConfig[] {
      const availableCourses = _.without(this.existingCourses, ...this.registeredCourses);
      const user = this.user?.username;

      const viewableCourses = availableCourses.filter((course) => {
        if (!user) {
          return false;
        }
        const viewable: boolean =
          course.public ||
          course.creator === user ||
          course.admins.indexOf(user) !== -1 ||
          course.moderators.indexOf(user) !== -1;

        return viewable;
      });

      return viewableCourses;
    },
    displayedAvailableCourses(): DBCourseConfig[] {
      if (this.showAllCourses) {
        return this.availableCourses;
      }
      return this.availableCourses.slice(0, this.coursesPerPage);
    },

    hasMoreCourses(): boolean {
      return this.availableCourses.length > this.coursesPerPage;
    },

    newCourseAttrs() {
      return {
        attrs: {
          'aria-label': 'Create new quilt',
        },
        on: {
          click: () => (this.newCourseDialog = true),
        },
      };
    },
  },

  async created() {
    this.user = await getCurrentUser();
    this.refreshData();
  },

  methods: {
    processResponse(): void {
      this.newCourseDialog = false;
      this.refreshData();
    },

    toggleShowMore() {
      this.showAllCourses = !this.showAllCourses;
    },

    async refreshData(): Promise<void> {
      console.log(`Pulling user course data...`);
      const userCourseIDs = (await this.user!.getRegisteredCourses())
        .filter((c) => {
          return c.status === 'active' || c.status === 'maintenance-mode' || c.status === undefined;
        })
        .map((c) => {
          return c.courseID;
        });
      const courseList = await getCourseList();

      this.existingCourses = courseList.rows
        .filter((course) => {
          return course && course.doc;
        })
        .map((course) => {
          return course.doc!;
        });

      this.registeredCourses = courseList.rows
        .filter((course) => {
          let match: boolean = false;
          userCourseIDs.forEach((id) => {
            if (course.id === id) {
              match = true;
            }
          });
          return match;
        })
        .map((course) => {
          return course.doc!;
        });
    },

    async createCourse(): Promise<void> {
      this.awaitingCreateCourse = true;
      const resp = await serverRequest({
        type: ServerRequestType.CREATE_COURSE,
        data: {
          name: 'testCourseName',
          description: 'All of these courses will be the same!',
          public: true,
          deleted: false,
          creator: this.user!.username,
          admins: [this.user!.username],
          moderators: [],
          dataShapes: [],
          questionTypes: [],
        },
        user: this.user!.username,
        response: null,
      });

      alertUser({
        status: resp.response!,
        text: `Course ${JSON.stringify(resp)} created`,
      });
      this.awaitingCreateCourse = false;
    },

    async addCourse(course: string): Promise<void> {
      this.spinnerMap[course] = true;
      console.log(`Attempting to register for ${course}.`);
      await this.user?.registerForCourse(course);
      delete this.spinnerMap[course];
      this.refreshData();
    },

    async dropCourse(course: string): Promise<void> {
      this.spinnerMap[course] = true;
      console.log(`Attempting to drop ${course}.`);
      await this.user?.dropCourse(course);
      delete this.spinnerMap[course];
      this.refreshData();
    },
  },
});
</script>

<style scoped>
.component-fade-enter-active,
.component-fade-leave-active {
  transition: all 0.65s ease;
}
.component-fade-enter,
.component-fade-leave-to {
  opacity: 0;
}
.componnent-fade-move {
  transition: transform 1s;
}
</style>
