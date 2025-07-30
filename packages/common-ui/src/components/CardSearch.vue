<template>
  <div class="card-search">
    <v-text-field
      v-model="query"
      label="Search for cards..."
      append-icon="mdi-magnify"
      @click:append="search"
      @keydown.enter="search"
    ></v-text-field>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CardSearch',
  emits: {
    search: (query: string) => typeof query === 'string'
  },
  data() {
    return {
      query: '',
    };
  },
  methods: {
    search() {
      this.$emit('search', this.query);
    },
  },
});
</script>
