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
      <v-btn color="success" @click="toggleComponent">Content Editing / Component Registration</v-btn>
      <div v-if="editingMode">
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
      <component-registration v-else :course="course" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import ComponentRegistration from '@/components/Edit/ComponentRegistration/ComponentRegistration.vue';
import Courses from '@vue-skuilder/courses';
import { BlanksCard, BlanksCardDataShapes } from '@vue-skuilder/courses';
import { CourseConfig, NameSpacer, DataShape } from '@vue-skuilder/common';
import DataInputForm from './ViewableDataInputForm/DataInputForm.vue';
import { getCredentialledCourseConfig } from '@vue-skuilder/db';
import { useDataInputFormStore } from '@/stores/useDataInputFormStore';

export default defineComponent({
  name: 'CourseEditor',

  components: {
    DataInputForm,
    ComponentRegistration,
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
      editingMode: true,
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
    this.courseConfig = await getCredentialledCourseConfig(this.course);

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
    Courses.courses.forEach((course) => {
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
      this.editingMode = !this.editingMode;
    },
  },
});
</script>

<style scoped>
div {
  margin-top: 15px;
}
</style>
