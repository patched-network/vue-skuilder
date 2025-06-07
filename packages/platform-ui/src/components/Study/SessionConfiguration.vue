<template>
  <div v-if="hasRegistrations || courseLoadError || classroomLoadError">
    <div data-cy="select-quilts-header" class="text-h4 mb-4">Study Session Setup</div>

    <!-- Error Messages -->
    <v-alert v-if="courseLoadError" type="warning" class="mb-4">
      Unable to load course data. Some features may be unavailable.
    </v-alert>
    
    <v-alert v-if="classroomLoadError" type="warning" class="mb-4">  
      Unable to load classroom data. You can still study individual courses.
    </v-alert>

    <div class="session-layout">
      <!-- Left Column: Course Selection -->
      <div class="course-selection-container">
        <div class="text-h6 mb-3">Select Quilts to Study</div>
        <table width="100%">
          <thead>
            <tr>
              <th>
                <v-checkbox
                  id="SelectAll"
                  ref="selectAll"
                  v-model="allSelected"
                  autofocus
                  label="Select All"
                  @update:model-value="toggleAll"
                ></v-checkbox>
              </th>

              <th>
                Reviews
                <!-- <v-icon>info</v-icon> -->
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="classroom in activeClasses" :key="classroom.classID">
              <td>
                <v-checkbox v-model="classroom.selected" :label="`Class: ${classroom.name}`" @click.capture="update" />
              </td>
              <td>-</td>
            </tr>
            <tr v-for="course in activeCourses" :key="course.courseID">
              <td>
                <v-checkbox
                  v-model="course.selected"
                  data-cy="course-checkbox"
                  :label="`q/${course.name}`"
                  @click.capture="update"
                />
              </td>
              <td>{{ course.reviews }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Right Column: Time Configuration and Start Button -->
      <div class="fixed-controls-container">
        <div class="fixed-controls">
          <div class="text-h6 mb-3">Session Settings</div>

          <div class="mb-5">
            <v-text-field
              ref="numberField"
              v-model="timeLimit"
              class="time-limit-field"
              variant="outlined"
              label="Study Session Timelimit"
              prepend-inner-icon="mdi-clock-outline"
              prepend-icon="mdi-minus"
              append-icon="mdi-plus"
              :suffix="timeLimit > 1 ? 'minutes' : 'minute'"
              mask="##"
              type="number"
              @click:prepend="dec"
              @click:append="inc"
            />
          </div>

          <SkMouseTrapToolTip
            hotkey="enter"
            command="Start Session"
            :disabled="!activeCourses.length && !activeClasses.length"
            highlight-effect="scale"
          >
            <v-btn
              data-cy="start-studying-button"
              color="success"
              size="large"
              block
              class="start-btn"
              @click="startSession"
            >
              <v-icon start>mdi-play</v-icon>
              Start!
            </v-btn>
          </SkMouseTrapToolTip>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="!courseLoadError && !classroomLoadError" class="text-h4">
    <p>You don't have anything to study!</p>
    <p>Head over to the <router-link to="/quilts">Quilts</router-link> page to find something for you.</p>
  </div>
  <div v-else class="text-h4">
    <p>Unable to load study data due to technical issues.</p>
    <p>Please try refreshing the page or contact support if the problem persists.</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { SkldrMouseTrap, getCurrentUser, SkMouseTrapToolTip } from '@vue-skuilder/common-ui';
import { CourseRegistration, UserDBInterface, getDataLayer, ContentSourceID } from '@vue-skuilder/db';

export interface SessionConfigMetaData {
  selected: boolean;
  name: string;
  reviews: number;
}

export default defineComponent({
  name: 'SessionConfiguration',

  components: {
    SkMouseTrapToolTip,
  },

  props: {
    initialTimeLimit: {
      type: Number,
      required: true,
      default: 5,
    },
  },

  emits: ['initStudySession'],

  data() {
    return {
      registeredHotkeys: [] as (string | string[])[],
      allSelected: true,
      activeCourses: [] as (CourseRegistration & SessionConfigMetaData)[],
      activeClasses: [] as ({ classID: string } & SessionConfigMetaData)[],
      hasRegistrations: true,
      user: null as UserDBInterface | null,
      timeLimit: this.initialTimeLimit,
      courseLoadError: false,
      classroomLoadError: false,
    };
  },

  watch: {
    timeLimit: {
      handler() {
        if (this.timeLimit <= 0) {
          this.timeLimit = 1;
        }
      },
    },
  },

  beforeUnmount() {
    // Clean up registered hotkeys when component unmounts
    if (this.registeredHotkeys) {
      this.registeredHotkeys.forEach(key => {
        SkldrMouseTrap.removeBinding(key);
      });
    }
  },

  async created() {
    this.user = await getCurrentUser();
    this.timeLimit = this.initialTimeLimit;

    this.setHotkeys();
    const [coursesResult, classroomsResult] = await Promise.allSettled([
      this.getActiveCourses(),
      this.getActiveClassrooms()
    ]);

    // Handle course loading failure
    if (coursesResult.status === 'rejected') {
      console.error('Failed to load courses:', coursesResult.reason);
      this.courseLoadError = true;
    }

    // Handle classroom loading failure  
    if (classroomsResult.status === 'rejected') {
      console.error('Failed to load classrooms:', classroomsResult.reason);
      this.classroomLoadError = true;
    }

    if (this.activeCourses.length === 0 && this.activeClasses.length === 0 && !this.courseLoadError && !this.classroomLoadError) {
      this.hasRegistrations = false;
    }
  },

  mounted() {
    document.getElementById('SelectAll')!.focus();
  },

  unmounted() {
    // Clean up registered hotkeys when component unmounts
    if (this.registeredHotkeys) {
      this.registeredHotkeys.forEach(key => {
        SkldrMouseTrap.removeBinding(key);
      });
    }
  },

  methods: {
    inc() {
      this.timeLimit = this.timeLimit + 1;
      console.log(`inc to ${this.timeLimit}`);
    },

    dec() {
      this.timeLimit--;
      console.log(`dec to ${this.timeLimit}`);
    },

    update() {
      console.log(JSON.stringify(this.activeCourses));
      console.log(JSON.stringify(this.activeClasses));
    },

    toggleAll(): void {
      console.log(`Toggling all courses`);
      this.activeCourses.forEach((crs) => {
        crs.selected = this.allSelected;
      });
      this.activeClasses.forEach((cl) => {
        cl.selected = this.allSelected;
      });
      console.log(JSON.stringify(this.activeCourses));
    },

    startSession() {
      // Clean up any registered hotkeys before starting session
      if (this.registeredHotkeys) {
        this.registeredHotkeys.forEach(key => {
          SkldrMouseTrap.removeBinding(key);
        });
      }
      const selectedCourses: ContentSourceID[] = this.activeCourses
        .filter((c) => c.selected)
        .map((c) => ({
          type: 'course',
          id: c.courseID,
        }));
      const selectedClassrooms: ContentSourceID[] = this.activeClasses
        .filter((cl) => cl.selected)
        .map((cl) => ({
          type: 'classroom',
          id: cl.classID,
        }));
      const allSelectedSources = [...selectedCourses, ...selectedClassrooms];
      this.$emit('initStudySession', allSelectedSources, this.timeLimit);
    },

    async getActiveClassrooms() {
      const classes = await (await getCurrentUser()).getActiveClasses();
      const activeClasses: ({ classID: string } & SessionConfigMetaData)[] = [];

      console.log(`Active classes: ${JSON.stringify(classes)}`);

      await Promise.all(
        classes.map((c) =>
          (async (classID: string) => {
            const classDb = await getDataLayer().getClassroomDB(classID, `student`);
            activeClasses.push({
              classID,
              name: classDb.getConfig().name,
              selected: true,
              reviews: 0,
            });
          })(c)
        )
      );
      this.activeClasses = activeClasses;
    },

    async getActiveCourses() {
      this.activeCourses = (await this.user!.getActiveCourses()).map((c) => ({
        ...c,
        selected: true,
        name: '',
        reviews: 0,
      }));

      Promise.all(
        this.activeCourses.map(async (c, i) => {
          const cfg = await getDataLayer().getCoursesDB().getCourseConfig(c.courseID);
          const crsInterface = await this.user?.getCourseInterface(c.courseID);
          return (async () => {
            return Promise.all([
              (this.activeCourses[i].name = cfg.name),
              (this.activeCourses[i].reviews = await crsInterface!.getScheduledReviewCount()),
            ]);
          })();
        })
      );
    },

    setHotkeys() {
      const hotkeys = [
        {
          hotkey: 'right',
          callback: () => {
            this.timeLimit++;
          },
          command: 'Increase time limit',
        },
        {
          hotkey: 'left',
          callback: () => {
            this.timeLimit--;
          },
          command: 'Decrease time limit',
        },
      ];
      SkldrMouseTrap.addBinding(hotkeys);
      this.registeredHotkeys = hotkeys.map(k => k.hotkey);
    },
  },
});
</script>

<style scoped>
td {
  text-align: center;
  align-content: center;
}

.cb {
  align-content: center !important;
  text-align: center !important;
}

/* Layout for session configuration */
.session-layout {
  display: flex;
  flex-direction: column;
}

/* Fixed controls container */
.fixed-controls-container {
  width: 100%;
  margin-bottom: 20px;
}

.fixed-controls {
  display: flex;
  flex-direction: column;
}

.time-limit-field {
  width: 100%;
  margin-bottom: 16px;
}

.start-btn {
  margin-top: 8px;
  max-height: 150px;
}

/* Course selection styles */
.course-selection-container {
  width: 100%;
}

/* Media queries for desktop layout */
@media (min-width: 960px) {
  .session-layout {
    flex-direction: row;
    gap: 40px;
  }

  .fixed-controls-container {
    width: 300px;
    flex-shrink: 0;
  }

  .fixed-controls {
    position: sticky;
    top: 20px;
    padding-left: 20px;
  }

  .course-selection-container {
    flex-grow: 1;
    border-right: 1px solid rgba(0, 0, 0, 0.12);
    padding-right: 20px;
  }
}
</style>
