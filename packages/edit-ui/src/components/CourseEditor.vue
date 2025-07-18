<template>
  <div v-if="course" class="courseEditor">
    <div v-if="loading">
      <v-progress-circular indeterminate color="secondary"></v-progress-circular>
    </div>
    <div v-else>
      <h1 class="text-h4">
        <router-link to="/q">Quilts</router-link> /
        <router-link :to="`/q/${courseConfig ? courseConfig.name : course}`">{{ courseConfig?.name }}</router-link>
      </h1>

      <v-tabs v-model="currentTab" bg-color="primary" grow>
        <v-tab value="single">Single Card Input</v-tab>
        <v-tab value="bulk">Bulk Import</v-tab>
        <v-tab value="registration">Navigation</v-tab>
        <v-tab value="registration">Component Registration</v-tab>
      </v-tabs>

      <v-window v-model="currentTab">
        <v-window-item value="single">
          <v-container fluid>
            <v-select
              v-model="selectedShape"
              label="What kind of content are you adding?"
              :items="registeredDataShapes.map((shape) => shape.name)"
              class="mt-4"
            />
            <data-input-form
              v-if="selectedShape !== '' && courseConfig && dataShape"
              :data-shape="dataShape"
              :course-cfg="courseConfig"
            />
          </v-container>
        </v-window-item>

        <v-window-item value="bulk">
          <v-container fluid>
            <bulk-import-view v-if="courseConfig" :course-cfg="courseConfig" class="mt-4" />
          </v-container>
        </v-window-item>

        <v-window-item value="registration">
          <v-container fluid>
            <component-registration :course="course" class="mt-4" />
          </v-container>
        </v-window-item>

        <v-window-item value="navigation">
          <v-container fluid>
            <navigation-strategy-editor :course-id="course" />
          </v-container>
        </v-window-item>
      </v-window>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
// import ComponentRegistration from '@vue-skuilder/platform-ui/src/components/Edit/ComponentRegistration/ComponentRegistration.vue';
// import NavigationStrategyEditor from '@vue-skuilder/platform-ui/src/components/Edit/NavigationStrategy/NavigationStrategyEditor.vue';
import { allCourses } from '@vue-skuilder/courseware';
import { BlanksCard, BlanksCardDataShapes } from '@vue-skuilder/courseware';
import { CourseConfig, NameSpacer, DataShape } from '@vue-skuilder/common';
import DataInputForm from './ViewableDataInputForm/DataInputForm.vue';
import BulkImportView from './BulkImportView.vue'; // Added import
import { getDataLayer } from '@vue-skuilder/db';
import { useDataInputFormStore } from '../stores/useDataInputFormStore';

export default defineComponent({
  name: 'CourseEditor',

  components: {
    DataInputForm,
    // ComponentRegistration,
    // NavigationStrategyEditor,
    BulkImportView,
  },

  props: {
    course: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      registeredDataShapes: [] as DataShape[],
      dataShapes: [] as DataShape[],
      selectedShape: BlanksCard.dataShapes[0].name,
      courseConfig: null as CourseConfig | null,
      dataShape: BlanksCardDataShapes[0] as DataShape,
      loading: true,
      currentTab: 'single',
      dataInputFormStore: useDataInputFormStore(),
    };
  },

  watch: {
    selectedShape: {
      handler(value?: string) {
        if (value) {
          this.dataShape = this.getDataShape(value);
          this.dataInputFormStore.setDataShape(this.dataShape);

          this.dataInputFormStore.dataInputForm.course = this.courseConfig;
        }
      },
    },
  },

  async created() {
    this.courseConfig = await getDataLayer().getCoursesDB().getCourseConfig(this.course);

    // for testing getCourseTagStubs...
    // log(JSON.stringify(await getCourseTagStubs(this.course)));

    // this.dataShapes = BaseCards.dataShapes;
    // this.registeredDataShapes = BaseCards.dataShapes;
    // BaseCards.dataShapes.forEach((shape) => {
    //   this.dataShapes.push(shape);
    //   this.registeredDataShapes.push(shape);
    // });

    // #55 make all 'programmed' datashapes available, rather than
    // the previous code-based name scoping
    allCourses.courses.forEach((course) => {
      course.questions.forEach((question) => {
        question.dataShapes.forEach((ds) => {
          this.dataShapes.push(ds);
        });
      });
    });

    // Defensive check: handle loading states where courseConfig might not be ready
    if (this.courseConfig && this.courseConfig.dataShapes) {
      this.courseConfig.dataShapes.forEach((ds) => {
        this.registeredDataShapes.push(
          this.dataShapes.find((shape) => {
            return shape.name === NameSpacer.getDataShapeDescriptor(ds.name).dataShape;
          })!
        );
      });
    }

    this.loading = false;
  },

  methods: {
    getDataShape(shapeName: string): DataShape {
      return this.dataShapes.find((shape) => {
        return shape.name === shapeName;
      })!;
    },
  },
});
</script>

<style scoped>
div {
  margin-top: 15px;
}
</style>
