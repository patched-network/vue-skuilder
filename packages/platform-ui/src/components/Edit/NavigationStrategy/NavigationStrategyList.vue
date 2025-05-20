<template>
  <div class="navigation-strategy-list">
    <v-list>
      <v-list-item
        v-for="strategy in strategies"
        :key="strategy.id"
        lines="three"
      >
        <template #prepend>
          <v-icon> mdi-navigation </v-icon>
        </template>

        <v-list-item-title class="text-h6">
          {{ strategy.name }}
        </v-list-item-title>

        <v-list-item-subtitle>{{ strategy.description }}</v-list-item-subtitle>

        <v-list-item-subtitle class="strategy-details mt-2">
          <div><strong>Type:</strong> {{ strategy.implementingClass }}</div>
          <div v-if="strategy.serializedData"><strong>Configuration:</strong> {{ getDisplayConfig(strategy) }}</div>
        </v-list-item-subtitle>

        <template #append>
          <div class="d-flex">
            <v-btn icon size="small" title="Edit Strategy (coming soon)" class="mr-1" disabled>
              <v-icon>mdi-pencil</v-icon>
            </v-btn>

            <v-btn
              icon
              size="small"
              title="Delete Strategy"
              class="mr-1"
              @click="$emit('delete', strategy)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import type { ContentNavigationStrategyData } from '@vue-skuilder/db/src/core/types/contentNavigationStrategy';

export default defineComponent({
  name: 'NavigationStrategyList',

  props: {
    strategies: {
      type: Array as PropType<ContentNavigationStrategyData[]>,
      required: true,
    },
  },

  emits: ['edit', 'delete'],

  methods: {
    getDisplayConfig(strategy: ContentNavigationStrategyData): string {
      if (!strategy.serializedData) return 'No configuration';

      try {
        // Try to parse the serialized data to show a more user-friendly display
        const config = JSON.parse(strategy.serializedData);
        return Object.keys(config)
          .map((key) => `${key}: ${config[key]}`)
          .join(', ');
      } catch {
        // If it's not valid JSON, just return as is
        return strategy.serializedData;
      }
    },
  },
});
</script>

<style scoped>
.navigation-strategy-list {
  margin: 16px 0;
}



.strategy-details {
  font-size: 0.9em;
  color: rgba(0, 0, 0, 0.6);
}
</style>
