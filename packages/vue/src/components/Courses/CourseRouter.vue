<template>
  <div>
    <div v-if="initComplete">
      <course-information v-if="courseId !== undefined && courseId !== ''" :_id="courseId" />
      <v-container v-else-if="candidates.length === 0">
        <v-row class="text-h4">
          {{ query }}
        </v-row>
        <v-divider></v-divider>
        <v-row class="ma-3 text-h5">Nothing here!</v-row>

        <v-row class="ma-3">
          <v-dialog v-model="newCourseDialog" fullscreen transition="dialog-bottom-transition" :overlay="false">
            <template #activator="{ props }">
              <v-btn color="primary" v-bind="props">Start a new Quilt</v-btn>
            </template>
            <course-editor :name="query" @course-editing-complete="newCourseDialog = false" />
          </v-dialog>
        </v-row>
      </v-container>
      <v-container v-else>
        <div>
          <span class="text-h3">{{ query }} </span> <span class="text-h5">could refer to:</span>
          <v-divider></v-divider>

          <div v-for="(c, i) in candidates" :key="i" class="ma-5">
            <v-row class="text-h5">
              <a @click="loadQuery(c.courseID)">{{ c.name }} </a>
              -
              <v-text-field
                :id="`${i}-disambiguator`"
                v-model="c.disambiguator"
                label="Disambiguator"
                @change="update(c)"
              ></v-text-field>
              {{ c.description }}
            </v-row>
          </div>
        </div>
      </v-container>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { disambiguateCourse, getCachedCourseList } from '@vue-skuilder/db';
import { CourseConfig } from '@vue-skuilder/common';
import CourseEditor from './CourseEditor.vue';
import CourseInformation from './CourseInformation.vue';

export default defineComponent({
  name: 'CourseRouter',

  components: {
    CourseInformation,
    CourseEditor,
  },

  props: {
    query: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      courseList: [] as CourseConfig[],
      courseId: undefined as string | undefined,
      candidates: [] as CourseConfig[],
      newCourseDialog: false,
      initComplete: false,
    };
  },

  async created() {
    this.courseList = await getCachedCourseList();
    this.loadQuery();
  },

  methods: {
    update(c: CourseConfig) {
      if (c.courseID && c.disambiguator) {
        disambiguateCourse(c.courseID, c.disambiguator);
      } else {
        // todo: indicate error on input box
      }
    },

    loadQuery(q?: string) {
      let query: string;
      if (q) {
        query = q.toLowerCase();
      } else {
        query = this.query.toLowerCase();
      }

      this.candidates = this.courseList.filter((c) => {
        const snakedName = c.name.replace(' ', '_').toLowerCase();
        return query === snakedName || query === c.courseID || query === `${snakedName}_(${c.disambiguator})`;
      });

      if (this.candidates.length === 1) {
        this.courseId = this.candidates[0].courseID!;
      } else if (this.candidates.length === 0) {
        this.courseId = '';
      }

      this.initComplete = true;
    },
  },
});
</script>

<style></style>
