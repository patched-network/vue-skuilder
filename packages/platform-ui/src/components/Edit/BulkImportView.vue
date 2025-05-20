<template>
  <v-container fluid>
    <v-row v-if="!parsingComplete">
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
          variant="outlined"
          data-cy="bulk-import-textarea"
        ></v-textarea>
      </v-col>
    </v-row>

    <!-- Card Parsing Summary Section -->
    <v-row v-if="parsingComplete" class="mb-4">
      <v-col cols="12">
        <v-card border>
          <v-card-title>Parsing Summary</v-card-title>
          <v-card-text>
            <p>
              <strong>{{ parsedCards.length }}</strong> card(s) parsed and ready for import.
            </p>
            <div v-if="parsedCards.length > 0">
              <strong>Tags Found:</strong>
              <template v-if="uniqueTags.length > 0">
                <v-chip v-for="tag in uniqueTags" :key="tag" class="mr-1 mb-1" size="small" label>
                  {{ tag }}
                </v-chip>
              </template>
              <template v-else>
                <span class="text--secondary">No unique tags identified across parsed cards.</span>
              </template>
            </div>
            <!--
              Future enhancement: Add a paginated/scrollable list of parsed cards here for review.
            -->
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <!-- Button for initial parsing -->
        <v-btn
          v-if="!parsingComplete"
          color="primary"
          :loading="processing"
          :disabled="!bulkText.trim() || processing"
          data-cy="bulk-import-parse-btn"
          @click="handleInitialParse"
        >
          Parse Cards
          <v-icon end>mdi-play-circle-outline</v-icon>
        </v-btn>

        <!-- Buttons for post-parsing stage -->
        <template v-if="parsingComplete">
          <v-btn
            color="primary"
            class="mr-2"
            :loading="processing"
            :disabled="parsedCards.length === 0 || processing || importAttempted"
            data-cy="bulk-import-confirm-btn"
            @click="confirmAndImportCards"
          >
            Confirm and Import {{ parsedCards.length }} Card(s)
            <v-icon end>mdi-check-circle-outline</v-icon>
          </v-btn>
          <v-btn
            v-if="!importAttempted"
            variant="outlined"
            color="grey-darken-1"
            :disabled="processing"
            data-cy="bulk-import-edit-again-btn"
            @click="resetToInputStage"
          >
            <v-icon start>mdi-pencil</v-icon>
            Edit Again
          </v-btn>
          <v-btn
            v-if="importAttempted"
            variant="outlined"
            color="blue-darken-1"
            :disabled="processing"
            data-cy="bulk-import-add-another-btn"
            @click="startNewBulkImport"
          >
            <v-icon start>mdi-plus-circle-outline</v-icon>
            Add Another Bulk Import
          </v-btn>
        </template>
      </v-col>
    </v-row>
    <v-row v-if="results.length > 0">
      <v-col cols="12">
        <v-list density="compact">
          <v-list-subheader>Import Results</v-list-subheader>
          <v-list-item
            v-for="(result, index) in results"
            :key="index"
            :class="{
              'lime-lighten-5': result.status === 'success',
              'red-lighten-5': result.status === 'error',
              'force-dark-text': result.status === 'success' || result.status === 'error',
            }"
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
import { 
  CourseConfig, 
  DataShape, 
  Status, 
  NameSpacer,
  ParsedCard,
  parseBulkTextToCards,
  isValidBulkFormat 
} from '@vue-skuilder/common';
import { BlanksCardDataShapes } from '@vue-skuilder/courses';
import { getCurrentUser, alertUser } from '@vue-skuilder/common-ui';
import { 
  getDataLayer, 
  CourseDBInterface,
  ImportResult,
  importParsedCards,
  validateProcessorConfig
} from '@vue-skuilder/db';

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
      parsedCards: [] as ParsedCard[],
      parsingComplete: false,
      importAttempted: false,
      results: [] as ImportResult[],
      processing: false, // Will be used for both parsing and import stages
      courseDB: null as CourseDBInterface | null,
    };
  },
  computed: {
    uniqueTags(): string[] {
      if (!this.parsedCards || this.parsedCards.length === 0) {
        return [];
      }
      const allTags = this.parsedCards.reduce((acc, card) => {
        if (card.tags && card.tags.length > 0) {
          acc.push(...card.tags);
        }
        return acc;
      }, [] as string[]);
      return [...new Set(allTags)].sort();
    },
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
    resetToInputStage() {
      this.parsingComplete = false;
      this.parsedCards = [];
      this.importAttempted = false; // Reset import attempt flag
      // Optionally keep results if you want to show them even after going back
      // this.results = [];
      // this.bulkText = ''; // Optionally clear the bulk text
    },

    startNewBulkImport() {
      this.bulkText = '';
      this.results = [];
      this.parsedCards = [];
      this.parsingComplete = false;
      this.importAttempted = false;
    },

    handleInitialParse() {
      if (!this.courseDB) {
        alertUser({
          text: 'Database connection not available. Cannot process cards.',
          status: Status.error,
        });
        return;
      }

      // isValidBulkFormat calls alertUser internally if format is invalid.
      if (!isValidBulkFormat(this.bulkText)) {
        return;
      }

      this.processing = true;
      this.results = []; // Clear previous import results
      this.parsedCards = []; // Clear previously parsed cards
      this.parsingComplete = false; // Reset parsing complete state

      try {
        this.parsedCards = parseBulkTextToCards(this.bulkText);

        if (this.parsedCards.length === 0) {
          alertUser({
            text: 'No cards could be parsed from the input. Please check the format and ensure cards are separated by two "---" lines and that cards have content.',
            status: Status.warning,
          });
          this.processing = false;
          return;
        }

        // Successfully parsed, ready for review stage
        this.parsingComplete = true;
      } catch (error) {
        console.error('[BulkImportView] Error parsing bulk text:', error);
        alertUser({
          text: `Error parsing cards: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: Status.error,
        });
      } finally {
        this.processing = false;
      }
    },

    async confirmAndImportCards() {
      if (!this.courseDB) {
        alertUser({ text: 'Database connection lost before import.', status: Status.error });
        this.processing = false; // Ensure processing is false
        return;
      }
      if (this.parsedCards.length === 0) {
        alertUser({ text: 'No parsed cards to import.', status: Status.warning });
        this.processing = false; // Ensure processing is false
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
      this.results = []; // Clear results from parsing stage or previous attempts

      const currentUser = await getCurrentUser();
      const userName = currentUser.getUsername();

      const dataShapeToUse: DataShape = BlanksCardDataShapes[0];

      if (!dataShapeToUse) {
        alertUser({ text: 'Critical: Could not find BlanksCardDataShapes. Aborting import.', status: Status.error });
        this.processing = false;
        return;
      }

      const configDataShape = this.courseCfg?.dataShapes?.[0];
      if (!configDataShape) {
        alertUser({
          text: 'Critical: No data shapes found in course configuration. Aborting import.',
          status: Status.error,
        });
        this.processing = false;
        return;
      }

      const codeCourse = NameSpacer.getDataShapeDescriptor(configDataShape.name).course;

      const processorConfig = {
        dataShape: dataShapeToUse,
        courseCode: codeCourse,
        userName: userName,
      };

      const validation = validateProcessorConfig(processorConfig);
      if (!validation.isValid) {
        alertUser({
          text: validation.errorMessage || 'Invalid processor configuration for import.',
          status: Status.error,
        });
        this.processing = false;
        return;
      }

      console.log('[BulkImportView] Starting import of parsed cards:', {
        courseID: this.courseCfg.courseID,
        dataShapeToUse: dataShapeToUse.name,
        courseCode: codeCourse,
        numberOfCards: this.parsedCards.length,
      });

      try {
        this.results = await importParsedCards(this.parsedCards, this.courseDB, processorConfig);
      } catch (error) {
        console.error('[BulkImportView] Error importing parsed cards:', error);
        this.results.push({
          originalText: 'Bulk Operation Error',
          status: 'error',
          message: `Critical error during import: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        this.processing = false;
        this.importAttempted = true; // Mark that an import attempt has been made
      }

      if (this.results.every((r) => r.status === 'success') && this.results.length > 0) {
        // All successful, optionally reset
        // this.bulkText = ''; // Clear input text
        // this.parsingComplete = false; // Go back to input stage
        // this.parsedCards = [];
        alertUser({ text: `${this.results.length} card(s) imported successfully!`, status: Status.success });
      } else if (this.results.some((r) => r.status === 'error')) {
        alertUser({ text: 'Some cards failed to import. Please review the results below.', status: Status.warning });
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
.force-dark-text {
  color: rgba(0, 0, 0, 0.87) !important;
}
/* Ensure child elements also get dark text if not overridden */
.force-dark-text .v-list-item-subtitle,
.force-dark-text .v-list-item-title,
.force-dark-text div, /* Ensure divs within the list item also get dark text */
.force-dark-text summary {
  /* Ensure summary elements for <details> also get dark text */
  color: rgba(0, 0, 0, 0.87) !important;
}
/* Icons are handled by their :color prop, so no specific override needed here unless that changes. */
</style>
