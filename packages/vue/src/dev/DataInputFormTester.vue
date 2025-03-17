<template>
  <div>
    <data-input-form
      v-if="component && dataShape"
      :data-shape="dataShape"
      :course-cfg="{
        courseID: 'testCourse',
        name: 'testCourseName',
        description: 'All of these courses will be the same!',
        admins: ['admin'],
        creator: 'admin',
        deleted: false,
        moderators: [],
        public: true,
        disambiguator: 'testCourseName',
        questionTypes: [],
        dataShapes: [],
      }"
      :preview-component="component"
    />
    <div v-else>
      No component loaded :/
      <!--

    todo: provide list of Question type components, with router links
    to their DataInputFormTester loaders.

    --></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import DataInputForm from '../../src/components/Edit/ViewableDataInputForm/DataInputForm.vue';
import { DataShape } from '../../src/base-course/Interfaces/DataShape';
import { useRoute } from 'vue-router';
import { Question } from '@vue-skuilder/common-ui';

type CourseShapes = {
  courseID: string;
  dataShapes: DataShape[];
};

const questionModules = import.meta.glob('../**/questions/**/index.ts', {
  // Adding eager: false ensures lazy loading
  eager: false,
});

type ModuleExports = {
  [key: string]: unknown;
};

export default defineComponent({
  name: 'DataInputFormTester',

  components: {
    DataInputForm,
  },

  setup() {
    return {
      route: useRoute(),
    };
  },

  data() {
    return {
      dataShape: null as DataShape | null,
      cds: null as CourseShapes[] | null,
      component: null as typeof Question | null,
    };
  },

  async created() {
    try {
      const q = this.route.params.pathMatch;
      const modulePath = `../${q}/index.ts`;

      console.log('Looking for module:', modulePath);
      console.log('Available paths:', Object.keys(questionModules));

      if (modulePath in questionModules) {
        const module = (await questionModules[modulePath]()) as ModuleExports;

        // Find the Question implementation
        const matchingExport = Object.entries(module).find(([name, exportValue]) => {
          const isClass = typeof exportValue === 'function';
          const extendsQuestion = isClass && exportValue.prototype instanceof Question;

          console.log(`Checking export "${name}":`, {
            isClass,
            extendsQuestion,
            type: typeof exportValue,
          });

          return extendsQuestion;
        });

        if (!matchingExport) {
          throw new Error('No export found extending Question class');
        }

        this.component = matchingExport[1] as typeof Question;

        const ds = this.component?.dataShapes[0];
        if (ds) {
          this.dataShape = ds;
        }
      } else {
        throw new Error(`No module found at path: ${modulePath}`);
      }
    } catch (e) {
      console.log('[difTester] Error loading component', e);
    }
  },
});
</script>
