<template>
  <div class="navigation-strategy-list">
    <v-radio-group :model-value="defaultStrategyId" @update:modelValue="$emit('update:defaultStrategy', $event)" density="compact">
      <v-list density="compact">
        <v-list-item
          v-for="strategy in strategies"
          :key="strategy._id"
          lines="two"
        >
          <template #prepend>
            <v-radio :value="strategy._id"></v-radio>
          </template>

          <v-list-item-title class="text-subtitle-2">
            {{ strategy.name }}
          </v-list-item-title>

          <v-list-item-subtitle class="text-caption">
            {{ strategy.implementingClass }}
            <span v-if="strategy.description"> • {{ strategy.description }}</span>
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex">
              <v-btn
                icon
                size="x-small"
                variant="text"
                title="Edit Strategy"
                @click="$emit('edit', strategy)"
              >
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>

              <v-btn
                icon
                size="x-small"
                variant="text"
                title="Delete Strategy"
                @click="$emit('delete', strategy)"
              >
                <v-icon size="small">mdi-delete</v-icon>
              </v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-radio-group>
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
    defaultStrategyId: {
      type: String as PropType<string | null>,
      default: null,
    },
  },

  emits: ['edit', 'delete', 'update:defaultStrategy'],

  methods: {
    getDisplayConfig(strategy: ContentNavigationStrategyData): string {
      if (!strategy.serializedData) return 'No configuration';

      try {
        // Try to parse the serialized data to show a more user-friendly display
        const config = JSON.parse(strategy.serializedData);
        if (Array.isArray(config)) {
          return `${config.length} cards in sequence`;
        }
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
  /* Compact list styling */
}
</style>
