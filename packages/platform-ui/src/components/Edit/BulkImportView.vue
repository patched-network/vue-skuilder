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
---
---
Card 2 Question
Another {{blank}}
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
import { CourseConfig, DataShape, Status } from '@vue-skuilder/common';
import { BlanksCardDataShapes } from '@vue-skuilder/courses';
import { getCurrentUser } from '@vue-skuilder/common-ui';
import { getDataLayer, CourseDBInterface } from '@vue-skuilder/db';
import { alertUser } from '@vue-skuilder/common-ui'; // For user feedback

interface ImportResult {
  originalText: string;
  status: 'success' | 'error';
  message: string;
  cardId?: string;
}

interface ParsedCard {
  markdown: string;
  tags: string[];
}

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
    } else {
      console.error('[BulkImportView] Course config or Course ID is missing.');
      alertUser({
        text: 'Course configuration is missing. Cannot initialize bulk import.',
        status: Status.error,
      });
    }
  },
  methods: {
    parseCard(cardString: string): ParsedCard | null {
      const trimmedCardString = cardString.trim();
      if (!trimmedCardString) {
        return null;
      }

      const lines = trimmedCardString.split('\n');
      let tags: string[] = [];
      const markdownLines = [...lines];

      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.toLowerCase().startsWith('tags:')) {
          tags = lastLine
            .substring(5)
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag);
          markdownLines.pop(); // Remove the tags line
        }
      }

      const markdown = markdownLines.join('\n').trim();
      if (!markdown) {
        // Card must have some markdown content
        return null;
      }
      return { markdown, tags };
    },

    async processCards() {
      if (!this.courseDB) {
        alertUser({
          text: 'Database connection not available. Cannot process cards.',
          status: Status.error,
        });
        this.processing = false;
        return;
      }
      if (!this.bulkText.trim()) return;

      this.processing = true;
      this.results = [];

      const cardDelimiter = '\n---\n---\n';
      const cardStrings = this.bulkText.split(cardDelimiter);
      const currentUser = await getCurrentUser();
      const userName = currentUser.getUsername();
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

      for (const cardString of cardStrings) {
        const originalText = cardString.trim();
        if (!originalText) continue;

        const parsed = this.parseCard(originalText);

        if (!parsed) {
          this.results.push({
            originalText,
            status: 'error',
            message: 'Failed to parse card: Empty content after tag removal or invalid format.',
          });
          continue;
        }

        const { markdown, tags } = parsed;

        // The BlanksCardDataShapes expects an 'Input' field for markdown
        // and an 'Uploads' field for media.
        const cardData = {
          Input: markdown,
          Uploads: [], // As per requirement, no uploads for bulk import
        };

        try {
          const result = await this.courseDB.addNote(
            'default',
            dataShapeToUse,
            cardData,
            userName,
            tags,
            undefined, // deck
            undefined // elo
          );

          if (result.status === Status.ok) {
            this.results.push({
              originalText,
              status: 'success',
              message: 'Card added successfully.',
              cardId: '(unknown)',
            });
          } else {
            this.results.push({
              originalText,
              status: 'error',
              message: result.message || 'Failed to add card to database. Unknown error.',
            });
          }
        } catch (error) {
          console.error('Error adding note:', error);
          this.results.push({
            originalText,
            status: 'error',
            message: `Error adding card: ${(error as any).message || 'Unknown error'}`,
          });
        }
      }

      if (this.results.length === 0 && cardStrings.length > 0 && cardStrings.every((s) => !s.trim())) {
        // This case handles if bulkText only contained delimiters or whitespace
        this.results.push({
          originalText: this.bulkText,
          status: 'error',
          message: 'No valid card data found. Please check your input and delimiters.',
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
