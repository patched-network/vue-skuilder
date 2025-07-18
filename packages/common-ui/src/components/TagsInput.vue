<template>
  <div data-cy="tags-input">
    <vue-tags-input
      v-model="tag"
      :tags="tags"
      :autocomplete-items="autoCompleteSuggestions"
      :separators="separators"
      :add-on-key="separators"
      @tags-changed="tagsChanged"
    >
      <template #autocomplete-item="props">
        <div class="autocomplete-item" :class="{ 'is-active': props.selected }">
          <span class="tag-name">{{ props.item.text }}</span>
          <span v-if="props.item.data && props.item.data.snippet" class="tag-snippet">
            - {{ props.item.data.snippet }}
          </span>
        </div>
      </template>
    </vue-tags-input>

    <v-btn v-if="!hideSubmit" color="success" :loading="loading" @click="submit">Save Changes</v-btn>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { getDataLayer, Tag, CourseDBInterface } from '@vue-skuilder/db';
// @ts-expect-error - suppress TS error for VueTagsInput - no types available
import { VueTagsInput } from '@vojtechlanka/vue-tags-input';

export interface TagObject {
  text: string;
  style?: string;
  classes?: string;
  data?: {
    snippet: string;
  };
}

export interface TagsInputInstance {
  tags: Array<{
    text: string;
    style?: string;
    classes?: string;
    data?: {
      snippet: string;
    };
  }>;
  submit: () => Promise<void>;
  updateAvailableCourseTags: () => Promise<void>;
}

export default defineComponent({
  name: 'SkTagsInput',

  components: {
    VueTagsInput,
  },

  props: {
    courseID: {
      type: String,
      required: true,
      default: '',
    },
    cardID: {
      type: String,
      required: false,
      default: '',
    },
    hideSubmit: {
      type: Boolean,
      required: false,
      default: false,
    },
  },

  data() {
    return {
      loading: true,
      tag: '',
      tags: [] as TagObject[],
      initialTags: [] as string[],
      availableCourseTags: [] as Tag[],
      separators: [';', ',', ' '] as string[],
      courseDB: null as CourseDBInterface | null,
    };
  },

  computed: {
    autoCompleteSuggestions(): TagObject[] {
      return this.availableCourseTags
        .filter((availableTag) => {
          return availableTag.name.toLowerCase().indexOf(this.tag.toLowerCase()) !== -1;
        })
        .map((availableTag) => {
          return {
            text: availableTag.name,
            data: {
              snippet: availableTag.snippet,
            },
          };
        });
    },
  },

  watch: {
    async cardID() {
      await this.getAppliedTags();
    },
    async courseID() {
      this.courseDB = getDataLayer().getCourseDB(this.courseID);
      await this.updateAvailableCourseTags();
    },
  },

  async created() {
    this.courseDB = getDataLayer().getCourseDB(this.courseID);

    await this.updateAvailableCourseTags();
    await this.getAppliedTags();
  },

  methods: {
    tagsChanged(newTags: TagObject[]) {
      console.log(`[TagsInput] Tags changing: ${JSON.stringify(newTags)}`);
      this.tags = newTags;
    },

    async getAppliedTags() {
      this.initialTags = [];
      this.tags = [];
      try {
        const appliedDocsFindResult = await this.courseDB!.getAppliedTags(this.cardID);
        appliedDocsFindResult.rows.forEach((row) => {
          console.log(`[TagsInput] The following tag is applied:
\t${JSON.stringify(row)}`);
          this.tags.push({
            text: row!.value.name,
            style: '',
            classes: '',
          });
        });
        this.initialTags = this.tags.map((tag) => tag.text);
      } catch (e) {
        console.error(`Error in init-getAppliedTags: ${JSON.stringify(e)}, ${e}`);
      } finally {
        this.loading = false;
      }
    },

    async updateAvailableCourseTags() {
      try {
        this.availableCourseTags = (await this.courseDB!.getCourseTagStubs()).rows.map((row) => {
          // console.log(`[TagsInput] available tag: ${JSON.stringify(row)}`);
          return row.doc! as Tag;
        });
      } catch (e) {
        console.error(`Error in init-availableCourseTags: ${JSON.stringify(e)}`);
      }
    },

    async submit() {
      console.log(`[TagsInput] tagsInput is submitting...`);
      this.loading = true;

      try {
        await Promise.all(
          this.tags.map(async (currentTag) => {
            if (!this.initialTags.includes(currentTag.text)) {
              try {
                await this.courseDB!.addTagToCard(this.cardID, currentTag.text);
                console.log(`[TagsInput] Successfully added tag: ${currentTag.text}`);
              } catch (error) {
                console.error(`Failed to add tag ${currentTag.text}:`, error);
              }
            }
          })
        );
      } catch (e) {
        console.error(`Exception adding tags: ${JSON.stringify(e)}`);
      }

      try {
        await Promise.all(
          this.initialTags.map(async (initialTag) => {
            if (
              this.tags.filter((tag) => {
                return tag.text === initialTag;
              }).length === 0
            ) {
              try {
                await this.courseDB!.removeTagFromCard(this.cardID, initialTag);
                console.log(`[TagsInput] Successfully removed tag: ${initialTag}`);
              } catch (error) {
                console.error(`Failed to remove tag ${initialTag}:`, error);
              }
            }
          })
        );
      } catch (e) {
        console.error(`Exception removing tags: ${JSON.stringify(e)}`);
      }
      this.loading = false;
    },
  },
});
</script>

<style scoped>
.vue-tags-input {
  max-width: 100%;
}

.autocomplete-item {
  display: flex;
  align-items: center;
  padding: 5px;
}

.autocomplete-item.is-active {
  background-color: #e8e8e8;
}

.autocomplete-item.is-active > .tag-name {
  background-color: #5c6bc0;
  color: white;
}

.tag-name {
  background-color: #e0e0e0;
  color: #333;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: bold;
  margin-right: 5px;
}

.tag-snippet {
  color: #666;
  font-size: 0.9em;
}

.autocomplete-item.is-active .tag-snippet {
  color: #333; /* Ensure snippet text is visible when item is active */
}
</style>
