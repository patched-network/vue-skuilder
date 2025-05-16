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
      <v-btn-toggle v-model="editorMode" mandatory color="success" class="mb-4">
        <v-btn value="content">Content Editing</v-btn>
        <v-btn value="component">Component Registration</v-btn>
        <v-btn value="navigation">Navigation Strategies</v-btn>
      </v-btn-toggle>
      <div v-if="editorMode === 'content'">
        <v-select
          v-model="selectedShape"
          label="What kind of content are you adding?"
          :items="registeredDataShapes.map((shape) => shape.name)"
        />

        <data-input-form
          v-if="!loading && selectedShape !== '' && courseConfig && dataShape"
          :data-shape="dataShape"
          :course-cfg="courseConfig"
        />
      </div>
      <component-registration v-else-if="editorMode === 'component'" :course="course" />
      <navigation-strategy-editor v-else-if="editorMode === 'navigation'" :course-id="course" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import ComponentRegistration from '@/components/Edit/ComponentRegistration/ComponentRegistration.vue';
import NavigationStrategyEditor from '@/components/Edit/NavigationStrategy/NavigationStrategyEditor.vue';
import { allCourses } from '@vue-skuilder/courses';
import { BlanksCard, BlanksCardDataShapes } from '@vue-skuilder/courses';
import { CourseConfig, NameSpacer, DataShape } from '@vue-skuilder/common';
import DataInputForm from './ViewableDataInputForm/DataInputForm.vue';
import { getDataLayer } from '@vue-skuilder/db';
import { useDataInputFormStore } from '@/stores/useDataInputFormStore';

export default defineComponent({
  name: 'CourseEditor',

  components: {
    DataInputForm,
    ComponentRegistration,
    NavigationStrategyEditor,
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
      editorMode: 'content', // 'content', 'component', or 'navigation'
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

    this.courseConfig.dataShapes.forEach((ds) => {
      this.registeredDataShapes.push(
        this.dataShapes.find((shape) => {
          return shape.name === NameSpacer.getDataShapeDescriptor(ds.name).dataShape;
        })!
      );
    });

    this.loading = false;
  },

  methods: {
    getDataShape(shapeName: string): DataShape {
      return this.dataShapes.find((shape) => {
        return shape.name === shapeName;
      })!;
    },

    toggleComponent() {
      // Legacy method, now handled by v-btn-toggle
      this.editorMode = this.editorMode === 'content' ? 'component' : 'content';
    },
  },
});
</script>

<style scoped>
div {
  margin-top: 15px;
}
</style>
