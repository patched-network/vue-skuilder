<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" xl="6">
        <v-form ma-2 autocomplete="off">
          <div v-for="(field, i) in dataShape.fields" :key="dataShape.fields.indexOf(field)">
            <!-- image and audio inputs are semi deprecated - not in use right now -
                 superceded by the generic fillIn type that allows images and audio from the
                 general mediaDragDropUploader -->
            <!-- <audio-input v-else-if="field.type === audio" :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)" :field="field" :autofocus="i == 0" /> -->
            <!-- <image-input v-else-if="field.type === img" :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)" :field="field" :autofocus="i == 0" /> -->

            <string-input
              v-if="field.type === ftString"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
            />
            <chess-puzzle-input
              v-else-if="field.type === chessPuzzle"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
            />
            <number-input
              v-else-if="field.type === num"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
            />
            <integer-input
              v-else-if="field.type === int"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
            />
            <markdown-input
              v-else-if="field.type === mkd"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
              data-cy="markdown-input"
            />
            <midi-input
              v-else-if="field.type === midi"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
            />
            <media-drag-drop-uploader
              v-else-if="field.type === uploader"
              :ref="(el: FieldInputInstance) => setFieldInputRef(el, i)"
              :field="field"
              :autofocus="i == 0"
            />
          </div>

          <tags-input ref="tagsInput" :hide-submit="true" :course-i-d="courseCfg.courseID" card-i-d="" />
          <v-btn
            v-if="!previewComponent"
            data-cy="add-card-btn"
            class="float-right"
            type="submit"
            color="primary"
            :loading="uploading"
            :disabled="!allowSubmit"
            @click.prevent="submit"
          >
            Add card
            <v-icon end>mdi-plus-circle</v-icon>
          </v-btn>
          <div v-else>Input validated: {{ inputIsValidated }}</div>
        </v-form>
      </v-col>
      <v-col cols="12" xl="6">
        <card-browser v-if="inputIsValidated" class="ml-4" :views="shapeViews" :data="[previewInput]" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { DataShape } from '@vue-skuilder/common';
import { CardBrowser } from '@vue-skuilder/common-ui';
import { TagsInput } from '@vue-skuilder/common-ui';
import type { TagsInputInstance } from '@vue-skuilder/common-ui/src/components/TagsInput.vue';
import { FieldInputInstance, isFieldInput } from '@pui/components/Edit/ViewableDataInputForm/FieldInput.types';
import { alertUser } from '@vue-skuilder/common-ui';
import { allCourses } from '@vue-skuilder/courses';
import { getDataLayer, CourseDBInterface } from '@vue-skuilder/db';
import { FieldType, Status, CourseConfig, NameSpacer, ShapeDescriptor } from '@vue-skuilder/common';
import _ from 'lodash';
import IntegerInput from './FieldInputs/IntegerInput.vue';
import MarkdownInput from './FieldInputs/MarkdownInput.vue';
import MediaDragDropUploader from './FieldInputs/MediaDragDropUploader.vue';
import MidiInput from './FieldInputs/MidiInput.vue';
import NumberInput from './FieldInputs/NumberInput.vue';
import StringInput from './FieldInputs/StringInput.vue';
import ChessPuzzleInput from './FieldInputs/ChessPuzzleInput.vue';
import { CourseElo } from '@vue-skuilder/common';
import { useDataInputFormStore } from '@pui/stores/useDataInputFormStore';
import { ViewData } from '@vue-skuilder/common';
import { Question, getCurrentUser } from '@vue-skuilder/common-ui';

type StringIndexable = { [x: string]: unknown };

type QorNull = null | typeof Question;

export interface ComponentData {
  tag: string;
  tags: string[];
  autoCompleteSuggestions: string[];
  timer?: NodeJS.Timeout;
  dataInputFormStore: ReturnType<typeof useDataInputFormStore>;
  fieldInputRefs: (FieldInputInstance | null)[];
  courseDB: CourseDBInterface | null;
}

