<template>
  <v-toolbar dense>
    <v-toolbar-title>
      <span>{{ title }}</span>
      <span class="ms-2 text-subtitle-2">{{ subtitle }}</span>
    </v-toolbar-title>
    <v-spacer></v-spacer>
    <v-btn variant="text" icon color="secondary" :disabled="page == 1" @click="$emit('first')">
      <v-icon>mdi-page-first</v-icon>
    </v-btn>
    <v-btn variant="text" icon color="secondary" :disabled="page == 1" @click="$emit('prev')">
      <v-icon>mdi-chevron-left</v-icon>
    </v-btn>

    <v-select
      :model-value="page"
      :items="pages"
      class="pageSelect"
      density="compact"
      hide-details
      :return-object="false"
      variant="outlined"
      @update:model-value="(val) => $emit('set-page', val)"
    >
      <template #selection="{ item }">
        {{ item.value }}
      </template>
    </v-select>

    <v-btn variant="text" icon color="secondary" :disabled="page == pages.length" @click="$emit('next')">
      <v-icon>mdi-chevron-right</v-icon>
    </v-btn>
    <v-btn variant="text" icon color="secondary" :disabled="page == pages.length" @click="$emit('last')">
      <v-icon>mdi-page-last</v-icon>
    </v-btn>
  </v-toolbar>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';

export default defineComponent({
  name: 'PaginatingToolbar',

  props: {
    pages: {
      type: Array as PropType<number[]>,
      required: true,
    },
    page: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: false,
      default: '',
    },
    subtitle: {
      type: String,
      required: false,
      default: '',
    },
  },

  emits: ['first', 'prev', 'next', 'last', 'set-page'],
});
</script>

<style scoped>
.pageSelect {
  max-width: 60px;
}
</style>
