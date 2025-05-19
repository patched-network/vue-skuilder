<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-textarea
          v-model="bulkText"
          label="Bulk Card Input"
          placeholder="Paste card data here.
Separate cards with two consecutive '---' lines on their own lines.
Example:
Card 1 Question
{{blank}}
tags: tagA, tagB
elo: 1500
---
---
Card 2 Question
Another {{blank}}
elo: 1200
tags: tagC"
          rows="15"
          varient="outlined"
          data-cy="bulk-import-textarea"
        ></v-textarea>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn
          color="primary"
          :loading="processing"
          :disabled="!bulkText.trim()"
          data-cy="bulk-import-process-btn"
          @click="processCards"
        >
          Process Cards
          <v-icon end>mdi-play-circle-outline</v-icon>
        </v-btn>
      </v-col>
    </v-row>
    <v-row v-if="results.length > 0">
      <v-col cols="12">
        <v-list density="compact">
          <v-list-subheader>Import Results</v-list-subheader>
          <v-list-item
            v-for="(result, index) in results"
            :key="index"
            :class="{ 'lime-lighten-5': result.status === 'success', 'red-lighten-5': result.status === 'error' }"
          >
            <v-list-item-title>
              <v-icon :color="result.status === 'success' ? 'green' : 'red'">
                {{ result.status === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
              </v-icon>
              Card {{ index + 1 }}
            </v-list-item-title>
            <v-list-item-subtitle>
              <div v-if="result.message" class="ml-6">{{ result.message }}</div>
              <div v-if="result.cardId" class="ml-6">ID: {{ result.cardId }}</div>
              <details v-if="result.status === 'error' && result.originalText" class="ml-6">
                <summary>Original Input</summary>
                <pre style="white-space: pre-wrap; background-color: #f5f5f5; padding: 5px">{{
                  result.originalText
                }}</pre>
              </details>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { CourseConfig, DataShape, Status, NameSpacer } from '@vue-skuilder/common';
import { BlanksCardDataShapes } from '@vue-skuilder/courses';
import { getCurrentUser } from '@vue-skuilder/common-ui';
import { getDataLayer, CourseDBInterface } from '@vue-skuilder/db';
import { alertUser } from '@vue-skuilder/common-ui'; // For user feedback
import { ImportResult, processBulkCards, validateProcessorConfig, isValidBulkFormat } from '@/utils/bulkImport';

export default defineComponent({
  name: 'BulkImportView',
  props: {
    courseCfg: {
      type: Object as PropType<CourseConfig>,
      required: true,
    },
  },
  data() {
    return {
      bulkText: '',
      results: [] as ImportResult[],
      processing: false,
      courseDB: null as CourseDBInterface | null,
    };
  },
  created() {
    if (this.courseCfg?.courseID) {
      this.courseDB = getDataLayer().getCourseDB(this.courseCfg.courseID);

      // Validate that we have datashapes in the course config
      if (!this.courseCfg.dataShapes || this.courseCfg.dataShapes.length === 0) {
        console.error('[BulkImportView] Course config does not contain any dataShapes.');
        alertUser({
          text: 'Course configuration has no dataShapes. Bulk import may not work correctly.',
          status: Status.warning,
        });
      }
    } else {
      console.error('[BulkImportView] Course config or Course ID is missing.');
      alertUser({
        text: 'Course configuration is missing. Cannot initialize bulk import.',
        status: Status.error,
      });
    }
  },
  methods: {
    async processCards() {
      if (!this.courseDB) {
        alertUser({
          text: 'Database connection not available. Cannot process cards.',
          status: Status.error,
        });
        this.processing = false;
        return;
      }

      if (!isValidBulkFormat(this.bulkText)) {
        this.processing = false;
        return;
      }

      // Validate that we have datashapes in the course config
      if (!this.courseCfg?.dataShapes || this.courseCfg.dataShapes.length === 0) {
        alertUser({
          text: 'This course has no data shapes configured. Cannot import cards.',
          status: Status.error,
        });
        this.processing = false;
        return;
      }

      this.processing = true;
      this.results = [];

      const currentUser = await getCurrentUser();
      const userName = currentUser.getUsername();

      // Use the BlanksCardDataShapes for the data structure
      const dataShapeToUse: DataShape = BlanksCardDataShapes[0];

      if (!dataShapeToUse) {
        this.results.push({
          originalText: 'N/A - Configuration Error',
          status: 'error',
          message: 'Could not find BlanksCardDataShapes. Aborting.',
        });
        this.processing = false;
        return;
      }

      // Log the course configuration to help with debugging
      console.log('[BulkImportView] Processing with course config:', {
        courseID: this.courseCfg.courseID,
        dataShapes: this.courseCfg.dataShapes,
        questionTypes: this.courseCfg.questionTypes,
        dataShapeToUse: dataShapeToUse.name,
      });

      // Extract course code from first dataShape in course config
      const configDataShape = this.courseCfg?.dataShapes?.[0];
      if (!configDataShape) {
        this.results.push({
          originalText: 'N/A - Configuration Error',
          status: 'error',
          message: 'No data shapes found in course configuration',
        });
        this.processing = false;
        return;
      }

      const codeCourse = NameSpacer.getDataShapeDescriptor(configDataShape.name).course;
      console.log(`[BulkImportView] Using codeCourse: ${codeCourse} for note addition`);

      // Prepare processor configuration
      const config = {
        dataShape: dataShapeToUse,
        courseCode: codeCourse,
        userName: userName,
      };

      // Validate processor configuration
      const validation = validateProcessorConfig(config);
      if (!validation.isValid) {
        this.results.push({
          originalText: 'N/A - Configuration Error',
          status: 'error',
          message: validation.errorMessage || 'Invalid processor configuration',
        });
        this.processing = false;
        return;
      }

      // Process the cards
      try {
        this.results = await processBulkCards(this.bulkText, this.courseDB, config);
      } catch (error) {
        console.error('[BulkImportView] Error processing cards:', error);
        this.results.push({
          originalText: this.bulkText,
          status: 'error',
          message: `Error processing cards: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }

      this.processing = false;
      if (!this.results.some((r) => r.status === 'error')) {
        // Potentially clear bulkText if all successful, or offer a button to do so
        // this.bulkText = '';
      }
    },
  },
});
</script>

<style scoped>
.lime-lighten-5 {
  background-color: #f9fbe7 !important; /* Vuetify's lime lighten-5 */
}
.red-lighten-5 {
  background-color: #ffebee !important; /* Vuetify's red lighten-5 */
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  margin-top: 5px;
}
</style>