export default defineComponent({
  name: 'DataInputForm',

  components: {
    // AudioInput,
    // ImageInput,
    NumberInput,
    StringInput,
    IntegerInput,
    MarkdownInput,
    MidiInput,
    CardBrowser,
    MediaDragDropUploader,
    TagsInput,
    ChessPuzzleInput,
  },

  props: {
    courseCfg: {
      type: Object as () => CourseConfig,
      required: true,
      default: () => ({
        courseID: 'default-test',
      }),
    },
    dataShape: {
      type: Object as () => DataShape,
      required: true,
    },
    previewComponent: {
      type: Object as () => QorNull,
      required: false,
      default: null,
    },
  },

  data(): ComponentData {
    return {
      tag: '',
      tags: [],
      autoCompleteSuggestions: [],
      timer: undefined,
      dataInputFormStore: useDataInputFormStore(),
      fieldInputRefs: [] as (FieldInputInstance | null)[],
      courseDB: null as CourseDBInterface | null,
    };
  },

  computed: {
    ftString() {
      return FieldType.STRING;
    },
    int() {
      return FieldType.INT;
    },
    num() {
      return FieldType.NUMBER;
    },
    img() {
      return FieldType.IMAGE;
    },
    mkd() {
      return FieldType.MARKDOWN;
    },
    audio() {
      return FieldType.AUDIO;
    },
    midi() {
      return FieldType.MIDI;
    },
    uploader() {
      return FieldType.MEDIA_UPLOADS;
    },
    chessPuzzle() {
      return FieldType.CHESS_PUZZLE;
    },
    fieldInputs(): FieldInputInstance[] {
      return Array.from(this.fieldInputRefs.values()) as FieldInputInstance[];
    },

    shapeViews: {
      get() {
        return this.dataInputFormStore.dataInputForm.shapeViews;
      },
      set(views: ViewData[]) {
        this.dataInputFormStore.dataInputForm.shapeViews = views;
      },
    },

    allowSubmit() {
      return this.dataInputFormStore.dataInputForm.fieldStore.isValidated;
    },

    fieldStore() {
      return this.dataInputFormStore.dataInputForm.fieldStore;
    },

    uploading: {
      get(): boolean {
        return this.dataInputFormStore.dataInputForm.uploading;
      },
      set(uploading: boolean) {
        this.dataInputFormStore.dataInputForm.uploading = uploading;
      },
    },

    previewInput() {
      // this.convertInput();
      return this.fieldStore.getPreview as unknown as ViewData;
    },

    convertedInput() {
      // this.convertInput();
      return this.fieldStore.convertedInput;
    },

    inputIsValidated(): boolean {
      const store = this.dataInputFormStore.dataInputForm.fieldStore;
      return store.isValidated;
    },

    datashapeDescriptor(): ShapeDescriptor {
      for (const ds of this.courseCfg.dataShapes) {
        const descriptor = NameSpacer.getDataShapeDescriptor(ds.name);
        if (descriptor.dataShape === this.dataShape.name) {
          return descriptor;
        }
      }

      return {
        course: '',
        dataShape: '',
      };
    },
  },

  watch: {
    dataShape: {
      handler() {
        if (!this.previewComponent) {
          this.getImplementingViews();
        }
      },
      immediate: true,
    },
    store: {
      handler() {
        this.convertInput();
      },
    },
    'dataShape.fields'(newFields) {
      console.log(`[DataInputForm].watch(fields): newFields ${JSON.stringify(newFields)}`);
      console.log(`[DataInputForm].watch(fields): fields ${JSON.stringify(this.dataShape.fields)}`);
      this.fieldInputRefs = new Array(newFields.length).fill(null);
      console.log(`[DataInputForm].watch(fields): fieldRefs ${JSON.stringify(this.fieldInputRefs)}`);
    },
  },

  created() {
    this.uploading = false;
    this.courseDB = getDataLayer().getCourseDB(this.courseCfg.courseID!);

    this.getCourseTags();
    this.dataInputFormStore.setDataShape(this.dataShape);
    console.log(`[DataInputForm].created: fields: ${JSON.stringify(this.dataShape.fields)}`);
    this.fieldInputRefs = new Array(this.dataShape.fields.length).fill(null);

    if (this.previewComponent) {
      this.getImplementingViews();
    }
  },

  beforeUnmount() {
    this.fieldInputRefs = [];
  },

  methods: {
    async updateTags(newTags: string[]) {
      console.log(`[DataInputForm] tags updated: ${JSON.stringify(newTags)}`);
      this.tags = newTags;
    },

    setFieldInputRef(el: FieldInputInstance, index: number) {
      console.log(`[DataInputForm].setFieldInputRef: index: ${index}`);
      // Ensure array is large enough
      if (index >= this.fieldInputRefs.length) {
        this.fieldInputRefs = this.fieldInputRefs.concat(new Array(index - this.fieldInputRefs.length + 1).fill(null));
      }
      // remove any null entries at the end

      while (this.fieldInputRefs[this.fieldInputRefs.length - 1] === null) {
        this.fieldInputRefs.pop();
      }

      this.fieldInputRefs[index] = el;
    },

    async getCourseTags() {
      const existingTags = await this.courseDB!.getCourseTagStubs();
      this.autoCompleteSuggestions = existingTags.rows.map((tagDoc) => {
        return tagDoc.doc!.name;
      });
    },

    expectedValidations(): number {
      return this.dataShape.fields.length;
    },

    checkInput(): boolean {
      return true;
      // return this.fieldInputs.every((input) => input.validate());
    },

    convertInput() {},

    inputContainsTranspositionFcns(): boolean {
      this.convertInput();
      for (const input in this.convertedInput) {
        if (typeof this.convertedInput[input] === 'function') {
          return true;
        }
      }
      return false;
    },

    objectContainsFunction(o: StringIndexable): boolean {
      for (const key in o) {
        if (typeof o[key] === 'function') {
          return true;
        }
      }
      return false;
    },

    expandO(o: StringIndexable): StringIndexable[] {
      let ret: StringIndexable[] = [];

      if (this.objectContainsFunction(o)) {
        for (const fKey in o) {
          if (typeof o[fKey] === 'function') {
            console.log(`[DataInputForm] Key ${fKey} is a function.`);
            const replaced: StringIndexable[] = [];

            (o[fKey]() as Array<unknown>).forEach((fcnOutput) => {
              let copy: StringIndexable = {};
              copy = _.cloneDeep(o);
              copy[fKey] = fcnOutput;

              console.log(`[DataInputForm] Replaced Copy: ${JSON.stringify(copy)}`);

              replaced.push(copy);
            });

            replaced.forEach((obj) => {
              if (this.objectContainsFunction(obj)) {
                console.log('[DataInputForm] 2nd pass...');
                const recursiveExpansion = this.expandO(obj);
                ret = ret.concat(recursiveExpansion);
              } else {
                ret.push(obj);
              }
            });
          }
        }
        return ret;
      } else {
        return [];
      }
    },

    getTags(): string[] {
      const dataShapeParsedTags: string[] = [];

      this.fieldInputs.forEach((f) => {
        if (f.generateTags) {
          const fTags = f.generateTags();
          dataShapeParsedTags.push(...fTags);
        }
      });

      const manualTags = (this.$refs.tagsInput as unknown as TagsInputInstance).tags.map((t) => t.text);

      return dataShapeParsedTags.concat(manualTags);
    },

    getElo(): CourseElo | undefined {
      for (const f of this.fieldInputs) {
        if (f.generateELO) {
          return f.generateELO();
        }
      }
      return undefined;
    },

    async submit() {
      if (this.checkInput()) {
        console.log(`[DataInputForm] Store: ${JSON.stringify(this.fieldStore.inputs)}`);
        console.log(`[DataInputForm] ConvertedStore: ${JSON.stringify(this.convertedInput)}`);
        this.uploading = true;

        let inputs = [];

        if (this.inputContainsTranspositionFcns()) {
          console.log(`[DataInputForm] Expanded input: ${JSON.stringify(this.expandO(this.convertedInput))}`);
          inputs = this.expandO(this.convertedInput);
        } else {
          console.log(`[DataInputForm] No Transposition fcn detected`);
          inputs = [this.convertedInput];
        }

        const result = await Promise.all(
          inputs.map(async (input) => {
            return await this.courseDB!.addNote(
              this.datashapeDescriptor.course,
              this.dataShape,
              input,
              (await getCurrentUser()).getUsername(),
              this.getTags(),
              undefined,
              this.getElo()
            );
          })
        );

        if (result[0].status === Status.ok) {
          alertUser({
            text: `Content added... Thank you!`,
            status: Status.ok,
          });
          const ti = this.$refs.tagsInput as unknown as TagsInputInstance;
          if (ti.tags.length) {
            ti.updateAvailableCourseTags();
            ti.tags = [];
          }
          this.reset();
        } else {
          alertUser({
            text: `A problem occurred. Content has not been added.`,
            status: Status.error,
          });
          console.error(`Error in DataInputForm.submit(). Result from addNote: ${JSON.stringify(result)}`);
          this.uploading = false;
        }
      }
    },

    reset() {
      console.log(`[DataInputForm].reset()`);
      this.uploading = false;

      // Clear all field inputs
      this.fieldInputs.forEach((input) => {
        input.clearData();
      });

      // Reset the field store
      this.fieldStore.$reset();

      // Focus the first input
      this.fieldInputs[0].focus();

      // Reinitialize converted inputs
      this.convertInput();
    },

    getImplementingViews() {
      if (this.previewComponent) {
        console.log(`[DataInputForm] Getting previewComponent views`);
        this.shapeViews = this.previewComponent.views;
        return;
      }

      for (const ds of this.courseCfg.dataShapes) {
        const descriptor = NameSpacer.getDataShapeDescriptor(ds.name);

        console.log('[DataInputForm] descriptor', descriptor);
        console.log('[DataInputForm] this.dataShape', this.dataShape);
        console.log('[DataInputForm] this.dataShape.name', this.dataShape.name);

        if (descriptor.dataShape === this.dataShape.name) {
          const crs = allCourses.getCourse(descriptor.course)!;

          this.shapeViews = [];

          crs.getBaseQTypes().forEach((qType) => {
            if (qType.dataShapes[0].name === this.dataShape.name) {
              this.shapeViews = this.shapeViews.concat(qType.views);
            }
          });

          for (const q of ds.questionTypes) {
            const qDescriptor = NameSpacer.getQuestionDescriptor(q);
            crs.getQuestion(qDescriptor.questionType)!.views.forEach((view) => {
              this.shapeViews = this.shapeViews.concat(view);
            });
          }
        }
      }
    },

    isFieldInput(component: unknown): component is FieldInputInstance {
      return isFieldInput(component);
    },
  },
});
</script>
