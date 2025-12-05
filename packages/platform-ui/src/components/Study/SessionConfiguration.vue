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

        <!-- Classrooms -->
        <div v-for="classroom in activeClasses" :key="classroom.classID" class="course-row">
          <div class="course-row-header">
            <v-checkbox
              v-model="classroom.selected"
              :label="`Class: ${classroom.name}`"
              hide-details
              @click.capture="update"
            />
            <span class="reviews-count">-</span>
          </div>
        </div>

        <!-- Courses -->
        <div v-for="course in activeCourses" :key="course.courseID" class="course-row">
          <div class="course-row-header">
            <v-checkbox
              v-model="course.selected"
              data-cy="course-checkbox"
              :label="`q/${course.name}`"
              hide-details
              @click.capture="update"
            />
            <div class="course-row-actions">
              <span class="reviews-count">{{ course.reviews }}</span>
              <v-btn
                v-if="course.selected"
                variant="text"
                size="small"
                :color="hasActiveTagFilter(course) ? 'primary' : 'default'"
                @click="toggleTagFilter(course.courseID)"
              >
                <v-icon start size="small">mdi-filter-variant</v-icon>
                {{ hasActiveTagFilter(course) ? 'Filtered' : 'Filter' }}
                <v-icon end size="small">
                  {{ expandedFilters[course.courseID] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                </v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Tag Filter Widget (expandable) -->
          <v-expand-transition>
            <div v-if="course.selected && expandedFilters[course.courseID]" class="tag-filter-container">
              <CourseTagFilterWidget :course-id="course.courseID" v-model="course.tagFilter" />
            </div>
          </v-expand-transition>
        </div>

        <!-- Select All -->
        <div class="select-all-row mt-3">
          <v-checkbox
            id="SelectAll"
            ref="selectAll"
            v-model="allSelected"
            autofocus
            label="Select All"
            hide-details
            @update:model-value="toggleAll"
          ></v-checkbox>
        </div>
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

          <!-- Filter Summary -->
          <div v-if="hasAnyActiveFilter" class="filter-summary mb-4">
            <v-icon size="small" color="primary" class="mr-1">mdi-filter</v-icon>
            <span class="text-caption">
              {{ activeFilterCount }} course{{ activeFilterCount > 1 ? 's' : '' }} with tag filters
            </span>
          </div>

          <SkMouseTrapToolTip
            hotkey="enter"
            command="Start Session"
            :disabled="!hasSelectedSources"
            highlight-effect="scale"
          >
            <v-btn
              data-cy="start-studying-button"
              color="success"
              size="large"
              block
              class="start-btn"
              :disabled="!hasSelectedSources"
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
import { SkldrMouseTrap, getCurrentUser, SkMouseTrapToolTip, CourseTagFilterWidget } from '@vue-skuilder/common-ui';
import { CourseRegistration, UserDBInterface, getDataLayer, ContentSourceID } from '@vue-skuilder/db';
import { TagFilter, hasActiveFilter } from '@vue-skuilder/common';

export interface SessionConfigMetaData {
  selected: boolean;
  name: string;
  reviews: number;
  tagFilter?: TagFilter;
}

// Extended ContentSourceID that can carry tag filter configuration
export interface TagFilteredContentSourceID extends ContentSourceID {
  tagFilter?: TagFilter;
}

export default defineComponent({
  name: 'SessionConfiguration',

  components: {
    SkMouseTrapToolTip,
    CourseTagFilterWidget,
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
      expandedFilters: {} as Record<string, boolean>,
    };
  },

  computed: {
    hasSelectedSources(): boolean {
      return this.activeCourses.some((c) => c.selected) || this.activeClasses.some((c) => c.selected);
    },

    hasAnyActiveFilter(): boolean {
      return this.activeCourses.some((c) => c.selected && this.hasActiveTagFilter(c));
    },

    activeFilterCount(): number {
      return this.activeCourses.filter((c) => c.selected && this.hasActiveTagFilter(c)).length;
    },
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
      this.registeredHotkeys.forEach((key) => {
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
      this.getActiveClassrooms(),
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

    if (
      this.activeCourses.length === 0 &&
      this.activeClasses.length === 0 &&
      !this.courseLoadError &&
      !this.classroomLoadError
    ) {
      this.hasRegistrations = false;
    }
  },

  mounted() {
    document.getElementById('SelectAll')?.focus();
  },

  unmounted() {
    // Clean up registered hotkeys when component unmounts
    if (this.registeredHotkeys) {
      this.registeredHotkeys.forEach((key) => {
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

    toggleTagFilter(courseID: string): void {
      this.expandedFilters[courseID] = !this.expandedFilters[courseID];
    },

    hasActiveTagFilter(course: CourseRegistration & SessionConfigMetaData): boolean {
      return hasActiveFilter(course.tagFilter);
    },

    startSession() {
      // Clean up any registered hotkeys before starting session
      if (this.registeredHotkeys) {
        this.registeredHotkeys.forEach((key) => {
          SkldrMouseTrap.removeBinding(key);
        });
      }

      // Build sources with optional tag filters
      const selectedCourses: TagFilteredContentSourceID[] = this.activeCourses
        .filter((c) => c.selected)
        .map((c) => {
          const source: TagFilteredContentSourceID = {
            type: 'course',
            id: c.courseID,
          };
          // Only include tagFilter if it has active constraints
          if (hasActiveFilter(c.tagFilter)) {
            source.tagFilter = c.tagFilter;
          }
          return source;
        });

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
        tagFilter: undefined,
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
      this.registeredHotkeys = hotkeys.map((k) => k.hotkey);
    },
  },
});
</script>

<style scoped>
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

.course-row {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  padding: 8px 0;
}

.course-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.course-row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reviews-count {
  min-width: 32px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.tag-filter-container {
  padding: 12px 0 12px 32px;
  background-color: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 4px;
  margin-top: 8px;
}

.select-all-row {
  padding-top: 8px;
  border-top: 2px solid rgba(var(--v-border-color), 0.24);
}

.filter-summary {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: rgba(var(--v-theme-primary), 0.08);
  border-radius: 4px;
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
