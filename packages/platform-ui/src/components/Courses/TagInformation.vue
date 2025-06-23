<template>
  <div>
    <!-- todo: -->
    <h1>
      <router-link :to="`/q/${course.name}`">{{ course.name }}</router-link> > Tag: {{ tag.name }}
    </h1>
    <br />
    <p>{{ tag.taggedCards.length }} card{{ tag.taggedCards.length === 1 ? '' : 's' }}</p>

    <v-text-field
      ref="snippetEditor"
      v-model="snippetModel"
      variant="outlined"
      :readonly="!editingSnippet"
      :counter="editingSnippet"
      label="Brief tag description:"
      placeholder="No snippet yet - add one!"
      type="text"
    >
      <template #prepend>
        <span v-if="editingSnippet">
          <v-icon color="primary" @click="saveSnippet">mdi-content-save</v-icon>
        </span>
        <v-icon v-else color="primary" @click="editSnippet">mdi-pencil</v-icon>
      </template>
      <template #append>
        <v-icon v-if="editingSnippet" @click="cancelEditSnippet">mdi-cancel</v-icon>
        <v-fade-transition leave-absolute>
          <!-- spinner while awaiting async write of edits -->
          <v-progress-circular v-if="snippetSaving" size="20" color="info" indeterminate></v-progress-circular>
        </v-fade-transition>
      </template>
    </v-text-field>

    <v-text-field
      ref="wikiEditor"
      v-model="wikiModel"
      variant="outlined"
      :readonly="!editingWiki"
      :counter="editingWiki"
      label="Extended tag description:"
      placeholder="No wiki yet - consider adding one!"
      textarea
    >
      <template #prepend>
        <span v-if="editingWiki">
          <v-icon color="primary" @click="saveWiki">mdi-content-save</v-icon>
        </span>
        <v-icon v-else color="primary" @click="editWiki">mdi-pencil</v-icon>
      </template>
      <template #append>
        <v-icon v-if="editingWiki" @click="cancelEditWiki">mdi-cancel</v-icon>
        <v-fade-transition leave-absolute>
          <!-- spinner while awaiting async write of edits -->
          <v-progress-circular v-if="wikiSaving" size="20" color="info" indeterminate></v-progress-circular>
        </v-fade-transition>
      </template>
    </v-text-field>

    <course-card-browser :course-id="courseId" :tag-id="tagId" :view-lookup-function="viewLookup" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { DocType, Tag, getDataLayer, CourseDBInterface } from '@vue-skuilder/db';
import { Status, CourseConfig } from '@vue-skuilder/common';
import { CourseCardBrowser } from '@vue-skuilder/common-ui';
import { alertUser } from '@vue-skuilder/common-ui';
import { allCourses } from '@vue-skuilder/courses';

export default defineComponent({
  name: 'TagInformation',

  components: {
    CourseCardBrowser,
  },

  props: {
    tagId: {
      type: String,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      snippetModel: '',
      editingSnippet: false,
      snippetSaving: false,

      wikiModel: '',
      editingWiki: false,
      wikiSaving: false,

      courseDB: null as CourseDBInterface | null,

      tag: {
        course: this.courseId,
        name: this.tagId,
        snippet: '',
        wiki: '',
        taggedCards: [],
        docType: DocType.TAG,
      } as Tag,

      course: {
        courseID: this.courseId,
        name: '',
        description: '',
        public: false,
        deleted: false,
        dataShapes: [],
        questionTypes: [],
        creator: '',
        admins: [],
        moderators: [],
      } as CourseConfig,
    };
  },

  async created() {
    this.courseDB = getDataLayer().getCourseDB(this.courseId);
    this.tag = await this.courseDB.getTag(this.tagId);
    this.snippetModel = this.tag.snippet;
    this.wikiModel = this.tag.wiki;
    this.course = await this.courseDB.getCourseConfig();
  },

  methods: {
    viewLookup(x: unknown) {
      return allCourses.getView(x);
    },

    editSnippet() {
      console.log('[TagInformation] EditSnip');
      this.editingSnippet = true;
      (this.$refs.snippetEditor as HTMLInputElement).focus();
    },

    editWiki() {
      console.log('[TagInformation] EditWiki');
      this.editingWiki = true;
      (this.$refs.wikiEditor as HTMLInputElement).focus();
    },

    async saveSnippet() {
      this.snippetSaving = true;

      const update = await this.courseDB!.updateTag({
        ...this.tag,
        snippet: this.snippetModel,
      });

      if (update.ok) {
        console.log('[TagInformation] OK');
        this.tag.snippet = this.snippetModel;
        alertUser({
          text: `Updated applied - thanks!`,
          status: Status.ok,
        });
      } else {
        alertUser({
          text: `error in applying update!`,
          status: Status.error,
        });
      }

      this.editingSnippet = false;
      this.snippetSaving = false;
    },

    async saveWiki() {
      this.wikiSaving = true;

      const update = await this.courseDB!.updateTag({
        ...this.tag,
        wiki: this.wikiModel,
      });

      if (update.ok) {
        this.tag.wiki = this.wikiModel;
        alertUser({
          text: `Updated applied - thanks!`,
          status: Status.ok,
        });
      } else {
        alertUser({
          text: `error in applying update!`,
          status: Status.error,
        });
      }

      this.editingWiki = false;
      this.wikiSaving = false;
    },

    cancelEditSnippet() {
      console.log('[TagInformation] Cancelling EditSnip');
      this.editingSnippet = false;
      this.snippetModel = this.tag.snippet;
    },

    cancelEditWiki() {
      this.editingWiki = false;
      this.wikiModel = this.tag.wiki;
    },
  },
});
</script>
