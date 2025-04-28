<template>
  <div v-if="!updatePending">
    <h1><router-link to="/classrooms">My Classrooms</router-link> / {{ classroomCfg!.name }}</h1>

    <h3>
      Join code: {{ classroomCfg!.joinCode }}
      <router-link :to="`/classrooms/${classroomId}/code`">
        <v-btn size="x-small" icon="mdi-fullscreen" color="accent" alt="Make Fullscreen"> </v-btn>
      </router-link>
    </h3>
    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-checkbox v-model="classroomCfg!.peerAssist" label="Allow peer instruction"></v-checkbox>
      </v-col>
      <v-col v-if="classroomDB" cols="12">
        <h2>Assigned Content:</h2>
        <h3>Quilts:</h3>
        <ul></ul>
        <ul>
          <li v-for="c in _assignedCourses" :key="c.courseID">
            {{ c.courseID }} <a @click="removeContent(c)">Remove</a>
          </li>
        </ul>
        <h3>Tags:</h3>
        <ul>
          <li v-for="(c, i) in _assignedTags" :key="i">
            {{ c.courseID }} - {{ c.tagID }} <a @click="removeContent(c)">Remove</a>
          </li>
        </ul>
        <v-fade-transition>
          <v-btn v-if="!addingContent" color="primary" @click="addingContent = true">
            Assign New Content
            <v-icon end>mdi-plus</v-icon>
          </v-btn>
        </v-fade-transition>
        <v-card v-if="addingContent">
          <v-toolbar>
            <v-toolbar-title>Add Content</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" color="error" @click="addingContent = false"> </v-btn>
          </v-toolbar>
          <v-card-text>
            <v-select
              v-model="selectedCourse"
              label="Select Quilt"
              :items="availableCourses"
              item-title="name"
              item-value="_id"
              title="Select Quilt"
            ></v-select>

            <v-select
              v-model="selectedTags"
              label="Select Tags"
              :items="availableTags"
              item-title="name"
              item-value="name"
              multiple
              chips
              hint=""
              persistent-hint
            ></v-select>
          </v-card-text>

          <v-card-actions>
            <v-btn v-if="selectedCourse !== ''" color="primary" @click="assignContent">
              {{ selectedTags.length == 0 ? 'Add Entire Quilt' : 'Add Tags' }}
              <v-icon end>mdi-plus</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import moment from 'moment';
import { TeacherClassroomDBInterface, AssignedContent, AssignedTag, Tag, getDataLayer } from '@vue-skuilder/db';
import { ClassroomConfig, CourseConfig } from '@vue-skuilder/common';
import { defineComponent } from 'vue';
import { getCurrentUser } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'ClassroomCtrlPanel',

  props: {
    classroomId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      classroomCfg: null as ClassroomConfig | null,
      classroomDB: null as TeacherClassroomDBInterface | null,
      assignedContent: [] as AssignedContent[],
      nameRules: [
        (value: string): string | boolean => {
          const max = 30;
          return value.length > max ? `Course name must be ${max} characters or less` : true;
        },
      ],
      updatePending: true,
      addingContent: false,
      availableCourses: [] as CourseConfig[],
      selectedCourse: '',
      availableTags: [] as Tag[],
      selectedTags: [] as string[],
    };
  },

  computed: {
    _assignedCourses(): AssignedContent[] {
      return this.assignedContent.filter((c) => c.type === 'course');
    },
    _assignedTags(): AssignedTag[] {
      return this.assignedContent.filter((c) => c.type === 'tag') as AssignedTag[];
    },
  },

  watch: {
    async selectedCourse() {
      if (this.selectedCourse) {
        // Get course DB from data layer
        const courseDB = getDataLayer().getCourseDB(this.selectedCourse);
        // Get tags from course DB
        const tagResponse = await courseDB.getCourseTagStubs();
        this.availableTags = tagResponse.rows.map((row) => row.doc!);
      } else {
        this.availableTags = [];
      }
    },
  },

  async created() {
    try {
      // Get classroom DB from data layer
      this.classroomDB = (await getDataLayer().getClassroomDB(
        this.classroomId,
        'teacher'
      )) as TeacherClassroomDBInterface;
      this.assignedContent = await this.classroomDB.getAssignedContent();
      this.classroomCfg = this.classroomDB.getConfig();

      console.log(`[ClassroomCtrlPanel] Route loaded w/ (prop) _id: ${this.classroomId}`);
      console.log(`[ClassroomCtrlPanel] Config: ${JSON.stringify(this.classroomCfg)}`);

      // Get course list from data layer
      this.availableCourses = await getDataLayer().getCoursesDB().getCourseList();

      this.updatePending = false;
    } catch (error) {
      console.error('[ClassroomCtrlPanel] Error initializing:', error);
    }
  },

  methods: {
    async assignContent() {
      if (!this.classroomDB) return;
      const u = await getCurrentUser();

      if (this.selectedTags.length === 0) {
        await this.classroomDB.assignContent?.({
          assignedOn: moment(),
          activeOn: moment(),
          type: 'course',
          courseID: this.selectedCourse,
          assignedBy: u.getUsername(),
        });
      } else {
        await Promise.all(
          this.selectedTags.map((tag) =>
            this.classroomDB!.assignContent?.({
              assignedOn: moment(),
              activeOn: moment(),
              type: 'tag',
              courseID: this.selectedCourse,
              tagID: tag,
              assignedBy: u.getUsername(),
            })
          )
        );
      }

      this.assignedContent = await this.classroomDB.getAssignedContent();
      this.addingContent = false;
      this.selectedCourse = '';
      this.selectedTags = [];
      this.availableTags = [];
    },

    async removeContent(c: AssignedContent) {
      if (this.classroomDB && this.classroomDB.removeContent) {
        await this.classroomDB.removeContent(c);
        this.assignedContent = await this.classroomDB.getAssignedContent();
      }
    },

    async submit() {
      this.updatePending = true;
    },
  },
});
</script>
