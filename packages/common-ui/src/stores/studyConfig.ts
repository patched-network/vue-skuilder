// packages/common-ui/src/stores/studyConfig.ts
import { defineStore } from 'pinia';
import type { TagFilter } from '@vue-skuilder/db/src/study/TagFilteredContentSource';

interface StudyConfigState {
  tagFilter: TagFilter | null;
  timeLimit: number | null;
}

export const useStudyConfigStore = defineStore('studyConfig', {
  state: (): StudyConfigState => ({
    tagFilter: null,
    timeLimit: null,
  }),
  actions: {
    setFilter(filter: TagFilter) {
      this.tagFilter = filter;
    },
    setTime(time: number) {
      this.timeLimit = time;
    },
    clearConfig() {
      this.tagFilter = null;
      this.timeLimit = null;
    },
  },
  getters: {
    hasConfig: (state): boolean => state.tagFilter !== null && state.timeLimit !== null,
  },
});
