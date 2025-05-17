<template>
  <div v-if="hasRegistrations">
    <div data-cy="select-quilts-header" class="text-h4 mb-12">Study Session Setup</div>

    <v-row>
      <!-- Left Column: Time Configuration and Start Button -->
      <v-col cols="12" md="4" lg="3" class="time-config-column">
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
      </v-col>

      <!-- Right Column: Course Selection -->
      <v-col cols="12" md="8" lg="9" class="course-selection-column">
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
      </v-col>
    </v-row>
  </div>
  <div v-else class="text-h4">
    <p>You don't have anything to study!</p>
    <p>Head over to the <router-link to="/quilts">Quilts</router-link> page to find something for you.</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { SkldrMouseTrap, getCurrentUser } from '@vue-skuilder/common-ui';
import { CourseRegistration, UserDBInterface, getDataLayer, ContentSourceID } from '@vue-skuilder/db';

export interface SessionConfigMetaData {
  selected: boolean;
  name: string;
  reviews: number;
}

export default defineComponent({
  name: 'SessionConfiguration',

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
      allSelected: true,
      activeCourses: [] as (CourseRegistration & SessionConfigMetaData)[],
      activeClasses: [] as ({ classID: string } & SessionConfigMetaData)[],
      hasRegistrations: true,
      user: null as UserDBInterface | null,
      timeLimit: this.initialTimeLimit,
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

  async created() {
    this.user = await getCurrentUser();
    this.timeLimit = this.initialTimeLimit;

    this.setHotkeys();
    await Promise.all([this.getActiveCourses(), this.getActiveClassrooms()]);

    if (this.activeCourses.length === 0 && this.activeClasses.length === 0) {
      this.hasRegistrations = false;
    }
  },

  mounted() {
    document.getElementById('SelectAll')!.focus();
  },

  unmounted() {
    SkldrMouseTrap.reset();
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
      SkldrMouseTrap.reset();
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
      SkldrMouseTrap.reset();
      SkldrMouseTrap.bind([
        {
          hotkey: 'right',
          callback: () => {
            this.timeLimit++;
          },
          command: '',
        },
        {
          hotkey: 'left',
          callback: () => {
            this.timeLimit--;
          },
          command: '',
        },
        {
          hotkey: 'enter',
          callback: this.startSession,
          command: '',
        },
      ]);
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

.time-config-column {
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

.course-selection-column {
  /* Only add border on medium screens and larger */
}

@media (min-width: 960px) {
  .course-selection-column {
    border-left: 1px solid rgba(0, 0, 0, 0.12);
  }
}
</style>
