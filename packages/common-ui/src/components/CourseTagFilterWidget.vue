<template>
  <div class="course-tag-filter-widget">
    <v-autocomplete
      v-model="localFilter.include"
      :items="availableTags"
      :loading="loading"
      :disabled="loading"
      label="Include tags"
      placeholder="Type to search tags..."
      hint="Cards must have at least one of these tags"
      persistent-hint
      multiple
      chips
      closable-chips
      clearable
      density="compact"
      variant="outlined"
      class="mb-2"
      :custom-filter="fuzzyFilter"
      no-data-text="No matching tags found"
    >
      <template #chip="{ props, item }">
        <v-chip
          v-bind="props"
          color="primary"
          variant="tonal"
          size="small"
        >
          {{ item.raw }}
        </v-chip>
      </template>
      <template #item="{ props, item }">
        <v-list-item v-bind="props" :title="item.raw">
          <template #subtitle v-if="tagSnippets[item.raw]">
            {{ tagSnippets[item.raw] }}
          </template>
        </v-list-item>
      </template>
    </v-autocomplete>

    <v-autocomplete
      v-model="localFilter.exclude"
      :items="availableTagsForExclude"
      :loading="loading"
      :disabled="loading"
      label="Exclude tags"
      placeholder="Type to search tags..."
      hint="Cards with these tags will be excluded"
      persistent-hint
      multiple
      chips
      closable-chips
      clearable
      density="compact"
      variant="outlined"
      :custom-filter="fuzzyFilter"
      no-data-text="No matching tags found"
    >
      <template #chip="{ props, item }">
        <v-chip
          v-bind="props"
          color="error"
          variant="tonal"
          size="small"
        >
          {{ item.raw }}
        </v-chip>
      </template>
      <template #item="{ props, item }">
        <v-list-item v-bind="props" :title="item.raw">
          <template #subtitle v-if="tagSnippets[item.raw]">
            {{ tagSnippets[item.raw] }}
          </template>
        </v-list-item>
      </template>
    </v-autocomplete>

    <div v-if="hasActiveFilter" class="filter-summary text-caption mt-2">
      <v-icon size="small" color="info" class="mr-1">mdi-filter</v-icon>
      <span v-if="localFilter.include.length">
        Including: {{ localFilter.include.join(', ') }}
      </span>
      <span v-if="localFilter.include.length && localFilter.exclude.length"> · </span>
      <span v-if="localFilter.exclude.length">
        Excluding: {{ localFilter.exclude.join(', ') }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, watch, onMounted } from 'vue';
import { TagFilter, emptyTagFilter, hasActiveFilter as checkActiveFilter } from '@vue-skuilder/common';
import { getDataLayer, Tag } from '@vue-skuilder/db';

export default defineComponent({
  name: 'CourseTagFilterWidget',

  props: {
    courseId: {
      type: String,
      required: true,
    },
    modelValue: {
      type: Object as PropType<TagFilter | undefined>,
      default: undefined,
    },
  },

  emits: ['update:modelValue'],

  setup(props, { emit }) {
    const loading = ref(true);
    const availableTags = ref<string[]>([]);
    const tagSnippets = ref<Record<string, string>>({});

    // Local copy of the filter for editing
    const localFilter = ref<TagFilter>(
      props.modelValue ? { ...props.modelValue } : emptyTagFilter()
    );

    // Computed: tags available for exclude (not already in include)
    const availableTagsForExclude = computed(() => {
      return availableTags.value.filter(
        (tag) => !localFilter.value.include.includes(tag)
      );
    });

    // Computed: whether filter has any active constraints
    const hasActiveFilter = computed(() => {
      return checkActiveFilter(localFilter.value);
    });

    // Fuzzy filter function for autocomplete
    const fuzzyFilter = (itemText: string, queryText: string): boolean => {
      if (!queryText) return true;

      const query = queryText.toLowerCase();
      const text = itemText.toLowerCase();

      // Simple fuzzy match: all query characters appear in order
      let queryIndex = 0;
      for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
          queryIndex++;
        }
      }
      return queryIndex === query.length;
    };

    // Watch for external changes to modelValue
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue) {
          localFilter.value = { ...newValue };
        } else {
          localFilter.value = emptyTagFilter();
        }
      },
      { deep: true }
    );

    // Emit changes when local filter changes
    watch(
      localFilter,
      (newFilter) => {
        emit('update:modelValue', { ...newFilter });
      },
      { deep: true }
    );

    // Watch for courseId changes and reload tags
    watch(
      () => props.courseId,
      async (newCourseId) => {
        if (newCourseId) {
          await loadTags();
        }
      }
    );

    // Load tags for the course
    async function loadTags() {
      loading.value = true;
      try {
        const courseDB = getDataLayer().getCourseDB(props.courseId);
        const response = await courseDB.getCourseTagStubs();

        availableTags.value = [];
        tagSnippets.value = {};

        for (const row of response.rows) {
          if (row.doc) {
            const tag = row.doc as Tag;
            availableTags.value.push(tag.name);
            if (tag.snippet) {
              tagSnippets.value[tag.name] = tag.snippet;
            }
          }
        }

        // Sort alphabetically
        availableTags.value.sort((a, b) => a.localeCompare(b));
      } catch (error) {
        console.error('[CourseTagFilterWidget] Failed to load tags:', error);
        availableTags.value = [];
        tagSnippets.value = {};
      } finally {
        loading.value = false;
      }
    }

    onMounted(() => {
      if (props.courseId) {
        loadTags();
      }
    });

    return {
      loading,
      availableTags,
      availableTagsForExclude,
      tagSnippets,
      localFilter,
      hasActiveFilter,
      fuzzyFilter,
    };
  },
});
</script>

<style scoped>
.course-tag-filter-widget {
  width: 100%;
}

.filter-summary {
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
